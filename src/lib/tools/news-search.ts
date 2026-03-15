// ============================================================
// Tool: News Search (Alpaca News API)
// ============================================================

import type { ToolDefinition } from "./types";

const ALPACA_DATA_URL = "https://data.alpaca.markets";

function getHeaders() {
  return {
    "APCA-API-KEY-ID": process.env.ALPACA_API_KEY!,
    "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET!,
    Accept: "application/json",
  };
}

export const newsSearchTool: ToolDefinition = {
  id: "news_search",
  name: "News Search",
  description: "Search recent financial news for a stock symbol. Returns headlines, summaries, and sentiment from the last 3 days.",
  category: "data",
  parameters: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Stock ticker symbol (e.g., AAPL)" },
    },
    required: ["symbol"],
  },
  execute: async (args) => {
    const symbol = String(args.symbol).toUpperCase();

    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 3);

      const params = new URLSearchParams({
        symbols: symbol,
        start: start.toISOString(),
        end: end.toISOString(),
        limit: "5",
        sort: "desc",
      });

      const res = await fetch(`${ALPACA_DATA_URL}/v1beta1/news?${params}`, {
        headers: getHeaders(),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        return JSON.stringify({ error: `News API error: ${res.status}` });
      }

      const data = await res.json();
      const news = (data.news ?? []).map((n: {
        headline: string;
        summary: string;
        created_at: string;
        source: string;
      }) => ({
        headline: n.headline,
        summary: n.summary?.slice(0, 200) ?? "",
        date: n.created_at?.slice(0, 10) ?? "",
        source: n.source,
      }));

      return JSON.stringify({ symbol, news, count: news.length });
    } catch (err) {
      return JSON.stringify({ error: `Failed to fetch news for ${symbol}: ${err instanceof Error ? err.message : String(err)}` });
    }
  },
};
