// ============================================================
// Tool: Technical Analysis (RSI, SMA, MACD)
// ============================================================

import type { ToolDefinition } from "./types";
import { getRecentBars } from "../market-data";

/**
 * Calculate Simple Moving Average
 */
function sma(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(0, period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Calculate RSI (Relative Strength Index)
 */
function rsi(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 0; i < period; i++) {
    const change = prices[i] - prices[i + 1]; // prices are newest first
    if (change > 0) gains += change;
    else losses -= change;
  }

  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

/**
 * Calculate MACD (simplified: 12 EMA - 26 EMA approximation using SMA)
 */
function macd(prices: number[]): { macd: number; signal: number; histogram: number } | null {
  const fast = sma(prices, 12);
  const slow = sma(prices, 26);
  if (fast === null || slow === null) return null;

  const macdLine = fast - slow;
  const signalLine = sma(prices, 9) ?? fast; // approximate
  return {
    macd: Math.round(macdLine * 100) / 100,
    signal: Math.round((signalLine - slow) * 100) / 100,
    histogram: Math.round((macdLine - (signalLine - slow)) * 100) / 100,
  };
}

export const technicalAnalysisTool: ToolDefinition = {
  id: "technical_analysis",
  name: "Technical Analysis",
  description: "Calculate RSI, SMA (20/50), and MACD for a given stock symbol using recent price history",
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

    try {
      // Fetch 60 days of daily bars for enough data points
      const bars = await getRecentBars(symbol, 60);

      if (!bars || bars.length < 5) {
        return JSON.stringify({ error: `Insufficient data for ${symbol}` });
      }

      // Close prices (newest first)
      const closes = bars.map((b) => b.c);
      const latest = closes[0];

      const result = {
        symbol,
        latest_price: latest,
        sma_20: sma(closes, 20),
        sma_50: sma(closes, 50),
        rsi_14: rsi(closes, 14) ? Math.round(rsi(closes, 14)!) : null,
        macd: macd(closes),
        trend:
          latest > (sma(closes, 20) ?? 0) && (sma(closes, 20) ?? 0) > (sma(closes, 50) ?? 0)
            ? "bullish"
            : latest < (sma(closes, 20) ?? Infinity) && (sma(closes, 20) ?? Infinity) < (sma(closes, 50) ?? Infinity)
            ? "bearish"
            : "neutral",
        bars_count: bars.length,
      };

      return JSON.stringify(result);
    } catch (err) {
      return JSON.stringify({ error: `Failed to analyze ${symbol}: ${err instanceof Error ? err.message : String(err)}` });
    }
  },
};
