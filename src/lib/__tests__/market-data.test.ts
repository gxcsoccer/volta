import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isMarketOpen, getQuotes, getQuote } from "../market-data";

// ============================================================
// Market Data module tests (with mocked fetch)
// ============================================================

const MOCK_ENV = {
  ALPACA_API_KEY: "test-key",
  ALPACA_API_SECRET: "test-secret",
  ALPACA_BASE_URL: "https://paper-api.alpaca.markets",
};

beforeEach(() => {
  for (const [k, v] of Object.entries(MOCK_ENV)) {
    vi.stubEnv(k, v);
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("isMarketOpen", () => {
  it("returns market open status", async () => {
    const mockResponse = {
      is_open: true,
      next_open: "2026-03-16T09:30:00-04:00",
      next_close: "2026-03-16T16:00:00-04:00",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await isMarketOpen();
    expect(result.is_open).toBe(true);
    expect(result.next_open).toBeDefined();
    expect(result.next_close).toBeDefined();
  });

  it("returns closed status on weekends", async () => {
    const mockResponse = {
      is_open: false,
      next_open: "2026-03-16T09:30:00-04:00",
      next_close: "2026-03-16T16:00:00-04:00",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await isMarketOpen();
    expect(result.is_open).toBe(false);
  });

  it("throws on API error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(isMarketOpen()).rejects.toThrow("Alpaca clock API error: 401");
  });

  it("sends correct headers", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ is_open: true, next_open: "", next_close: "" }),
    });

    await isMarketOpen();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v2/clock"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "APCA-API-KEY-ID": "test-key",
          "APCA-API-SECRET-KEY": "test-secret",
        }),
      })
    );
  });
});

describe("getQuotes", () => {
  it("returns parsed quotes from Alpaca snapshot", async () => {
    const mockSnapshot = {
      AAPL: {
        latestTrade: { p: 155.5 },
        prevDailyBar: { c: 150.0 },
        dailyBar: { v: 50000000 },
      },
      MSFT: {
        latestTrade: { p: 420.0 },
        prevDailyBar: { c: 415.0 },
        dailyBar: { v: 30000000 },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSnapshot),
    });

    const quotes = await getQuotes(["AAPL", "MSFT"]);

    expect(quotes).toHaveLength(2);

    const aapl = quotes.find((q) => q.symbol === "AAPL")!;
    expect(aapl.price).toBe(155.5);
    expect(aapl.prev_close).toBe(150);
    expect(aapl.change_pct).toBeCloseTo(3.67, 1);
    expect(aapl.volume).toBe(50000000);

    const msft = quotes.find((q) => q.symbol === "MSFT")!;
    expect(msft.price).toBe(420);
  });

  it("returns empty array for empty input", async () => {
    const quotes = await getQuotes([]);
    expect(quotes).toEqual([]);
  });

  it("deduplicates symbols", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ AAPL: { latestTrade: { p: 150 }, prevDailyBar: { c: 150 }, dailyBar: { v: 0 } } }),
    });

    await getQuotes(["AAPL", "aapl", "AAPL"]);

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(url).toContain("symbols=AAPL");
    // Should NOT contain duplicate
    expect(url).not.toContain("AAPL%2CAAPL");
  });

  it("handles missing symbols in response gracefully", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ AAPL: { latestTrade: { p: 150 }, prevDailyBar: { c: 150 }, dailyBar: { v: 0 } } }),
    });

    // Request 2 symbols but only 1 returned
    const quotes = await getQuotes(["AAPL", "INVALID"]);
    expect(quotes).toHaveLength(1);
    expect(quotes[0].symbol).toBe("AAPL");
  });

  it("throws on API error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Server error"),
    });

    await expect(getQuotes(["AAPL"])).rejects.toThrow("Alpaca snapshot API error");
  });

  it("falls back to minuteBar when latestTrade missing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          SPY: {
            minuteBar: { c: 660 },
            prevDailyBar: { c: 655 },
            dailyBar: { v: 2000000 },
          },
        }),
    });

    const quotes = await getQuotes(["SPY"]);
    expect(quotes[0].price).toBe(660);
  });
});

describe("getQuote", () => {
  it("returns single quote", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          AAPL: {
            latestTrade: { p: 155 },
            prevDailyBar: { c: 150 },
            dailyBar: { v: 50000000 },
          },
        }),
    });

    const quote = await getQuote("AAPL");
    expect(quote).not.toBeNull();
    expect(quote!.symbol).toBe("AAPL");
    expect(quote!.price).toBe(155);
  });

  it("returns null for nonexistent symbol", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const quote = await getQuote("NONEXIST");
    expect(quote).toBeNull();
  });
});
