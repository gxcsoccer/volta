// ============================================================
// Stock Screener - AI picks stocks from the universe
// ============================================================

import { SupabaseClient } from "@supabase/supabase-js";
import { getQuotes } from "./market-data";
import { STOCK_POOL } from "./stock-pool";
import type { Agent, MarketQuote } from "./types";
import { getAgentConfig } from "./types";

interface ScreeningResult {
  agent_id: string;
  agent_name: string;
  previous_watchlist: string[];
  new_watchlist: string[];
  reasoning: string;
  error?: string;
}

interface ScreeningRoundSummary {
  timestamp: string;
  quotes_fetched: number;
  results: ScreeningResult[];
  errors: string[];
}

const SCREENING_PROMPT = `
You are selecting stocks for your portfolio from a universe of ~100 major US stocks.

Based on your investment strategy and the market data below, pick 15-20 stocks that you want to actively monitor and potentially trade.

You MUST respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "watchlist": ["AAPL", "MSFT", ...],
  "reasoning": "Brief explanation of your selection criteria"
}

Rules:
- Pick between 15 and 20 symbols
- Only use symbols from the provided list
- Always include SPY for benchmark reference
- Choose stocks that match your strategy
`;

/**
 * Fetch quotes in batches (Alpaca may have URL length limits)
 */
async function fetchAllQuotes(symbols: string[]): Promise<MarketQuote[]> {
  const BATCH_SIZE = 50;
  const allQuotes: MarketQuote[] = [];

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const quotes = await getQuotes(batch);
    allQuotes.push(...quotes);
  }

  return allQuotes;
}

/**
 * Format market data for the screening prompt
 */
function formatMarketOverview(quotes: MarketQuote[]): string {
  const sorted = [...quotes].sort((a, b) => b.change_pct - a.change_pct);

  const lines = sorted.map(
    (q) =>
      `${q.symbol.padEnd(6)} $${q.price.toFixed(2).padStart(8)} ${q.change_pct >= 0 ? "+" : ""}${q.change_pct.toFixed(2).padStart(6)}%  Vol: ${(q.volume / 1000000).toFixed(1)}M`
  );

  return `## Stock Universe (${quotes.length} stocks, sorted by daily change)\n${lines.join("\n")}`;
}

/**
 * Ask one AI agent to pick its watchlist
 */
async function screenForAgent(
  agent: Agent,
  quotes: MarketQuote[]
): Promise<{ watchlist: string[]; reasoning: string }> {
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing AI_BASE_URL or AI_API_KEY");
  }

  const marketOverview = formatMarketOverview(quotes);

  const config = getAgentConfig(agent);

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model.primary,
      messages: [
        { role: "system", content: config.identity.soul },
        {
          role: "user",
          content: `${marketOverview}\n\n${SCREENING_PROMPT}`,
        },
      ],
      max_tokens: config.model.max_tokens ?? 1024,
      temperature: config.model.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI screening error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const responseText = data.choices?.[0]?.message?.content ?? "{}";

  return parseScreeningResponse(responseText, quotes);
}

/**
 * Parse AI screening response
 */
function parseScreeningResponse(
  text: string,
  quotes: MarketQuote[]
): { watchlist: string[]; reasoning: string } {
  let cleaned = text.trim();

  // Strip code fences
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) cleaned = jsonMatch[1].trim();

  // Extract JSON
  const braceStart = cleaned.indexOf("{");
  const braceEnd = cleaned.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    cleaned = cleaned.slice(braceStart, braceEnd + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    let watchlist: string[] = Array.isArray(parsed.watchlist)
      ? parsed.watchlist
      : [];

    // Validate: only keep symbols that exist in our quotes
    const validSymbols = new Set(quotes.map((q) => q.symbol));
    watchlist = watchlist
      .map((s: string) => s.toUpperCase().trim())
      .filter((s: string) => validSymbols.has(s));

    // Ensure SPY is included
    if (!watchlist.includes("SPY")) {
      watchlist.push("SPY");
    }

    // Enforce 15-20 limit
    if (watchlist.length > 20) {
      watchlist = watchlist.slice(0, 20);
    }

    return {
      watchlist,
      reasoning: parsed.reasoning ?? "",
    };
  } catch {
    console.error("Failed to parse screening response:", text);
    return { watchlist: ["SPY"], reasoning: "Failed to parse - defaulting to SPY" };
  }
}

/**
 * Run stock screening for all active AI agents
 */
export async function runScreeningRound(
  db: SupabaseClient
): Promise<ScreeningRoundSummary> {
  const summary: ScreeningRoundSummary = {
    timestamp: new Date().toISOString(),
    quotes_fetched: 0,
    results: [],
    errors: [],
  };

  // 1. Fetch quotes for the entire stock pool
  let quotes: MarketQuote[];
  try {
    quotes = await fetchAllQuotes(STOCK_POOL);
    summary.quotes_fetched = quotes.length;
  } catch (err) {
    summary.errors.push(
      `Failed to fetch market data: ${err instanceof Error ? err.message : String(err)}`
    );
    return summary;
  }

  // 2. Load active non-passive agents
  const { data: agents, error: agentsErr } = await db
    .from("agents")
    .select("*")
    .eq("is_active", true)
    .eq("is_passive", false);

  if (agentsErr || !agents) {
    summary.errors.push(`Failed to load agents: ${agentsErr?.message}`);
    return summary;
  }

  // 3. Each AI picks its watchlist (skip agents with fixed watchlists like Aurum Rotator)
  for (const agent of agents as Agent[]) {
    const agentConfig = getAgentConfig(agent);
    if (agentConfig.tools.includes("aurum_signal")) {
      // Aurum Rotator manages its own watchlist via external signals — skip screening
      summary.results.push({
        agent_id: agent.id,
        agent_name: agent.name,
        previous_watchlist: agent.watchlist,
        new_watchlist: agent.watchlist,
        reasoning: "Skipped: uses external signal tool (aurum_signal)",
      });
      continue;
    }
    const result: ScreeningResult = {
      agent_id: agent.id,
      agent_name: agent.name,
      previous_watchlist: agent.watchlist,
      new_watchlist: [],
      reasoning: "",
    };

    try {
      const { watchlist, reasoning } = await screenForAgent(agent, quotes);
      result.new_watchlist = watchlist;
      result.reasoning = reasoning;

      // Update agent's watchlist in DB
      const { error: updateErr } = await db
        .from("agents")
        .update({ watchlist: watchlist })
        .eq("id", agent.id);

      if (updateErr) {
        result.error = `DB update failed: ${updateErr.message}`;
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
    }

    summary.results.push(result);
  }

  return summary;
}
