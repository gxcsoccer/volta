// ============================================================
// Tool: Sector Heatmap (Sector ETF performance)
// ============================================================

import type { ToolDefinition } from "./types";
import { getQuotes } from "../market-data";

// Sector ETFs that represent major market sectors
const SECTOR_ETFS: Record<string, string> = {
  XLK: "Technology",
  XLV: "Healthcare",
  XLF: "Financial",
  XLE: "Energy",
  XLY: "Consumer Discretionary",
  XLP: "Consumer Staples",
  XLI: "Industrials",
  XLU: "Utilities",
  XLB: "Materials",
  XLRE: "Real Estate",
  XLC: "Communication Services",
};

export const sectorHeatmapTool: ToolDefinition = {
  id: "sector_heatmap",
  name: "Sector Heatmap",
  description: "Get today's performance of all 11 S&P 500 sectors via sector ETFs. Shows which sectors are hot or cold.",
  category: "data",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async () => {
    try {
      const symbols = Object.keys(SECTOR_ETFS);
      const quotes = await getQuotes(symbols);

      const sectors = quotes
        .map((q) => ({
          etf: q.symbol,
          sector: SECTOR_ETFS[q.symbol] ?? q.symbol,
          price: q.price,
          change_pct: Math.round(q.change_pct * 100) / 100,
          volume_m: Math.round(q.volume / 1000000 * 10) / 10,
        }))
        .sort((a, b) => b.change_pct - a.change_pct);

      const best = sectors[0];
      const worst = sectors[sectors.length - 1];

      return JSON.stringify({
        sectors,
        summary: {
          strongest: `${best.sector} (${best.change_pct >= 0 ? "+" : ""}${best.change_pct}%)`,
          weakest: `${worst.sector} (${worst.change_pct >= 0 ? "+" : ""}${worst.change_pct}%)`,
          risk_appetite: sectors.filter((s) => s.change_pct > 0).length > 6 ? "risk-on" : "risk-off",
        },
      });
    } catch (err) {
      return JSON.stringify({ error: `Failed to fetch sector data: ${err instanceof Error ? err.message : String(err)}` });
    }
  },
};
