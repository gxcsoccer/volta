import { describe, it, expect, vi, beforeEach } from "vitest";
import { newsSearchTool } from "../tools/news-search";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ALPACA_API_KEY = "test-key";
  process.env.ALPACA_API_SECRET = "test-secret";
});

describe("newsSearchTool", () => {
  it("has correct metadata", () => {
    expect(newsSearchTool.id).toBe("news_search");
    expect(newsSearchTool.category).toBe("data");
    expect(newsSearchTool.parameters.required).toContain("symbol");
  });

  it("returns formatted news for valid response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        news: [
          {
            headline: "Apple beats earnings",
            summary: "Apple reported strong Q4 results driven by iPhone sales.",
            created_at: "2026-03-15T14:30:00Z",
            source: "Reuters",
          },
          {
            headline: "Apple launches new product",
            summary: "New MacBook Pro announced at spring event.",
            created_at: "2026-03-14T10:00:00Z",
            source: "Bloomberg",
          },
        ],
      }),
    });

    const result = JSON.parse(await newsSearchTool.execute({ symbol: "AAPL" }));

    expect(result.symbol).toBe("AAPL");
    expect(result.count).toBe(2);
    expect(result.news).toHaveLength(2);
    expect(result.news[0].headline).toBe("Apple beats earnings");
    expect(result.news[0].source).toBe("Reuters");
    expect(result.news[0].date).toBe("2026-03-15");
  });

  it("returns empty news array when no results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ news: [] }),
    });

    const result = JSON.parse(await newsSearchTool.execute({ symbol: "ZZZZ" }));
    expect(result.news).toEqual([]);
    expect(result.count).toBe(0);
  });

  it("returns error on API failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
    });

    const result = JSON.parse(await newsSearchTool.execute({ symbol: "AAPL" }));
    expect(result.error).toContain("News API error: 429");
  });

  it("returns error on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

    const result = JSON.parse(await newsSearchTool.execute({ symbol: "AAPL" }));
    expect(result.error).toContain("Failed to fetch news");
    expect(result.error).toContain("Network timeout");
  });

  it("uppercases symbol", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ news: [] }),
    });

    const result = JSON.parse(await newsSearchTool.execute({ symbol: "aapl" }));
    expect(result.symbol).toBe("AAPL");
  });

  it("truncates long summaries to 200 chars", async () => {
    const longSummary = "A".repeat(500);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        news: [{ headline: "Test", summary: longSummary, created_at: "2026-03-15T00:00:00Z", source: "Test" }],
      }),
    });

    const result = JSON.parse(await newsSearchTool.execute({ symbol: "AAPL" }));
    expect(result.news[0].summary.length).toBe(200);
  });

  it("passes correct query params to Alpaca API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ news: [] }),
    });

    await newsSearchTool.execute({ symbol: "MSFT" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("v1beta1/news");
    expect(url).toContain("symbols=MSFT");
    expect(url).toContain("limit=5");
  });
});
