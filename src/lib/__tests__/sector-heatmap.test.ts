import { describe, it, expect, vi, beforeEach } from "vitest";
import { sectorHeatmapTool } from "../tools/sector-heatmap";

vi.mock("../market-data", () => ({
  getQuotes: vi.fn(),
}));

import { getQuotes } from "../market-data";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sectorHeatmapTool", () => {
  it("has correct metadata", () => {
    expect(sectorHeatmapTool.id).toBe("sector_heatmap");
    expect(sectorHeatmapTool.category).toBe("data");
    expect(sectorHeatmapTool.parameters.required).toEqual([]);
  });

  it("returns sorted sector data with summary", async () => {
    vi.mocked(getQuotes).mockResolvedValueOnce([
      { symbol: "XLK", price: 200, prev_close: 198, change_pct: 1.01, volume: 50000000 },
      { symbol: "XLV", price: 140, prev_close: 141, change_pct: -0.71, volume: 30000000 },
      { symbol: "XLF", price: 42, prev_close: 41.5, change_pct: 1.2, volume: 60000000 },
      { symbol: "XLE", price: 85, prev_close: 86, change_pct: -1.16, volume: 20000000 },
    ]);

    const result = JSON.parse(await sectorHeatmapTool.execute({}));

    expect(result.sectors).toHaveLength(4);
    // Should be sorted by change_pct descending
    expect(result.sectors[0].change_pct).toBeGreaterThanOrEqual(result.sectors[1].change_pct);
    expect(result.sectors[0].sector).toBe("Financial"); // +1.2% is highest

    expect(result.summary.strongest).toContain("Financial");
    expect(result.summary.weakest).toContain("Energy");
  });

  it("detects risk-on when majority of sectors positive", async () => {
    vi.mocked(getQuotes).mockResolvedValueOnce(
      ["XLK", "XLV", "XLF", "XLE", "XLY", "XLP", "XLI", "XLU", "XLB", "XLRE", "XLC"].map(
        (symbol, i) => ({
          symbol,
          price: 100 + i,
          prev_close: 100,
          change_pct: i < 8 ? 0.5 : -0.3, // 8 positive, 3 negative
          volume: 10000000,
        })
      )
    );

    const result = JSON.parse(await sectorHeatmapTool.execute({}));
    expect(result.summary.risk_appetite).toBe("risk-on");
  });

  it("detects risk-off when majority of sectors negative", async () => {
    vi.mocked(getQuotes).mockResolvedValueOnce(
      ["XLK", "XLV", "XLF", "XLE", "XLY", "XLP", "XLI", "XLU", "XLB", "XLRE", "XLC"].map(
        (symbol, i) => ({
          symbol,
          price: 100,
          prev_close: 100,
          change_pct: i < 3 ? 0.5 : -0.8, // 3 positive, 8 negative
          volume: 10000000,
        })
      )
    );

    const result = JSON.parse(await sectorHeatmapTool.execute({}));
    expect(result.summary.risk_appetite).toBe("risk-off");
  });

  it("returns error on API failure", async () => {
    vi.mocked(getQuotes).mockRejectedValueOnce(new Error("Alpaca down"));

    const result = JSON.parse(await sectorHeatmapTool.execute({}));
    expect(result.error).toContain("Failed to fetch sector data");
    expect(result.error).toContain("Alpaca down");
  });

  it("maps ETF symbols to sector names", async () => {
    vi.mocked(getQuotes).mockResolvedValueOnce([
      { symbol: "XLK", price: 200, prev_close: 198, change_pct: 1.0, volume: 50000000 },
    ]);

    const result = JSON.parse(await sectorHeatmapTool.execute({}));
    expect(result.sectors[0].sector).toBe("Technology");
    expect(result.sectors[0].etf).toBe("XLK");
  });

  it("includes volume in millions", async () => {
    vi.mocked(getQuotes).mockResolvedValueOnce([
      { symbol: "XLK", price: 200, prev_close: 198, change_pct: 1.0, volume: 45600000 },
    ]);

    const result = JSON.parse(await sectorHeatmapTool.execute({}));
    expect(result.sectors[0].volume_m).toBe(45.6);
  });
});
