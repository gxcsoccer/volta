import { describe, it, expect } from "vitest";
import { STOCK_POOL } from "../stock-pool";

describe("STOCK_POOL", () => {
  it("contains 100+ symbols", () => {
    expect(STOCK_POOL.length).toBeGreaterThanOrEqual(100);
  });

  it("includes major ETFs", () => {
    expect(STOCK_POOL).toContain("SPY");
    expect(STOCK_POOL).toContain("QQQ");
  });

  it("includes major tech stocks", () => {
    expect(STOCK_POOL).toContain("AAPL");
    expect(STOCK_POOL).toContain("MSFT");
    expect(STOCK_POOL).toContain("NVDA");
    expect(STOCK_POOL).toContain("AMZN");
    expect(STOCK_POOL).toContain("GOOGL");
    expect(STOCK_POOL).toContain("META");
  });

  it("has no duplicates", () => {
    const unique = new Set(STOCK_POOL);
    expect(unique.size).toBe(STOCK_POOL.length);
  });

  it("all symbols are uppercase", () => {
    for (const symbol of STOCK_POOL) {
      expect(symbol).toBe(symbol.toUpperCase());
    }
  });
});
