import { describe, it, expect, vi, beforeEach } from "vitest";
import { historicalBarsTool } from "../tools/historical-bars";

vi.mock("../market-data", () => ({
  getRecentBars: vi.fn(),
}));

import { getRecentBars } from "../market-data";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("historicalBarsTool", () => {
  it("has correct metadata", () => {
    expect(historicalBarsTool.id).toBe("historical_bars");
    expect(historicalBarsTool.category).toBe("data");
    expect(historicalBarsTool.parameters.required).toContain("symbol");
  });

  it("returns formatted bars for valid data", async () => {
    vi.mocked(getRecentBars).mockResolvedValueOnce([
      { t: "2026-03-15T00:00:00Z", o: 150, h: 155, l: 148, c: 153, v: 80000000 },
      { t: "2026-03-14T00:00:00Z", o: 148, h: 152, l: 147, c: 150, v: 60000000 },
    ]);

    const result = JSON.parse(await historicalBarsTool.execute({ symbol: "AAPL" }));

    expect(result.symbol).toBe("AAPL");
    expect(result.bars).toHaveLength(2);
    expect(result.bars[0].date).toBe("2026-03-15");
    expect(result.bars[0].open).toBe(150);
    expect(result.bars[0].high).toBe(155);
    expect(result.bars[0].low).toBe(148);
    expect(result.bars[0].close).toBe(153);
    expect(result.bars[0].volume).toBe(80000000);
    expect(result.bars[0].range_pct).toBeTypeOf("number");
  });

  it("returns error when no data", async () => {
    vi.mocked(getRecentBars).mockResolvedValueOnce([]);

    const result = JSON.parse(await historicalBarsTool.execute({ symbol: "ZZZZ" }));
    expect(result.error).toContain("No bar data");
  });

  it("defaults to 10 days", async () => {
    vi.mocked(getRecentBars).mockResolvedValueOnce([]);

    await historicalBarsTool.execute({ symbol: "AAPL" });
    expect(getRecentBars).toHaveBeenCalledWith("AAPL", 10);
  });

  it("respects custom days parameter", async () => {
    vi.mocked(getRecentBars).mockResolvedValueOnce([]);

    await historicalBarsTool.execute({ symbol: "AAPL", days: "5" });
    expect(getRecentBars).toHaveBeenCalledWith("AAPL", 5);
  });

  it("clamps days to 1-20 range", async () => {
    vi.mocked(getRecentBars).mockResolvedValueOnce([]);
    await historicalBarsTool.execute({ symbol: "AAPL", days: "50" });
    expect(getRecentBars).toHaveBeenCalledWith("AAPL", 20);

    vi.mocked(getRecentBars).mockResolvedValueOnce([]);
    await historicalBarsTool.execute({ symbol: "AAPL", days: "-5" });
    expect(getRecentBars).toHaveBeenCalledWith("AAPL", 1);
  });

  it("uppercases symbol", async () => {
    vi.mocked(getRecentBars).mockResolvedValueOnce([]);

    await historicalBarsTool.execute({ symbol: "msft" });
    expect(getRecentBars).toHaveBeenCalledWith("MSFT", 10);
  });

  it("handles API error gracefully", async () => {
    vi.mocked(getRecentBars).mockRejectedValueOnce(new Error("Rate limited"));

    const result = JSON.parse(await historicalBarsTool.execute({ symbol: "AAPL" }));
    expect(result.error).toContain("Failed to fetch bars");
    expect(result.error).toContain("Rate limited");
  });

  it("calculates range_pct correctly", async () => {
    vi.mocked(getRecentBars).mockResolvedValueOnce([
      { t: "2026-03-15T00:00:00Z", o: 100, h: 110, l: 100, c: 105, v: 1000000 },
    ]);

    const result = JSON.parse(await historicalBarsTool.execute({ symbol: "AAPL" }));
    // (110 - 100) / 100 * 100 = 10%
    expect(result.bars[0].range_pct).toBe(10);
  });
});
