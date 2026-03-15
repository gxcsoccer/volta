// ============================================================
// Volta - AI Stock Trading Simulator Types
// ============================================================

// --- Database Row Types ---

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string; // model ID sent to AI gateway (e.g. "qwen3.5-plus", "kimi-k2.5")
  provider: string; // informational label (e.g. "bailian", "ollama")
  system_prompt: string;
  watchlist: string[]; // stock symbols this agent tracks
  is_active: boolean;
  is_passive: boolean; // passive benchmark (buy & hold, no AI calls)
  created_at: string;
}

export interface Account {
  id: string;
  agent_id: string;
  cash: number;
  initial_capital: number; // always 100000
  created_at: string;
}

export interface Position {
  id: string;
  account_id: string;
  symbol: string;
  shares: number;
  avg_cost: number;
  updated_at: string;
}

export interface Trade {
  id: string;
  account_id: string;
  symbol: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  total: number;
  fee: number;
  reasoning: string;
  created_at: string;
}

export interface MarketDataCache {
  symbol: string;
  price: number;
  prev_close: number;
  change_pct: number;
  volume: number;
  updated_at: string;
}

export interface Snapshot {
  id: string;
  account_id: string;
  total_value: number;
  cash: number;
  positions_value: number;
  return_pct: number;
  created_at: string;
}

// --- Computed / API Types ---

export interface PortfolioSummary {
  account: Account;
  agent: Agent;
  positions: (Position & { current_price: number; market_value: number; unrealized_pnl: number })[];
  total_value: number;
  return_pct: number;
  total_trades: number;
}

export interface RankingEntry {
  agent_id: string;
  agent_name: string;
  model: string;
  total_value: number;
  return_pct: number;
  cash: number;
  positions_count: number;
  total_trades: number;
  win_rate: number;
}

export interface TradeDecision {
  action: "buy" | "sell" | "hold";
  symbol: string;
  shares: number;
  reasoning: string;
}

export interface AIResponse {
  decisions: TradeDecision[];
  market_analysis: string;
}

export interface MarketQuote {
  symbol: string;
  price: number;
  prev_close: number;
  change_pct: number;
  volume: number;
}

export interface TradingRoundResult {
  agent_id: string;
  agent_name: string;
  decisions: TradeDecision[];
  executed: { symbol: string; side: string; shares: number; price: number; error?: string }[];
  errors: string[];
}
