// ============================================================
// Market Data Provider - Alpaca Markets API
// ============================================================

import type { MarketQuote } from "./types";

const ALPACA_DATA_URL = "https://data.alpaca.markets";
const ALPACA_TRADING_URL =
  process.env.ALPACA_BASE_URL || "https://paper-api.alpaca.markets";

function getHeaders() {
  return {
    "APCA-API-KEY-ID": process.env.ALPACA_API_KEY!,
    "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET!,
    Accept: "application/json",
  };
}

/**
 * Check if the US stock market is currently open
 */
export async function isMarketOpen(): Promise<{
  is_open: boolean;
  next_open: string;
  next_close: string;
}> {
  const res = await fetch(`${ALPACA_TRADING_URL}/v2/clock`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Alpaca clock API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Get latest quotes for multiple symbols (batch)
 * Uses Alpaca's multi-quote snapshot endpoint
 */
export async function getQuotes(symbols: string[]): Promise<MarketQuote[]> {
  if (symbols.length === 0) return [];

  // Deduplicate
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];

  // Alpaca snapshot endpoint (IEX feed on free tier)
  const params = new URLSearchParams({
    symbols: unique.join(","),
    feed: "iex",
  });

  const res = await fetch(
    `${ALPACA_DATA_URL}/v2/stocks/snapshots?${params}`,
    { headers: getHeaders() }
  );

  if (!res.ok) {
    throw new Error(
      `Alpaca snapshot API error: ${res.status} ${await res.text()}`
    );
  }

  const data = await res.json();
  const quotes: MarketQuote[] = [];

  for (const symbol of unique) {
    const snap = data[symbol];
    if (!snap) continue;

    // snap.latestTrade.p = latest trade price
    // snap.prevDailyBar.c = previous day close
    const price = snap.latestTrade?.p ?? snap.minuteBar?.c ?? 0;
    const prevClose = snap.prevDailyBar?.c ?? price;

    quotes.push({
      symbol,
      price,
      prev_close: prevClose,
      change_pct: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
      volume: snap.dailyBar?.v ?? 0,
    });
  }

  return quotes;
}

/**
 * Get a single stock quote
 */
export async function getQuote(symbol: string): Promise<MarketQuote | null> {
  const quotes = await getQuotes([symbol]);
  return quotes[0] ?? null;
}

/**
 * Get recent bars (OHLCV) for a symbol - useful for AI context
 */
export async function getRecentBars(
  symbol: string,
  days: number = 5
): Promise<
  { t: string; o: number; h: number; l: number; c: number; v: number }[]
> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days * 2); // account for weekends

  const params = new URLSearchParams({
    timeframe: "1Day",
    start: start.toISOString(),
    end: end.toISOString(),
    limit: String(days),
    feed: "iex",
    sort: "desc",
  });

  const res = await fetch(
    `${ALPACA_DATA_URL}/v2/stocks/${symbol}/bars?${params}`,
    { headers: getHeaders() }
  );

  if (!res.ok) {
    throw new Error(
      `Alpaca bars API error: ${res.status} ${await res.text()}`
    );
  }

  const data = await res.json();
  return data.bars ?? [];
}
