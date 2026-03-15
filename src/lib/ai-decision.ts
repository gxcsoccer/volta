// ============================================================
// AI Decision Engine - OpenAI-compatible gateway (OpenClaw)
// ============================================================

import type {
  Agent,
  Account,
  Position,
  MarketQuote,
  Trade,
  AIResponse,
} from "./types";

/**
 * Build the context prompt that describes current portfolio state and market data
 */
export function buildContextPrompt(
  account: Account,
  positions: Position[],
  quotes: MarketQuote[],
  recentTrades: Trade[]
): string {
  const positionLines = positions.map((p) => {
    const quote = quotes.find((q) => q.symbol === p.symbol);
    const currentPrice = quote?.price ?? 0;
    const marketValue = p.shares * currentPrice;
    const pnl = (currentPrice - p.avg_cost) * p.shares;
    const pnlPct =
      p.avg_cost > 0 ? ((currentPrice - p.avg_cost) / p.avg_cost) * 100 : 0;
    return `  ${p.symbol}: ${p.shares} shares @ avg $${p.avg_cost.toFixed(2)} | Current: $${currentPrice.toFixed(2)} | Value: $${marketValue.toFixed(2)} | P&L: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%)`;
  });

  const totalPositionsValue = positions.reduce((sum, p) => {
    const quote = quotes.find((q) => q.symbol === p.symbol);
    return sum + p.shares * (quote?.price ?? 0);
  }, 0);
  const totalValue = account.cash + totalPositionsValue;
  const totalReturn =
    ((totalValue - account.initial_capital) / account.initial_capital) * 100;

  const quoteLines = quotes.map(
    (q) =>
      `  ${q.symbol}: $${q.price.toFixed(2)} (${q.change_pct >= 0 ? "+" : ""}${q.change_pct.toFixed(2)}% today) | Vol: ${(q.volume / 1000000).toFixed(1)}M`
  );

  const tradeLines = recentTrades.slice(0, 10).map(
    (t) =>
      `  ${t.created_at.slice(0, 16)} | ${t.side.toUpperCase()} ${t.shares} ${t.symbol} @ $${t.price.toFixed(2)}`
  );

  return `
## Portfolio Status
- Cash: $${account.cash.toFixed(2)}
- Positions Value: $${totalPositionsValue.toFixed(2)}
- Total Value: $${totalValue.toFixed(2)}
- Total Return: ${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%

## Current Positions
${positionLines.length > 0 ? positionLines.join("\n") : "  (no positions)"}

## Market Data (current prices)
${quoteLines.join("\n")}

## Recent Trades (last 10)
${tradeLines.length > 0 ? tradeLines.join("\n") : "  (no trades yet)"}
`.trim();
}

const DECISION_SCHEMA = `
You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no extra text) in this exact format:
{
  "decisions": [
    {
      "action": "buy" | "sell" | "hold",
      "symbol": "AAPL",
      "shares": 10,
      "reasoning": "Brief explanation"
    }
  ],
  "market_analysis": "Brief overall market view"
}

Rules:
- You can make 0 to 5 decisions per round
- "hold" means no action (you can omit holds entirely)
- shares must be a positive integer
- You can only sell shares you own
- You can only buy what you can afford with available cash
- No short selling, no margin, no options
- Consider transaction timing and avoid overtrading
- Think about position sizing and diversification
`;

/**
 * Get trading decisions from an AI agent via OpenAI-compatible gateway
 */
export async function getAIDecision(
  agent: Agent,
  account: Account,
  positions: Position[],
  quotes: MarketQuote[],
  recentTrades: Trade[]
): Promise<AIResponse> {
  const context = buildContextPrompt(account, positions, quotes, recentTrades);

  const userPrompt = `
${context}

Based on your strategy and the above portfolio/market data, what trades (if any) should we make right now?

${DECISION_SCHEMA}
`.trim();

  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing AI_BASE_URL or AI_API_KEY");
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: agent.model,
      messages: [
        { role: "system", content: agent.system_prompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI gateway error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const responseText = data.choices?.[0]?.message?.content ?? "{}";

  return parseAIResponse(responseText);
}

/**
 * Parse AI response text into structured decisions.
 * Handles markdown code blocks and malformed JSON gracefully.
 */
export function parseAIResponse(text: string): AIResponse {
  let cleaned = text.trim();

  // Strip markdown code fences if present
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim();
  }

  // Strip any leading/trailing non-JSON text
  const braceStart = cleaned.indexOf("{");
  const braceEnd = cleaned.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    cleaned = cleaned.slice(braceStart, braceEnd + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      market_analysis: parsed.market_analysis ?? "",
    };
  } catch {
    console.error("Failed to parse AI response:", text);
    return { decisions: [], market_analysis: "Failed to parse response" };
  }
}
