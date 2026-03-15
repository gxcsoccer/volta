// ============================================================
// Tool: Earnings Data (Static fundamental data)
// ============================================================

import type { ToolDefinition } from "./types";

// Static fundamental data for major stocks (updated periodically)
// In production, this would call a real API like Financial Modeling Prep or Alpha Vantage
const FUNDAMENTALS: Record<string, {
  pe_ratio: number;
  forward_pe: number;
  pb_ratio: number;
  dividend_yield: number;
  market_cap_b: number;
  sector: string;
  eps_ttm: number;
  revenue_growth_pct: number;
}> = {
  AAPL: { pe_ratio: 33.2, forward_pe: 30.1, pb_ratio: 52.1, dividend_yield: 0.44, market_cap_b: 3400, sector: "Technology", eps_ttm: 6.73, revenue_growth_pct: 5.0 },
  MSFT: { pe_ratio: 36.5, forward_pe: 32.8, pb_ratio: 13.2, dividend_yield: 0.72, market_cap_b: 3100, sector: "Technology", eps_ttm: 11.80, revenue_growth_pct: 16.0 },
  NVDA: { pe_ratio: 65.3, forward_pe: 38.5, pb_ratio: 50.8, dividend_yield: 0.03, market_cap_b: 3200, sector: "Technology", eps_ttm: 2.13, revenue_growth_pct: 122.0 },
  GOOGL: { pe_ratio: 23.8, forward_pe: 20.5, pb_ratio: 7.4, dividend_yield: 0.46, market_cap_b: 2100, sector: "Technology", eps_ttm: 7.54, revenue_growth_pct: 14.0 },
  AMZN: { pe_ratio: 42.1, forward_pe: 33.2, pb_ratio: 8.5, dividend_yield: 0.0, market_cap_b: 2000, sector: "Consumer Discretionary", eps_ttm: 4.67, revenue_growth_pct: 11.0 },
  META: { pe_ratio: 27.3, forward_pe: 23.1, pb_ratio: 8.9, dividend_yield: 0.35, market_cap_b: 1500, sector: "Technology", eps_ttm: 21.29, revenue_growth_pct: 22.0 },
  TSLA: { pe_ratio: 85.2, forward_pe: 72.3, pb_ratio: 15.3, dividend_yield: 0.0, market_cap_b: 800, sector: "Consumer Discretionary", eps_ttm: 3.08, revenue_growth_pct: -1.0 },
  JPM: { pe_ratio: 12.5, forward_pe: 11.8, pb_ratio: 2.1, dividend_yield: 2.1, market_cap_b: 680, sector: "Financial", eps_ttm: 19.75, revenue_growth_pct: 12.0 },
  JNJ: { pe_ratio: 15.8, forward_pe: 14.2, pb_ratio: 5.6, dividend_yield: 3.2, market_cap_b: 380, sector: "Healthcare", eps_ttm: 9.80, revenue_growth_pct: 4.0 },
  XOM: { pe_ratio: 14.2, forward_pe: 13.5, pb_ratio: 2.0, dividend_yield: 3.4, market_cap_b: 480, sector: "Energy", eps_ttm: 7.84, revenue_growth_pct: -5.0 },
  SPY: { pe_ratio: 24.5, forward_pe: 21.8, pb_ratio: 4.6, dividend_yield: 1.3, market_cap_b: 0, sector: "Index", eps_ttm: 0, revenue_growth_pct: 0 },
  KO: { pe_ratio: 26.1, forward_pe: 23.5, pb_ratio: 11.2, dividend_yield: 2.8, market_cap_b: 300, sector: "Consumer Staples", eps_ttm: 2.69, revenue_growth_pct: 3.0 },
  PG: { pe_ratio: 27.8, forward_pe: 24.3, pb_ratio: 8.1, dividend_yield: 2.3, market_cap_b: 410, sector: "Consumer Staples", eps_ttm: 6.21, revenue_growth_pct: 2.0 },
  WMT: { pe_ratio: 35.2, forward_pe: 29.1, pb_ratio: 7.2, dividend_yield: 1.1, market_cap_b: 570, sector: "Consumer Staples", eps_ttm: 2.41, revenue_growth_pct: 5.0 },
  AMD: { pe_ratio: 48.5, forward_pe: 28.3, pb_ratio: 4.3, dividend_yield: 0.0, market_cap_b: 220, sector: "Technology", eps_ttm: 3.31, revenue_growth_pct: 18.0 },
};

export const earningsDataTool: ToolDefinition = {
  id: "earnings_data",
  name: "Earnings & Fundamentals",
  description: "Get fundamental data for a stock: P/E ratio, P/B ratio, dividend yield, market cap, sector, EPS, and revenue growth",
  category: "analysis",
  parameters: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Stock ticker symbol (e.g., AAPL)" },
    },
    required: ["symbol"],
  },
  execute: async (args) => {
    const symbol = String(args.symbol).toUpperCase();
    const data = FUNDAMENTALS[symbol];

    if (!data) {
      return JSON.stringify({
        symbol,
        error: `No fundamental data available for ${symbol}. Data is available for: ${Object.keys(FUNDAMENTALS).join(", ")}`,
      });
    }

    return JSON.stringify({ symbol, ...data });
  },
};
