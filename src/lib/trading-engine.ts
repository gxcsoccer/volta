// ============================================================
// Trading Engine - Validates and executes trades
// ============================================================

import { SupabaseClient } from "@supabase/supabase-js";
import type { Account, Position, TradeDecision, MarketQuote } from "./types";

// SEC fee: ~$0.00278 per $1000 of sell proceeds (as of 2024)
const SEC_FEE_RATE = 0.00000278;
// TAF fee: $0.000166 per share sold (max $8.30)
const TAF_FEE_PER_SHARE = 0.000166;

export interface TradeResult {
  success: boolean;
  symbol: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  total: number;
  fee: number;
  error?: string;
}

/**
 * Calculate trading fees (mimics real broker fees)
 * Most brokers are commission-free, but SEC/TAF fees apply on sells
 */
export function calculateFees(
  side: "buy" | "sell",
  shares: number,
  price: number
): number {
  if (side === "buy") return 0;
  const proceeds = shares * price;
  const secFee = Math.ceil(proceeds * SEC_FEE_RATE * 100) / 100;
  const tafFee = Math.min(shares * TAF_FEE_PER_SHARE, 8.3);
  return Math.round((secFee + tafFee) * 100) / 100;
}

/**
 * Apply simulated slippage (±0.05% random)
 */
export function applySlippage(price: number, side: "buy" | "sell"): number {
  const slippagePct = Math.random() * 0.0005; // up to 0.05%
  const adjusted =
    side === "buy" ? price * (1 + slippagePct) : price * (1 - slippagePct);
  return Math.round(adjusted * 100) / 100;
}

/**
 * Validate a trade decision against account constraints
 */
export function validateTrade(
  decision: TradeDecision,
  account: Account,
  positions: Position[],
  quotes: Map<string, MarketQuote>
): { valid: boolean; error?: string } {
  if (decision.action === "hold") {
    return { valid: true };
  }

  const quote = quotes.get(decision.symbol.toUpperCase());
  if (!quote || quote.price <= 0) {
    return { valid: false, error: `No market data for ${decision.symbol}` };
  }

  if (decision.shares <= 0 || !Number.isInteger(decision.shares)) {
    return { valid: false, error: `Shares must be a positive integer` };
  }

  if (decision.action === "buy") {
    const cost = decision.shares * quote.price;
    if (cost > account.cash) {
      const maxShares = Math.floor(account.cash / quote.price);
      return {
        valid: false,
        error: `Insufficient cash. Need $${cost.toFixed(2)}, have $${account.cash.toFixed(2)}. Max buyable: ${maxShares} shares`,
      };
    }
  }

  if (decision.action === "sell") {
    const position = positions.find(
      (p) => p.symbol === decision.symbol.toUpperCase()
    );
    if (!position || position.shares < decision.shares) {
      const held = position?.shares ?? 0;
      return {
        valid: false,
        error: `Insufficient shares. Want to sell ${decision.shares}, hold ${held}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Execute a single trade and update the database
 */
export async function executeTrade(
  db: SupabaseClient,
  accountId: string,
  decision: TradeDecision,
  quote: MarketQuote,
  reasoning: string
): Promise<TradeResult> {
  const side = decision.action as "buy" | "sell";
  const executionPrice = applySlippage(quote.price, side);
  const fee = calculateFees(side, decision.shares, executionPrice);
  const total = decision.shares * executionPrice;

  // Start a "transaction" (Supabase doesn't have true transactions via REST,
  // but we use RPC or sequential operations)
  try {
    // 1. Record the trade
    const { error: tradeError } = await db.from("trades").insert({
      account_id: accountId,
      symbol: decision.symbol.toUpperCase(),
      side,
      shares: decision.shares,
      price: executionPrice,
      total,
      fee,
      reasoning,
    });
    if (tradeError) throw tradeError;

    // 2. Update cash
    if (side === "buy") {
      const { error } = await db.rpc("adjust_cash", {
        p_account_id: accountId,
        p_amount: -(total + fee),
      });
      if (error) throw error;
    } else {
      const { error } = await db.rpc("adjust_cash", {
        p_account_id: accountId,
        p_amount: total - fee,
      });
      if (error) throw error;
    }

    // 3. Update position
    if (side === "buy") {
      await upsertPosition(db, accountId, decision.symbol.toUpperCase(), decision.shares, executionPrice);
    } else {
      await reducePosition(db, accountId, decision.symbol.toUpperCase(), decision.shares);
    }

    return {
      success: true,
      symbol: decision.symbol,
      side,
      shares: decision.shares,
      price: executionPrice,
      total,
      fee,
    };
  } catch (err) {
    return {
      success: false,
      symbol: decision.symbol,
      side,
      shares: decision.shares,
      price: executionPrice,
      total,
      fee,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Buy: insert new position or update average cost
 */
async function upsertPosition(
  db: SupabaseClient,
  accountId: string,
  symbol: string,
  newShares: number,
  price: number
) {
  const { data: existing } = await db
    .from("positions")
    .select("*")
    .eq("account_id", accountId)
    .eq("symbol", symbol)
    .single();

  if (existing) {
    // Update average cost
    const totalShares = existing.shares + newShares;
    const avgCost =
      (existing.avg_cost * existing.shares + price * newShares) / totalShares;

    const { error } = await db
      .from("positions")
      .update({
        shares: totalShares,
        avg_cost: Math.round(avgCost * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await db.from("positions").insert({
      account_id: accountId,
      symbol,
      shares: newShares,
      avg_cost: price,
    });
    if (error) throw error;
  }
}

/**
 * Sell: reduce or remove position
 */
async function reducePosition(
  db: SupabaseClient,
  accountId: string,
  symbol: string,
  sharesToSell: number
) {
  const { data: existing } = await db
    .from("positions")
    .select("*")
    .eq("account_id", accountId)
    .eq("symbol", symbol)
    .single();

  if (!existing) throw new Error(`No position found for ${symbol}`);

  const remaining = existing.shares - sharesToSell;
  if (remaining <= 0) {
    // Remove position entirely
    const { error } = await db
      .from("positions")
      .delete()
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await db
      .from("positions")
      .update({
        shares: remaining,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw error;
  }
}
