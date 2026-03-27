// ============================================================
// Trading Orchestrator - Runs a full trading round
// ============================================================

import { SupabaseClient } from "@supabase/supabase-js";
import { isMarketOpen, getQuotes } from "./market-data";
import { getAIDecision } from "./ai-decision";
import { validateTrade, executeTrade } from "./trading-engine";
import { getAgentConfig } from "./types";
import { loadSkills, loadSkillsByName } from "./skills/registry";
import type {
  Agent,
  Account,
  Position,
  Trade,
  MarketQuote,
  TradingRoundResult,
} from "./types";

interface TradingRoundSummary {
  timestamp: string;
  market_open: boolean;
  results: TradingRoundResult[];
  errors: string[];
}

/**
 * Run one complete trading round for all active agents
 */
export async function runTradingRound(
  db: SupabaseClient,
  options: { force?: boolean } = {}
): Promise<TradingRoundSummary> {
  const summary: TradingRoundSummary = {
    timestamp: new Date().toISOString(),
    market_open: false,
    results: [],
    errors: [],
  };

  // 1. Check market hours (skip if forced for testing)
  if (!options.force) {
    try {
      const clock = await isMarketOpen();
      summary.market_open = clock.is_open;
      if (!clock.is_open) {
        summary.errors.push(
          `Market is closed. Next open: ${clock.next_open}`
        );
        return summary;
      }
    } catch (err) {
      summary.errors.push(
        `Failed to check market status: ${err instanceof Error ? err.message : String(err)}`
      );
      return summary;
    }
  } else {
    summary.market_open = true;
  }

  // 2. Load all active agents with their accounts
  const { data: agents, error: agentsError } = await db
    .from("agents")
    .select("*")
    .eq("is_active", true);

  if (agentsError || !agents) {
    summary.errors.push(`Failed to load agents: ${agentsError?.message}`);
    return summary;
  }

  // 3. Collect all symbols across all agents' watchlists
  const allSymbols = new Set<string>();
  for (const agent of agents) {
    for (const symbol of agent.watchlist) {
      allSymbols.add(symbol.toUpperCase());
    }
  }

  // 4. Fetch market data for all symbols at once
  let quotes: MarketQuote[];
  try {
    quotes = await getQuotes([...allSymbols]);
  } catch (err) {
    summary.errors.push(
      `Failed to fetch market data: ${err instanceof Error ? err.message : String(err)}`
    );
    return summary;
  }

  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

  // 5. Cache quotes in market_data table
  for (const q of quotes) {
    await db.from("market_data").upsert(
      {
        symbol: q.symbol,
        price: q.price,
        prev_close: q.prev_close,
        change_pct: q.change_pct,
        volume: q.volume,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "symbol" }
    );
  }

  // 6. Process all agents in parallel
  const results = await Promise.all(
    (agents as Agent[]).map((agent) => processAgent(db, agent, quoteMap))
  );
  summary.results.push(...results);

  // 7. Take portfolio snapshots
  await takeSnapshots(db, quoteMap);

  return summary;
}

/**
 * Process a single agent's trading round
 */
async function processAgent(
  db: SupabaseClient,
  agent: Agent,
  quoteMap: Map<string, MarketQuote>
): Promise<TradingRoundResult> {
  const result: TradingRoundResult = {
    agent_id: agent.id,
    agent_name: agent.name,
    decisions: [],
    executed: [],
    errors: [],
  };

  try {
    // Load account
    const { data: account, error: accError } = await db
      .from("accounts")
      .select("*")
      .eq("agent_id", agent.id)
      .single();

    if (accError || !account) {
      result.errors.push(`No account found: ${accError?.message}`);
      return result;
    }

    // Load positions
    const { data: positions } = await db
      .from("positions")
      .select("*")
      .eq("account_id", account.id);

    // Handle passive agents (buy & hold benchmark)
    if (agent.is_passive) {
      await handlePassiveAgent(db, agent, account, positions ?? [], quoteMap);
      return result;
    }

    // Load recent trades for context
    const { data: recentTrades } = await db
      .from("trades")
      .select("*")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Get relevant quotes for this agent's watchlist
    const agentQuotes = agent.watchlist
      .map((s) => quoteMap.get(s.toUpperCase()))
      .filter((q): q is MarketQuote => q !== undefined);

    // Load skills for this agent
    const config = getAgentConfig(agent);
    const skills = config.skills.length > 0
      ? await loadSkillsByName(db, config.skills).then(async (byName) => {
          // Try by name first, then by ID for UUID-style skills
          if (byName.length > 0) return byName;
          return loadSkills(db, config.skills);
        })
      : [];

    // Call AI for decisions (with tools and skills)
    const aiResult = await getAIDecision(
      agent,
      account as Account,
      (positions ?? []) as Position[],
      agentQuotes,
      (recentTrades ?? []) as Trade[],
      skills
    );

    result.decisions = aiResult.response.decisions;

    // Log tool calls if any
    if (aiResult.toolCalls && aiResult.toolCalls.length > 0) {
      console.log(
        `[${agent.name}] Tool calls:`,
        aiResult.toolCalls.map((tc) => `${tc.name}(${JSON.stringify(tc.arguments)}) → ${tc.duration_ms}ms`)
      );
    }

    // Execute each decision
    let currentPositions = (positions ?? []) as Position[];

    for (const decision of aiResult.response.decisions) {
      if (decision.action === "hold") continue;

      // Validate against latest account + position state
      const validation = validateTrade(
        decision,
        account as Account,
        currentPositions,
        quoteMap
      );

      if (!validation.valid) {
        result.executed.push({
          symbol: decision.symbol,
          side: decision.action,
          shares: decision.shares,
          price: 0,
          error: validation.error,
        });
        continue;
      }

      const quote = quoteMap.get(decision.symbol.toUpperCase());
      if (!quote) {
        result.executed.push({
          symbol: decision.symbol,
          side: decision.action,
          shares: decision.shares,
          price: 0,
          error: "No quote available",
        });
        continue;
      }

      // Execute (atomic — trade + cash + position in one DB transaction)
      const tradeResult = await executeTrade(
        db,
        account.id,
        decision,
        quote,
        decision.reasoning
      );

      result.executed.push({
        symbol: tradeResult.symbol,
        side: tradeResult.side,
        shares: tradeResult.shares,
        price: tradeResult.price,
        error: tradeResult.error,
      });

      // Skip refresh if trade failed (nothing changed in DB)
      if (!tradeResult.success) {
        result.errors.push(
          `Trade failed: ${tradeResult.side} ${tradeResult.shares} ${tradeResult.symbol} - ${tradeResult.error}`
        );
        continue;
      }

      // Refresh both account and positions after successful trade
      const { data: refreshedAccount } = await db
        .from("accounts")
        .select("*")
        .eq("id", account.id)
        .single();
      if (refreshedAccount) {
        Object.assign(account, refreshedAccount);
      }

      const { data: refreshedPositions } = await db
        .from("positions")
        .select("*")
        .eq("account_id", account.id);
      if (refreshedPositions) {
        currentPositions = refreshedPositions as Position[];
      }
    }
  } catch (err) {
    result.errors.push(
      err instanceof Error ? err.message : String(err)
    );
  }

  return result;
}

/**
 * Handle passive benchmark agent (buy SPY on first run, then hold)
 */
async function handlePassiveAgent(
  db: SupabaseClient,
  agent: Agent,
  account: Account,
  positions: Position[],
  quoteMap: Map<string, MarketQuote>
) {
  // If already has positions, do nothing (hold)
  if (positions.length > 0) return;

  // First run: buy as much SPY as possible
  const spy = quoteMap.get("SPY");
  if (!spy) return;

  const maxShares = Math.floor(account.cash / spy.price);
  if (maxShares <= 0) return;

  await executeTrade(
    db,
    account.id,
    { action: "buy", symbol: "SPY", shares: maxShares, reasoning: "Initial SPY buy - passive benchmark" },
    spy,
    "Passive benchmark: buy and hold SPY"
  );
}

/**
 * Take portfolio snapshots for all accounts
 */
async function takeSnapshots(
  db: SupabaseClient,
  quoteMap: Map<string, MarketQuote>
) {
  const { data: accounts } = await db.from("accounts").select("*");
  if (!accounts) return;

  for (const account of accounts) {
    const { data: positions } = await db
      .from("positions")
      .select("*")
      .eq("account_id", account.id);

    const positionsValue = (positions ?? []).reduce((sum, p) => {
      const quote = quoteMap.get(p.symbol);
      return sum + p.shares * (quote?.price ?? 0);
    }, 0);

    const totalValue = Number(account.cash) + positionsValue;
    const returnPct =
      ((totalValue - Number(account.initial_capital)) /
        Number(account.initial_capital)) *
      100;

    await db.from("snapshots").insert({
      account_id: account.id,
      total_value: Math.round(totalValue * 100) / 100,
      cash: account.cash,
      positions_value: Math.round(positionsValue * 100) / 100,
      return_pct: Math.round(returnPct * 100) / 100,
    });
  }
}
