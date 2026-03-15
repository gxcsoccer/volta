// ============================================================
// Tool: Historical Bars (OHLCV K-line data)
// ============================================================

import type { ToolDefinition } from "./types";
import { getRecentBars } from "../market-data";

export const historicalBarsTool: ToolDefinition = {
  id: "historical_bars",
  name: "Historical Bars",
  description: "Get recent daily OHLCV (Open/High/Low/Close/Volume) bars for a stock. Returns up to 20 days of data.",
  category: "data",
  parameters: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Stock ticker symbol (e.g., AAPL)" },
      days: { type: "string", description: "Number of days to fetch (1-20, default 10)" },
    },
    required: ["symbol"],
  },
  execute: async (args) => {
    const symbol = String(args.symbol).toUpperCase();
    const days = Math.min(Math.max(Number(args.days) || 10, 1), 20);

    try {
      const bars = await getRecentBars(symbol, days);

      if (!bars || bars.length === 0) {
        return JSON.stringify({ error: `No bar data for ${symbol}` });
      }

      const formatted = bars.map((b) => ({
        date: b.t.slice(0, 10),
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v,
        range_pct: b.h > 0 ? Math.round(((b.h - b.l) / b.l) * 10000) / 100 : 0,
      }));

      return JSON.stringify({ symbol, bars: formatted });
    } catch (err) {
      return JSON.stringify({ error: `Failed to fetch bars for ${symbol}: ${err instanceof Error ? err.message : String(err)}` });
    }
  },
};
