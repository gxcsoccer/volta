import { describe, it, expect, vi } from "vitest";
import { technicalAnalysisTool } from "../tools/technical-analysis";

// Mock market-data to avoid real API calls
vi.mock("../market-data", () => ({
  getRecentBars: vi.fn(),
}));

import { getRecentBars } from "../market-data";

describe("technicalAnalysisTool", () => {
  it("has correct metadata", () => {
    expect(technicalAnalysisTool.id).toBe("technical_analysis");
    expect(technicalAnalysisTool.parameters.required).toContain("symbol");
  });

  it("returns error for insufficient data", async () => {
    vi.mocked(getRecentBars).mockResolvedValue([]);
    const result = JSON.parse(await technicalAnalysisTool.execute({ symbol: "AAPL" }));
    expect(result.error).toContain("Insufficient data");
  });

  it("calculates indicators for valid data", async () => {
    // Generate 60 days of descending prices (bearish)
    const bars = Array.from({ length: 60 }, (_, i) => ({
      t: `2026-01-${String(60 - i).padStart(2, "0")}T00:00:00Z`,
      o: 200 - i,
      h: 202 - i,
      l: 198 - i,
      c: 200 - i, // newest first: 200, 199, 198, ...
      v: 1000000,
    }));

    vi.mocked(getRecentBars).mockResolvedValue(bars);
    const result = JSON.parse(await technicalAnalysisTool.execute({ symbol: "AAPL" }));

    expect(result.symbol).toBe("AAPL");
    expect(result.latest_price).toBe(200);
    expect(result.sma_20).toBeTypeOf("number");
    expect(result.sma_50).toBeTypeOf("number");
    expect(result.rsi_14).toBeTypeOf("number");
    expect(result.bars_count).toBe(60);
  });

  it("detects bullish trend", async () => {
    // Generate ascending prices (bullish)
    const bars = Array.from({ length: 60 }, (_, i) => ({
      t: `2026-01-${String(60 - i).padStart(2, "0")}T00:00:00Z`,
      o: 100 + i * 2,
      h: 102 + i * 2,
      l: 98 + i * 2,
      c: 100 + i * 2, // newest = 100, 102, 104... (ascending from oldest)
      v: 1000000,
    }));
    // Reverse so newest first (highest prices first)
    bars.reverse();

    vi.mocked(getRecentBars).mockResolvedValue(bars);
    const result = JSON.parse(await technicalAnalysisTool.execute({ symbol: "AAPL" }));

    // Latest (218) > SMA20 > SMA50 → bullish
    expect(result.trend).toBe("bullish");
  });

  it("handles API error gracefully", async () => {
    vi.mocked(getRecentBars).mockRejectedValue(new Error("API down"));
    const result = JSON.parse(await technicalAnalysisTool.execute({ symbol: "AAPL" }));
    expect(result.error).toContain("Failed to analyze");
    expect(result.error).toContain("API down");
  });

  it("uppercases symbol", async () => {
    vi.mocked(getRecentBars).mockResolvedValue([]);
    await technicalAnalysisTool.execute({ symbol: "aapl" });
    expect(getRecentBars).toHaveBeenCalledWith("AAPL", 60);
  });
});
