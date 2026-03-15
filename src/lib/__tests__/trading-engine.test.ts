import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateFees,
  applySlippage,
  validateTrade,
  executeTrade,
} from "../trading-engine";
import type { Account, Position, MarketQuote, TradeDecision } from "../types";

// ============================================================
// Test Helpers
// ============================================================

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    agent_id: "agent-1",
    cash: 100000,
    initial_capital: 100000,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    id: "pos-1",
    account_id: "acc-1",
    symbol: "AAPL",
    shares: 100,
    avg_cost: 150,
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeQuote(overrides: Partial<MarketQuote> = {}): MarketQuote {
  return {
    symbol: "AAPL",
    price: 155,
    prev_close: 150,
    change_pct: 3.33,
    volume: 50000000,
    ...overrides,
  };
}

function makeQuoteMap(quotes: MarketQuote[]): Map<string, MarketQuote> {
  return new Map(quotes.map((q) => [q.symbol, q]));
}

// ============================================================
// calculateFees
// ============================================================

describe("calculateFees", () => {
  it("returns 0 for buy orders", () => {
    expect(calculateFees("buy", 100, 150)).toBe(0);
  });

  it("returns 0 for buy regardless of amount", () => {
    expect(calculateFees("buy", 10000, 500)).toBe(0);
  });

  it("calculates SEC + TAF fees for sell orders", () => {
    const fee = calculateFees("sell", 100, 150);
    // proceeds = 15000
    // SEC: ceil(15000 * 0.00000278 * 100) / 100 = ceil(4.17) / 100 = 0.05
    // TAF: min(100 * 0.000166, 8.3) = 0.0166
    // total: round((0.05 + 0.0166) * 100) / 100 = 0.07
    expect(fee).toBe(0.07);
  });

  it("caps TAF fee at $8.30 for large orders", () => {
    // 100000 shares * 0.000166 = 16.6 -> capped at 8.3
    const fee = calculateFees("sell", 100000, 100);
    // proceeds = 10,000,000
    // SEC: ceil(10000000 * 0.00000278 * 100) / 100 = ceil(2780) / 100 = 27.80
    // TAF: min(16.6, 8.3) = 8.3
    // total: round((27.80 + 8.3) * 100) / 100 = 36.10
    expect(fee).toBe(36.1);
  });

  it("handles small sell orders", () => {
    const fee = calculateFees("sell", 1, 10);
    // proceeds = 10
    // SEC: ceil(10 * 0.00000278 * 100) / 100 = ceil(0.00278) / 100 = 0.01
    // TAF: min(0.000166, 8.3) = 0.000166
    // total: round((0.01 + 0.000166) * 100) / 100 = 0.01
    expect(fee).toBe(0.01);
  });
});

// ============================================================
// applySlippage
// ============================================================

describe("applySlippage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("increases price for buy orders (slippage works against buyer)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // 0.025% slippage
    const result = applySlippage(100, "buy");
    expect(result).toBeGreaterThan(100);
    expect(result).toBeLessThanOrEqual(100.05); // max 0.05%
  });

  it("decreases price for sell orders (slippage works against seller)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = applySlippage(100, "sell");
    expect(result).toBeLessThan(100);
    expect(result).toBeGreaterThanOrEqual(99.95);
  });

  it("returns exact price when random is 0 (no slippage)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(applySlippage(100, "buy")).toBe(100);
    expect(applySlippage(100, "sell")).toBe(100);
  });

  it("applies maximum slippage when random is ~1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const buyPrice = applySlippage(100, "buy");
    expect(buyPrice).toBeCloseTo(100.05, 1);

    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const sellPrice = applySlippage(100, "sell");
    expect(sellPrice).toBeCloseTo(99.95, 1);
  });

  it("rounds to 2 decimal places", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.333);
    const result = applySlippage(123.456, "buy");
    const decimals = result.toString().split(".")[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});

// ============================================================
// validateTrade
// ============================================================

describe("validateTrade", () => {
  const defaultAccount = makeAccount({ cash: 50000 });
  const defaultPositions = [makePosition({ symbol: "AAPL", shares: 100 })];
  const defaultQuotes = makeQuoteMap([makeQuote({ symbol: "AAPL", price: 155 })]);

  it("validates hold action as always valid", () => {
    const decision: TradeDecision = {
      action: "hold",
      symbol: "AAPL",
      shares: 0,
      reasoning: "wait",
    };
    const result = validateTrade(decision, defaultAccount, [], new Map());
    expect(result.valid).toBe(true);
  });

  it("rejects buy when no market data available", () => {
    const decision: TradeDecision = {
      action: "buy",
      symbol: "UNKNOWN",
      shares: 10,
      reasoning: "test",
    };
    const result = validateTrade(decision, defaultAccount, [], defaultQuotes);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("No market data");
  });

  it("rejects buy when price is 0", () => {
    const quotes = makeQuoteMap([makeQuote({ symbol: "AAPL", price: 0 })]);
    const decision: TradeDecision = {
      action: "buy",
      symbol: "AAPL",
      shares: 10,
      reasoning: "test",
    };
    const result = validateTrade(decision, defaultAccount, [], quotes);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("No market data");
  });

  it("rejects negative shares", () => {
    const decision: TradeDecision = {
      action: "buy",
      symbol: "AAPL",
      shares: -5,
      reasoning: "test",
    };
    const result = validateTrade(decision, defaultAccount, [], defaultQuotes);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("positive integer");
  });

  it("rejects fractional shares", () => {
    const decision: TradeDecision = {
      action: "buy",
      symbol: "AAPL",
      shares: 10.5,
      reasoning: "test",
    };
    const result = validateTrade(decision, defaultAccount, [], defaultQuotes);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("positive integer");
  });

  it("rejects zero shares", () => {
    const decision: TradeDecision = {
      action: "buy",
      symbol: "AAPL",
      shares: 0,
      reasoning: "test",
    };
    const result = validateTrade(decision, defaultAccount, [], defaultQuotes);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("positive integer");
  });

  // --- Buy validation ---

  it("allows buy when sufficient cash", () => {
    const decision: TradeDecision = {
      action: "buy",
      symbol: "AAPL",
      shares: 10,
      reasoning: "test",
    };
    // 10 * 155 = 1550, account has 50000
    const result = validateTrade(decision, defaultAccount, [], defaultQuotes);
    expect(result.valid).toBe(true);
  });

  it("allows buy spending all cash exactly", () => {
    const account = makeAccount({ cash: 1550 });
    const decision: TradeDecision = {
      action: "buy",
      symbol: "AAPL",
      shares: 10,
      reasoning: "test",
    };
    const result = validateTrade(decision, account, [], defaultQuotes);
    expect(result.valid).toBe(true);
  });

  it("rejects buy with insufficient cash", () => {
    const account = makeAccount({ cash: 1000 });
    const decision: TradeDecision = {
      action: "buy",
      symbol: "AAPL",
      shares: 10,
      reasoning: "test",
    };
    const result = validateTrade(decision, account, [], defaultQuotes);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Insufficient cash");
    expect(result.error).toContain("Max buyable: 6 shares");
  });

  // --- Sell validation ---

  it("allows sell when sufficient shares held", () => {
    const decision: TradeDecision = {
      action: "sell",
      symbol: "AAPL",
      shares: 50,
      reasoning: "test",
    };
    const result = validateTrade(
      decision,
      defaultAccount,
      defaultPositions,
      defaultQuotes
    );
    expect(result.valid).toBe(true);
  });

  it("allows sell of all shares", () => {
    const decision: TradeDecision = {
      action: "sell",
      symbol: "AAPL",
      shares: 100,
      reasoning: "test",
    };
    const result = validateTrade(
      decision,
      defaultAccount,
      defaultPositions,
      defaultQuotes
    );
    expect(result.valid).toBe(true);
  });

  it("rejects sell with insufficient shares", () => {
    const decision: TradeDecision = {
      action: "sell",
      symbol: "AAPL",
      shares: 150,
      reasoning: "test",
    };
    const result = validateTrade(
      decision,
      defaultAccount,
      defaultPositions,
      defaultQuotes
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Insufficient shares");
    expect(result.error).toContain("hold 100");
  });

  it("rejects sell of stock not held", () => {
    const decision: TradeDecision = {
      action: "sell",
      symbol: "MSFT",
      shares: 10,
      reasoning: "test",
    };
    const quotes = makeQuoteMap([
      makeQuote({ symbol: "AAPL" }),
      makeQuote({ symbol: "MSFT", price: 400 }),
    ]);
    const result = validateTrade(
      decision,
      defaultAccount,
      defaultPositions,
      quotes
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("hold 0");
  });

  // --- Symbol case handling ---

  it("handles lowercase symbols", () => {
    const decision: TradeDecision = {
      action: "buy",
      symbol: "aapl",
      shares: 10,
      reasoning: "test",
    };
    const result = validateTrade(decision, defaultAccount, [], defaultQuotes);
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// executeTrade (integration with mocked DB)
// ============================================================

describe("executeTrade", () => {
  function mockDb() {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    const rpcFn = vi.fn().mockResolvedValue({ error: null });
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    return {
      from: vi.fn().mockReturnValue({
        insert: insertFn,
        select: selectChain.select,
        eq: selectChain.eq,
        single: selectChain.single,
      }),
      rpc: rpcFn,
      _insertFn: insertFn,
      _rpcFn: rpcFn,
    };
  }

  it("executes a buy trade and returns success", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // no slippage
    const db = mockDb();

    const result = await executeTrade(
      db as never,
      "acc-1",
      { action: "buy", symbol: "AAPL", shares: 10, reasoning: "test" },
      makeQuote({ symbol: "AAPL", price: 150 }),
      "test buy"
    );

    expect(result.success).toBe(true);
    expect(result.side).toBe("buy");
    expect(result.shares).toBe(10);
    expect(result.price).toBe(150);
    expect(result.fee).toBe(0); // buy has no fees
    expect(result.total).toBe(1500);
    vi.restoreAllMocks();
  });

  it("executes a sell trade with fees", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const db = mockDb();
    // Mock position lookup for sell: from("positions").select().eq().eq().single()
    const positionChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "pos-1", shares: 100, avg_cost: 140, symbol: "AAPL" },
              error: null,
            }),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    };

    const origFrom = db.from;
    let posCallCount = 0;
    db.from = vi.fn().mockImplementation((table: string) => {
      if (table === "positions") {
        posCallCount++;
        return positionChain;
      }
      return origFrom(table);
    });

    const result = await executeTrade(
      db as never,
      "acc-1",
      { action: "sell", symbol: "AAPL", shares: 100, reasoning: "test" },
      makeQuote({ symbol: "AAPL", price: 150 }),
      "test sell"
    );

    expect(result.success).toBe(true);
    expect(result.side).toBe("sell");
    expect(result.fee).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  it("returns error when DB insert fails", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const db = mockDb();
    db._insertFn.mockResolvedValue({ error: { message: "DB error" } });

    const result = await executeTrade(
      db as never,
      "acc-1",
      { action: "buy", symbol: "AAPL", shares: 10, reasoning: "test" },
      makeQuote({ symbol: "AAPL", price: 150 }),
      "test"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    vi.restoreAllMocks();
  });
});
