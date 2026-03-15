import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseAIResponse, buildContextPrompt } from "../ai-decision";
import type { Account, Position, MarketQuote, Trade } from "../types";

// ============================================================
// Test Helpers
// ============================================================

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    agent_id: "agent-1",
    cash: 50000,
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

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "trade-1",
    account_id: "acc-1",
    symbol: "AAPL",
    side: "buy",
    shares: 10,
    price: 150,
    total: 1500,
    fee: 0,
    reasoning: "test",
    created_at: "2026-03-15T10:30:00Z",
    ...overrides,
  };
}

// ============================================================
// parseAIResponse
// ============================================================

describe("parseAIResponse", () => {
  it("parses valid JSON response", () => {
    const input = JSON.stringify({
      decisions: [
        { action: "buy", symbol: "AAPL", shares: 10, reasoning: "Good value" },
      ],
      market_analysis: "Bullish",
    });

    const result = parseAIResponse(input);
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0].action).toBe("buy");
    expect(result.decisions[0].symbol).toBe("AAPL");
    expect(result.decisions[0].shares).toBe(10);
    expect(result.market_analysis).toBe("Bullish");
  });

  it("strips markdown json code fences", () => {
    const input = '```json\n{"decisions":[],"market_analysis":"ok"}\n```';
    const result = parseAIResponse(input);
    expect(result.decisions).toEqual([]);
    expect(result.market_analysis).toBe("ok");
  });

  it("strips markdown code fences without language tag", () => {
    const input = '```\n{"decisions":[],"market_analysis":"ok"}\n```';
    const result = parseAIResponse(input);
    expect(result.decisions).toEqual([]);
    expect(result.market_analysis).toBe("ok");
  });

  it("handles leading text before JSON", () => {
    const input =
      'Here is my analysis:\n{"decisions":[],"market_analysis":"bearish"}';
    const result = parseAIResponse(input);
    expect(result.market_analysis).toBe("bearish");
  });

  it("handles trailing text after JSON", () => {
    const input =
      '{"decisions":[],"market_analysis":"neutral"}\nLet me know if you need more.';
    const result = parseAIResponse(input);
    expect(result.market_analysis).toBe("neutral");
  });

  it("handles both leading and trailing text", () => {
    const input =
      'Sure! Here you go:\n{"decisions":[{"action":"hold","symbol":"SPY","shares":0,"reasoning":"wait"}],"market_analysis":"sideways"}\nHope this helps!';
    const result = parseAIResponse(input);
    expect(result.decisions).toHaveLength(1);
    expect(result.market_analysis).toBe("sideways");
  });

  it("returns empty decisions for completely invalid JSON", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parseAIResponse("this is not json at all");
    expect(result.decisions).toEqual([]);
    expect(result.market_analysis).toBe("Failed to parse response");
    spy.mockRestore();
  });

  it("returns empty decisions when decisions field is missing", () => {
    const input = '{"market_analysis":"test"}';
    const result = parseAIResponse(input);
    expect(result.decisions).toEqual([]);
    expect(result.market_analysis).toBe("test");
  });

  it("returns empty decisions when decisions is not an array", () => {
    const input = '{"decisions":"not array","market_analysis":"test"}';
    const result = parseAIResponse(input);
    expect(result.decisions).toEqual([]);
  });

  it("defaults market_analysis to empty string when missing", () => {
    const input = '{"decisions":[]}';
    const result = parseAIResponse(input);
    expect(result.market_analysis).toBe("");
  });

  it("handles empty string input", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parseAIResponse("");
    expect(result.decisions).toEqual([]);
    spy.mockRestore();
  });

  it("handles nested code fences with json content", () => {
    const input =
      'Based on analysis:\n```json\n{\n  "decisions": [\n    {"action": "buy", "symbol": "MSFT", "shares": 5, "reasoning": "strong"}\n  ],\n  "market_analysis": "good"\n}\n```\nThats all.';
    const result = parseAIResponse(input);
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0].symbol).toBe("MSFT");
  });

  it("parses multiple decisions", () => {
    const input = JSON.stringify({
      decisions: [
        { action: "buy", symbol: "AAPL", shares: 10, reasoning: "a" },
        { action: "sell", symbol: "MSFT", shares: 5, reasoning: "b" },
        { action: "hold", symbol: "SPY", shares: 0, reasoning: "c" },
      ],
      market_analysis: "mixed",
    });
    const result = parseAIResponse(input);
    expect(result.decisions).toHaveLength(3);
  });

  it("handles response with reasoning_content (Qwen thinking mode)", () => {
    // Some models return thinking content alongside the actual JSON
    const input =
      '```json\n{"decisions":[{"action":"buy","symbol":"AAPL","shares":10,"reasoning":"value play"}],"market_analysis":"positive"}\n```';
    const result = parseAIResponse(input);
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0].shares).toBe(10);
  });
});

// ============================================================
// buildContextPrompt
// ============================================================

describe("buildContextPrompt", () => {
  it("renders empty portfolio correctly", () => {
    const account = makeAccount({ cash: 100000 });
    const result = buildContextPrompt(account, [], [], []);

    expect(result).toContain("Cash: $100000.00");
    expect(result).toContain("Positions Value: $0.00");
    expect(result).toContain("Total Value: $100000.00");
    expect(result).toContain("Total Return: +0.00%");
    expect(result).toContain("(no positions)");
    expect(result).toContain("(no trades yet)");
  });

  it("renders positions with P&L", () => {
    const account = makeAccount({ cash: 50000 });
    const positions = [makePosition({ symbol: "AAPL", shares: 100, avg_cost: 150 })];
    const quotes = [makeQuote({ symbol: "AAPL", price: 160 })];

    const result = buildContextPrompt(account, positions, quotes, []);

    expect(result).toContain("AAPL: 100 shares @ avg $150.00");
    expect(result).toContain("Current: $160.00");
    expect(result).toContain("P&L: +$1000.00");
    expect(result).toContain("+6.7%");
  });

  it("renders negative P&L correctly", () => {
    const account = makeAccount({ cash: 50000 });
    const positions = [makePosition({ symbol: "AAPL", shares: 50, avg_cost: 200 })];
    const quotes = [makeQuote({ symbol: "AAPL", price: 180 })];

    const result = buildContextPrompt(account, positions, quotes, []);

    expect(result).toContain("P&L: $-1000.00");
    expect(result).toContain("-10.0%");
  });

  it("calculates total value and return correctly", () => {
    const account = makeAccount({ cash: 30000, initial_capital: 100000 });
    const positions = [
      makePosition({ symbol: "AAPL", shares: 200, avg_cost: 150 }),
    ];
    const quotes = [makeQuote({ symbol: "AAPL", price: 400 })];

    const result = buildContextPrompt(account, positions, quotes, []);

    // total = 30000 + 200*400 = 110000
    expect(result).toContain("Total Value: $110000.00");
    expect(result).toContain("Total Return: +10.00%");
  });

  it("renders market data quotes", () => {
    const quotes = [
      makeQuote({ symbol: "AAPL", price: 155.5, change_pct: 2.5, volume: 80000000 }),
      makeQuote({ symbol: "MSFT", price: 420.3, change_pct: -1.2, volume: 35000000 }),
    ];

    const result = buildContextPrompt(makeAccount(), [], quotes, []);

    expect(result).toContain("AAPL: $155.50 (+2.50% today) | Vol: 80.0M");
    expect(result).toContain("MSFT: $420.30 (-1.20% today) | Vol: 35.0M");
  });

  it("renders recent trades", () => {
    const trades = [
      makeTrade({
        symbol: "AAPL",
        side: "buy",
        shares: 50,
        price: 150,
        created_at: "2026-03-15T10:30:00Z",
      }),
    ];

    const result = buildContextPrompt(makeAccount(), [], [], trades);

    expect(result).toContain("BUY 50 AAPL @ $150.00");
  });

  it("limits to 10 recent trades", () => {
    const trades = Array.from({ length: 15 }, (_, i) =>
      makeTrade({
        id: `trade-${i}`,
        created_at: `2026-03-15T${String(i + 1).padStart(2, "0")}:00:00Z`,
      })
    );

    const result = buildContextPrompt(makeAccount(), [], [], trades);

    // Should only show 10
    const tradeMatches = result.match(/BUY \d+ AAPL/g);
    expect(tradeMatches).toHaveLength(10);
  });

  it("handles position with no matching quote (price = 0)", () => {
    const positions = [makePosition({ symbol: "AAPL", shares: 100, avg_cost: 150 })];
    // No quote for AAPL
    const result = buildContextPrompt(makeAccount(), positions, [], []);

    expect(result).toContain("Current: $0.00");
    expect(result).toContain("Value: $0.00");
  });
});
