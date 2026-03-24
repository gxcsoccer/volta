import { describe, it, expect, vi, beforeEach } from "vitest";
import { capitalFlowTool } from "../tools/capital-flow";

// Mock the longbridge-data module so tests don't require Longbridge credentials
vi.mock("../longbridge-data", () => ({
  isLongbridgeConfigured: vi.fn(),
  getCapitalFlow: vi.fn(),
}));

import { isLongbridgeConfigured, getCapitalFlow } from "../longbridge-data";

const MOCK_FLOW_DATA = {
  symbol: "TSLA.US",
  inflow_series: [
    { timestamp: "2026-03-24T14:00:00.000Z", inflow: 1000000 },
    { timestamp: "2026-03-24T14:05:00.000Z", inflow: 2000000 },
    { timestamp: "2026-03-24T14:10:00.000Z", inflow: -500000 },
  ],
  distribution: {
    inflow_large: 50000000,
    inflow_medium: 20000000,
    inflow_small: 5000000,
    outflow_large: 30000000,
    outflow_medium: 10000000,
    outflow_small: 2000000,
    net_inflow: 33000000, // 75M in - 42M out
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("capitalFlowTool", () => {
  it("has correct metadata", () => {
    expect(capitalFlowTool.id).toBe("capital_flow");
    expect(capitalFlowTool.category).toBe("data");
    expect(capitalFlowTool.parameters.required).toContain("symbol");
  });

  it("returns error when Longbridge is not configured", async () => {
    vi.mocked(isLongbridgeConfigured).mockReturnValue(false);

    const result = JSON.parse(await capitalFlowTool.execute({ symbol: "TSLA.US" }));
    expect(result.error).toContain("Longbridge credentials not configured");
  });

  it("returns formatted capital flow data", async () => {
    vi.mocked(isLongbridgeConfigured).mockReturnValue(true);
    vi.mocked(getCapitalFlow).mockResolvedValueOnce(MOCK_FLOW_DATA);

    const result = JSON.parse(await capitalFlowTool.execute({ symbol: "TSLA.US" }));

    expect(result.symbol).toBe("TSLA.US");
    expect(result.distribution.inflow_large).toBe(50000000);
    expect(result.distribution.outflow_large).toBe(30000000);
    expect(result.distribution.net_inflow).toBe(33000000);
    expect(result.flow_direction).toBe("net inflow (bullish)");
    expect(result.data_points).toBe(3);
  });

  it("shows net outflow direction when net_inflow is negative", async () => {
    vi.mocked(isLongbridgeConfigured).mockReturnValue(true);
    vi.mocked(getCapitalFlow).mockResolvedValueOnce({
      ...MOCK_FLOW_DATA,
      distribution: { ...MOCK_FLOW_DATA.distribution, net_inflow: -5000000 },
    });

    const result = JSON.parse(await capitalFlowTool.execute({ symbol: "TSLA.US" }));
    expect(result.flow_direction).toBe("net outflow (bearish)");
  });

  it("limits recent_flow to last 12 data points", async () => {
    vi.mocked(isLongbridgeConfigured).mockReturnValue(true);

    const longSeries = Array.from({ length: 20 }, (_, i) => ({
      timestamp: new Date(Date.UTC(2026, 2, 24, 14, i * 5)).toISOString(),
      inflow: i * 100000,
    }));

    vi.mocked(getCapitalFlow).mockResolvedValueOnce({
      ...MOCK_FLOW_DATA,
      inflow_series: longSeries,
    });

    const result = JSON.parse(await capitalFlowTool.execute({ symbol: "TSLA.US" }));
    expect(result.recent_flow).toHaveLength(12);
    expect(result.data_points).toBe(20);
  });

  it("formats recent_flow timestamps as HH:MM", async () => {
    vi.mocked(isLongbridgeConfigured).mockReturnValue(true);
    vi.mocked(getCapitalFlow).mockResolvedValueOnce(MOCK_FLOW_DATA);

    const result = JSON.parse(await capitalFlowTool.execute({ symbol: "TSLA.US" }));
    for (const point of result.recent_flow) {
      expect(point.time).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it("uppercases the symbol", async () => {
    vi.mocked(isLongbridgeConfigured).mockReturnValue(true);
    vi.mocked(getCapitalFlow).mockResolvedValueOnce({ ...MOCK_FLOW_DATA, symbol: "TSLA.US" });

    await capitalFlowTool.execute({ symbol: "tsla.us" });
    expect(getCapitalFlow).toHaveBeenCalledWith("TSLA.US");
  });

  it("returns error on API failure", async () => {
    vi.mocked(isLongbridgeConfigured).mockReturnValue(true);
    vi.mocked(getCapitalFlow).mockRejectedValueOnce(new Error("Auth failed"));

    const result = JSON.parse(await capitalFlowTool.execute({ symbol: "TSLA.US" }));
    expect(result.error).toContain("Failed to fetch capital flow");
    expect(result.error).toContain("Auth failed");
  });
});
