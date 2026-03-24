// ============================================================
// Tool: Capital Flow (Longbridge API)
// Returns intraday capital flow time series and distribution
// snapshot (large / medium / small money in vs out) for a symbol.
// Source: Longbridge OpenAPI via the longport SDK.
// ============================================================

import type { ToolDefinition } from "./types";
import { isLongbridgeConfigured, getCapitalFlow } from "../longbridge-data";

export const capitalFlowTool: ToolDefinition = {
  id: "capital_flow",
  name: "Capital Flow",
  description:
    "Get intraday capital flow and distribution for a stock: how much large, medium, and small " +
    "money is flowing in vs out today. Useful for detecting institutional buying or selling. " +
    "Symbol must include market suffix, e.g. TSLA.US, 700.HK, 600519.SH.",
  category: "data",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description:
          "Stock symbol with market suffix, e.g. TSLA.US, 700.HK, 600519.SH",
      },
    },
    required: ["symbol"],
  },
  execute: async (args) => {
    if (!isLongbridgeConfigured()) {
      return JSON.stringify({
        error:
          "Longbridge credentials not configured. " +
          "Set LONGPORT_APP_KEY, LONGPORT_APP_SECRET, and LONGPORT_ACCESS_TOKEN.",
      });
    }

    const symbol = String(args.symbol).toUpperCase();

    try {
      const data = await getCapitalFlow(symbol);

      const dist = data.distribution;

      // Summarise the inflow series into recent 5-minute buckets (last 12 points)
      const recentFlow = data.inflow_series.slice(-12).map((p) => ({
        time: p.timestamp.slice(11, 16), // HH:MM
        inflow: Math.round(p.inflow),
      }));

      const netInflow = dist.net_inflow;

      return JSON.stringify({
        symbol,
        distribution: {
          inflow_large: Math.round(dist.inflow_large),
          inflow_medium: Math.round(dist.inflow_medium),
          inflow_small: Math.round(dist.inflow_small),
          outflow_large: Math.round(dist.outflow_large),
          outflow_medium: Math.round(dist.outflow_medium),
          outflow_small: Math.round(dist.outflow_small),
          net_inflow: Math.round(netInflow),
        },
        flow_direction:
          netInflow > 0 ? "net inflow (bullish)" : "net outflow (bearish)",
        recent_flow: recentFlow,
        data_points: data.inflow_series.length,
      });
    } catch (err) {
      return JSON.stringify({
        error: `Failed to fetch capital flow for ${symbol}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  },
};
