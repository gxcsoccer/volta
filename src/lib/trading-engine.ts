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
 * Execute a single trade atomically via database RPC.
 *
 * Primary path: calls `execute_trade_atomic` which wraps trade insert +
 * cash adjust + position upsert in a single PostgreSQL transaction.
 *
 * Fallback path: if the RPC doesn't exist yet, uses sequential operations
 * with compensating rollback on failure.
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
  const symbol = decision.symbol.toUpperCase();

  try {
    // Try atomic RPC first
    const { error: rpcError } = await db.rpc("execute_trade_atomic", {
      p_account_id: accountId,
      p_symbol: symbol,
      p_side: side,
      p_shares: decision.shares,
      p_price: executionPrice,
      p_total: total,
      p_fee: fee,
      p_reasoning: reasoning,
    });

    // If the function doesn't exist, fall back to sequential + compensating
    if (rpcError && rpcError.code === "PGRST202") {
      console.warn("[Trade] execute_trade_atomic not found, using fallback");
      return await executeTradeWithRollback(
        db, accountId, symbol, side, decision.shares,
        executionPrice, total, fee, reasoning
      );
    }

    if (rpcError) throw rpcError;

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
    console.error(
      `[Trade FAILED] ${side} ${decision.shares} ${symbol} @ $${executionPrice}:`,
      err instanceof Error ? err.message : String(err)
    );
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
 * Fallback: sequential operations with compensating rollback.
 * Used when the atomic RPC function hasn't been deployed yet.
 */
async function executeTradeWithRollback(
  db: SupabaseClient,
  accountId: string,
  symbol: string,
  side: "buy" | "sell",
  shares: number,
  price: number,
  total: number,
  fee: number,
  reasoning: string
): Promise<TradeResult> {
  const result: TradeResult = { success: false, symbol, side, shares, price, total, fee };

  // Step 1: Insert trade record
  const { data: tradeRecord, error: tradeError } = await db
    .from("trades")
    .insert({
      account_id: accountId, symbol, side, shares, price, total, fee, reasoning,
    })
    .select("id")
    .single();

  if (tradeError) throw tradeError;
  const tradeId = tradeRecord.id;

  // Step 2: Adjust cash
  const cashAmount = side === "buy" ? -(total + fee) : total - fee;
  const { error: cashError } = await db.rpc("adjust_cash", {
    p_account_id: accountId,
    p_amount: cashAmount,
  });

  if (cashError) {
    // Rollback step 1
    await db.from("trades").delete().eq("id", tradeId);
    throw cashError;
  }

  // Step 3: Update position
  try {
    if (side === "buy") {
      await upsertPosition(db, accountId, symbol, shares, price);
    } else {
      await reducePosition(db, accountId, symbol, shares);
    }
  } catch (posError) {
    // Rollback steps 1 & 2
    await db.rpc("adjust_cash", { p_account_id: accountId, p_amount: -cashAmount });
    await db.from("trades").delete().eq("id", tradeId);
    throw posError;
  }

  result.success = true;
  return result;
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
