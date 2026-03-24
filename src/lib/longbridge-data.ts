// ============================================================
// Longbridge Market Data — via longport SDK
// Provides market temperature and capital flow data
// not available from the Alpaca Markets API.
//
// Required environment variables:
//   LONGPORT_APP_KEY     – App Key from Longbridge developer centre
//   LONGPORT_APP_SECRET  – App Secret from Longbridge developer centre
//   LONGPORT_ACCESS_TOKEN – Access Token (obtained via longbridge login or OAuth)
// ============================================================

// Using require() so that Next.js does not attempt to statically analyse
// the NAPI-RS native import during the Edge Runtime type-check pass.
// The serverExternalPackages setting in next.config.ts keeps it out of
// the webpack bundle entirely at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const longport = require("longport");

const { Config, QuoteContext, Market } = longport;

// Market string → SDK Market enum
const MARKET_MAP: Record<string, number> = {
  US: Market.US,
  HK: Market.HK,
  CN: Market.CN,
  SG: Market.SG,
};

/**
 * Return true when all three Longbridge credentials are present in the
 * environment.  The tools use this to fail fast with a clear message
 * instead of throwing an inscrutable SDK error.
 */
export function isLongbridgeConfigured(): boolean {
  return Boolean(
    process.env.LONGPORT_APP_KEY &&
      process.env.LONGPORT_APP_SECRET &&
      process.env.LONGPORT_ACCESS_TOKEN
  );
}

/**
 * Build a longport Config from the environment variables.
 * Throws if any required variable is missing.
 */
function buildConfig(): typeof Config {
  return new Config({
    appKey: process.env.LONGPORT_APP_KEY!,
    appSecret: process.env.LONGPORT_APP_SECRET!,
    accessToken: process.env.LONGPORT_ACCESS_TOKEN!,
  });
}

export interface MarketTemperatureResult {
  market: string;
  temperature: number;
  description: string;
  valuation: number;
  sentiment: number;
  timestamp: string;
}

/**
 * Get the market sentiment temperature (0 = extreme fear, 100 = extreme greed)
 * for one or more markets.  Supported market codes: US, HK, CN, SG.
 */
export async function getMarketTemperature(
  markets: string[]
): Promise<MarketTemperatureResult[]> {
  const config = buildConfig();
  const ctx = await QuoteContext.new(config);

  const results: MarketTemperatureResult[] = [];

  for (const m of markets) {
    const marketEnum = MARKET_MAP[m.toUpperCase()];
    if (marketEnum === undefined) continue;

    const resp = await ctx.marketTemperature(marketEnum);
    results.push({
      market: m.toUpperCase(),
      temperature: resp.temperature,
      description: resp.description,
      valuation: resp.valuation,
      sentiment: resp.sentiment,
      timestamp: resp.timestamp instanceof Date
        ? resp.timestamp.toISOString()
        : String(resp.timestamp),
    });
  }

  return results;
}

export interface CapitalFlowResult {
  symbol: string;
  inflow_series: { timestamp: string; inflow: number }[];
  distribution: {
    inflow_large: number;
    inflow_medium: number;
    inflow_small: number;
    outflow_large: number;
    outflow_medium: number;
    outflow_small: number;
    net_inflow: number;
  };
}

/**
 * Get intraday capital flow and distribution snapshot for a symbol.
 * symbol must use Longbridge format, e.g. "TSLA.US", "700.HK", "600519.SH".
 */
export async function getCapitalFlow(
  symbol: string
): Promise<CapitalFlowResult> {
  const config = buildConfig();
  const ctx = await QuoteContext.new(config);

  const [flowLines, dist] = await Promise.all([
    ctx.capitalFlow(symbol),
    ctx.capitalDistribution(symbol),
  ]);

  const toNum = (v: unknown): number => {
    if (v && typeof (v as { toNumber?: () => number }).toNumber === "function") {
      return (v as { toNumber: () => number }).toNumber();
    }
    return Number(v) || 0;
  };

  const inflow_series = (flowLines as { inflow: unknown; timestamp: unknown }[]).map(
    (line) => ({
      timestamp:
        line.timestamp instanceof Date
          ? line.timestamp.toISOString()
          : String(line.timestamp),
      inflow: toNum(line.inflow),
    })
  );

  const capitalIn = dist.capitalIn;
  const capitalOut = dist.capitalOut;
  const inLarge = toNum(capitalIn.large);
  const inMedium = toNum(capitalIn.medium);
  const inSmall = toNum(capitalIn.small);
  const outLarge = toNum(capitalOut.large);
  const outMedium = toNum(capitalOut.medium);
  const outSmall = toNum(capitalOut.small);

  return {
    symbol,
    inflow_series,
    distribution: {
      inflow_large: inLarge,
      inflow_medium: inMedium,
      inflow_small: inSmall,
      outflow_large: outLarge,
      outflow_medium: outMedium,
      outflow_small: outSmall,
      net_inflow: inLarge + inMedium + inSmall - outLarge - outMedium - outSmall,
    },
  };
}
