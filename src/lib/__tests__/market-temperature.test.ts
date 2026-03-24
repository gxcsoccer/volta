import { describe, it, expect, vi, beforeEach } from "vitest";
import { marketTemperatureTool } from "../tools/market-temperature";

// Mock the longbridge-data module so tests don't require Longbridge credentials
vi.mock("../longbridge-data", () => ({
  isLongbridgeConfigured: vi.fn(),
  getMarketTemperature: vi.fn(),
}));

import { isLongbridgeConfigured, getMarketTemperature } from "../longbridge-data";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("marketTemperatureTool", () => {
  it("has correct metadata", () => {
    expect(marketTemperatureTool.id).toBe("market_temperature");
    expect(marketTemperatureTool.category).toBe("data");
    expect(marketTemperatureTool.parameters.required).toEqual([]);
  });

  it("returns error when Longbridge is not configured", async () => {
    vi.mocked(isLongbridgeConfigured).mockReturnValue(false);

    const result = JSON.parse(await marketTemperatureTool.execute({}));
    expect(result.error).toContain("Longbridge credentials not configured");
  });

  it("returns formatted market temperature for US", async () => {
    vi.mocked(isLongbridgeConfigured).mockReturnValue(true);
    vi.mocked(getMarketTemperature).mockResolvedValueOnce([
      {
        market: "US",
        temperature: 72,
        description: "Greed",
        valuation: 65,
        sentiment: 78,
        timestamp: "2026-03-24T00:00:00.000Z",
      },
    ]);

    const result = JSON.parse(await marketTemperatureTool.execute({ markets: "US" }));

    expect(result.markets).toHaveLength(1);
    expect(result.markets[0].market).toBe("US");
    expect(result.markets[0].temperature).toBe(72);
    expect(result.markets[0].level).toBe("greed");
    expect(result.markets[0].description).toBe("Greed");
  });

  it("classifies temperature levels correctly", async () => {
    vi.mocked(isLongbridgeConfigured).mockReturnValue(true);

    const cases: [number, string][] = [
      [85, "extreme greed"],
      [65, "greed"],
      [50, "neutral"],
      [25, "fear"],
      [10, "extreme fear"],
    ];

    for (const [temp, expectedLevel] of cases) {
      vi.mocked(getMarketTemperature).mockResolvedValueOnce([
        {
          market: "US",
          temperature: temp,
          description: "",
          valuation: 0,
          sentiment: 0,
          timestamp: "2026-03-24T00:00:00.000Z",
        },
      ]);

      const result = JSON.parse(await marketTemperatureTool.execute({ markets: "US" }));
      expect(result.markets[0].level).toBe(expectedLevel);
    }
  });

  it("accepts multiple markets", async () => {
    vi.mocked(isLongbridgeConfigured).mockReturnValue(true);
    vi.mocked(getMarketTemperature).mockResolvedValueOnce([
      { market: "US", temperature: 60, description: "Greed", valuation: 55, sentiment: 62, timestamp: "2026-03-24T00:00:00.000Z" },
      { market: "HK", temperature: 40, description: "Neutral", valuation: 42, sentiment: 38, timestamp: "2026-03-24T00:00:00.000Z" },
    ]);

    const result = JSON.parse(await marketTemperatureTool.execute({ markets: "US,HK" }));
    expect(result.markets).toHaveLength(2);
    expect(result.markets.map((m: { market: string }) => m.market)).toEqual(["US", "HK"]);
    expect(getMarketTemperature).toHaveBeenCalledWith(["US", "HK"]);
  });

  it("defaults to US when no markets arg provided", async () => {
    vi.mocked(isLongbridgeConfigured).mockReturnValue(true);
    vi.mocked(getMarketTemperature).mockResolvedValueOnce([
      { market: "US", temperature: 50, description: "Neutral", valuation: 50, sentiment: 50, timestamp: "2026-03-24T00:00:00.000Z" },
    ]);

    await marketTemperatureTool.execute({});
    expect(getMarketTemperature).toHaveBeenCalledWith(["US"]);
  });

  it("filters out invalid market codes", async () => {
    vi.mocked(isLongbridgeConfigured).mockReturnValue(true);
    vi.mocked(getMarketTemperature).mockResolvedValueOnce([
      { market: "US", temperature: 50, description: "Neutral", valuation: 50, sentiment: 50, timestamp: "2026-03-24T00:00:00.000Z" },
    ]);

    await marketTemperatureTool.execute({ markets: "US,XX,INVALID" });
    expect(getMarketTemperature).toHaveBeenCalledWith(["US"]);
  });

  it("returns error when no data returned", async () => {
    vi.mocked(isLongbridgeConfigured).mockReturnValue(true);
    vi.mocked(getMarketTemperature).mockResolvedValueOnce([]);

    const result = JSON.parse(await marketTemperatureTool.execute({ markets: "US" }));
    expect(result.error).toContain("No data returned");
  });

  it("returns error on API failure", async () => {
    vi.mocked(isLongbridgeConfigured).mockReturnValue(true);
    vi.mocked(getMarketTemperature).mockRejectedValueOnce(new Error("Network timeout"));

    const result = JSON.parse(await marketTemperatureTool.execute({ markets: "US" }));
    expect(result.error).toContain("Failed to fetch market temperature");
    expect(result.error).toContain("Network timeout");
  });
});
