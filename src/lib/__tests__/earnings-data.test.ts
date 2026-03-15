import { describe, it, expect } from "vitest";
import { earningsDataTool } from "../tools/earnings-data";

describe("earningsDataTool", () => {
  it("returns fundamental data for known symbol", async () => {
    const result = JSON.parse(await earningsDataTool.execute({ symbol: "AAPL" }));
    expect(result.symbol).toBe("AAPL");
    expect(result.pe_ratio).toBeTypeOf("number");
    expect(result.dividend_yield).toBeTypeOf("number");
    expect(result.sector).toBe("Technology");
    expect(result.market_cap_b).toBeGreaterThan(0);
  });

  it("returns error for unknown symbol", async () => {
    const result = JSON.parse(await earningsDataTool.execute({ symbol: "ZZZZ" }));
    expect(result.error).toContain("No fundamental data available");
    expect(result.error).toContain("AAPL"); // lists available symbols
  });

  it("uppercases symbol", async () => {
    const result = JSON.parse(await earningsDataTool.execute({ symbol: "aapl" }));
    expect(result.symbol).toBe("AAPL");
    expect(result.pe_ratio).toBeTypeOf("number");
  });

  it("has correct tool metadata", () => {
    expect(earningsDataTool.id).toBe("earnings_data");
    expect(earningsDataTool.category).toBe("analysis");
    expect(earningsDataTool.parameters.required).toContain("symbol");
  });
});
