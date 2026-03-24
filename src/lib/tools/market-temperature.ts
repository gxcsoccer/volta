// ============================================================
// Tool: Market Temperature (Longbridge API)
// Returns a 0–100 sentiment index for each requested market.
// Source: Longbridge OpenAPI via the longport SDK.
// ============================================================

import type { ToolDefinition } from "./types";
import { isLongbridgeConfigured, getMarketTemperature } from "../longbridge-data";

const VALID_MARKETS = ["US", "HK", "CN", "SG"] as const;

export const marketTemperatureTool: ToolDefinition = {
  id: "market_temperature",
  name: "Market Temperature",
  description:
    "Get the market sentiment temperature index (0 = extreme fear, 100 = extreme greed) " +
    "for one or more markets via Longbridge. Supported markets: US, HK, CN, SG.",
  category: "data",
  parameters: {
    type: "object",
    properties: {
      markets: {
        type: "string",
        description:
          'Comma-separated list of market codes to query, e.g. "US,HK" or just "US". ' +
          "Valid values: US, HK, CN, SG. Defaults to US.",
      },
    },
    required: [],
  },
  execute: async (args) => {
    if (!isLongbridgeConfigured()) {
      return JSON.stringify({
        error:
          "Longbridge credentials not configured. " +
          "Set LONGPORT_APP_KEY, LONGPORT_APP_SECRET, and LONGPORT_ACCESS_TOKEN.",
      });
    }

    const raw = args.markets ? String(args.markets) : "US";
    const requested = raw
      .split(",")
      .map((m) => m.trim().toUpperCase())
      .filter((m): m is typeof VALID_MARKETS[number] =>
        (VALID_MARKETS as readonly string[]).includes(m)
      );

    const markets = requested.length > 0 ? requested : ["US"];

    try {
      const results = await getMarketTemperature(markets);

      if (results.length === 0) {
        return JSON.stringify({ error: "No data returned for the requested markets." });
      }

      const formatted = results.map((r) => ({
        market: r.market,
        temperature: r.temperature,
        level:
          r.temperature >= 80
            ? "extreme greed"
            : r.temperature >= 60
            ? "greed"
            : r.temperature >= 40
            ? "neutral"
            : r.temperature >= 20
            ? "fear"
            : "extreme fear",
        description: r.description,
        valuation: r.valuation,
        sentiment: r.sentiment,
        timestamp: r.timestamp,
      }));

      return JSON.stringify({ markets: formatted });
    } catch (err) {
      return JSON.stringify({
        error: `Failed to fetch market temperature: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  },
};
