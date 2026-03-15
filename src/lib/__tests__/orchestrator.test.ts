import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runTradingRound } from "../orchestrator";

// ============================================================
// Mock all external dependencies
// ============================================================

vi.mock("../market-data", () => ({
  isMarketOpen: vi.fn(),
  getQuotes: vi.fn(),
}));

vi.mock("../ai-decision", () => ({
  getAIDecision: vi.fn(),
}));

vi.mock("../trading-engine", () => ({
  validateTrade: vi.fn(),
  executeTrade: vi.fn(),
}));

import { isMarketOpen, getQuotes } from "../market-data";
import { getAIDecision } from "../ai-decision";
import { validateTrade, executeTrade } from "../trading-engine";

// ============================================================
// Mock Supabase client
// ============================================================

function createMockDb(data: {
  agents?: Record<string, unknown>[];
  accounts?: Record<string, unknown>[];
  positions?: Record<string, unknown>[];
  trades?: Record<string, unknown>[];
}) {
  const store: Record<string, Record<string, unknown>[]> = {
    agents: data.agents ?? [],
    accounts: data.accounts ?? [],
    positions: data.positions ?? [],
    trades: data.trades ?? [],
    market_data: [],
    snapshots: [],
  };

  const chainable = (table: string) => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
        single: vi.fn().mockImplementation(() => {
          const item = store[table]?.[0] ?? null;
          return Promise.resolve({ data: item, error: null });
        }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: store[table] ?? [],
            error: null,
          }),
        }),
      }),
    }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  });

  return {
    from: vi.fn().mockImplementation((table: string) => chainable(table)),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================
// runTradingRound
// ============================================================

describe("runTradingRound", () => {
  it("returns early when market is closed (non-forced)", async () => {
    vi.mocked(isMarketOpen).mockResolvedValue({
      is_open: false,
      next_open: "2026-03-16T09:30:00-04:00",
      next_close: "2026-03-16T16:00:00-04:00",
    });

    const db = createMockDb({});
    const result = await runTradingRound(db as never);

    expect(result.market_open).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Market is closed");
    expect(result.results).toHaveLength(0);
  });

  it("skips market check when forced", async () => {
    vi.mocked(getQuotes).mockResolvedValue([]);

    const db = createMockDb({ agents: [] });
    // Override from().select().eq() chain for agents
    db.from.mockImplementation((table: string) => {
      if (table === "agents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    const result = await runTradingRound(db as never, { force: true });

    expect(result.market_open).toBe(true);
    expect(isMarketOpen).not.toHaveBeenCalled();
  });

  it("handles market check API failure gracefully", async () => {
    vi.mocked(isMarketOpen).mockRejectedValue(new Error("Network error"));

    const db = createMockDb({});
    const result = await runTradingRound(db as never);

    expect(result.market_open).toBe(false);
    expect(result.errors[0]).toContain("Failed to check market status");
    expect(result.errors[0]).toContain("Network error");
  });

  it("handles agent loading failure", async () => {
    vi.mocked(getQuotes).mockResolvedValue([]);

    const db = createMockDb({});
    db.from.mockImplementation((table: string) => {
      if (table === "agents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: "DB down" } }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    const result = await runTradingRound(db as never, { force: true });
    expect(result.errors[0]).toContain("Failed to load agents");
  });

  it("handles market data fetch failure", async () => {
    vi.mocked(getQuotes).mockRejectedValue(new Error("Alpaca down"));

    const db = createMockDb({});
    db.from.mockImplementation((table: string) => {
      if (table === "agents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "a1",
                  name: "Test",
                  watchlist: ["AAPL"],
                  is_active: true,
                  is_passive: false,
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    const result = await runTradingRound(db as never, { force: true });
    expect(result.errors[0]).toContain("Failed to fetch market data");
    expect(result.errors[0]).toContain("Alpaca down");
  });
});
