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
  config: AgentConfig; // JSONB structured configuration
  created_at: string;
}

// --- Agent Config (JSONB) ---

export interface AgentConfig {
  model: {
    primary: string;
    fallbacks?: string[];
    temperature?: number;
    max_tokens?: number;
  };
  identity: {
    soul: string;
    description: string;
  };
  tools: string[]; // enabled tool IDs
  skills: string[]; // enabled skill IDs (UUIDs or names)
  rules: {
    max_position_pct: number;
    min_cash_pct: number;
    max_trades_per_round: number;
    stop_loss_pct?: number;
  };
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  created_at: string;
}

const DEFAULT_CONFIG: AgentConfig = {
  model: { primary: "", temperature: 0.7, max_tokens: 1024 },
  identity: { soul: "", description: "" },
  tools: [],
  skills: [],
  rules: { max_position_pct: 25, min_cash_pct: 10, max_trades_per_round: 5 },
};

/**
 * Get agent config with backward compatibility.
 * Fills in defaults for any missing fields, supports agents
 * that haven't been migrated to the JSONB config yet.
 */
export function getAgentConfig(agent: Agent): AgentConfig {
  const raw = agent.config ?? {};
  return {
    model: {
      primary: raw.model?.primary ?? agent.model ?? "",
      fallbacks: raw.model?.fallbacks ?? [],
      temperature: raw.model?.temperature ?? DEFAULT_CONFIG.model.temperature,
      max_tokens: raw.model?.max_tokens ?? DEFAULT_CONFIG.model.max_tokens,
    },
    identity: {
      soul: raw.identity?.soul ?? agent.system_prompt ?? "",
      description: raw.identity?.description ?? agent.description ?? "",
    },
    tools: raw.tools ?? DEFAULT_CONFIG.tools,
    skills: raw.skills ?? DEFAULT_CONFIG.skills,
    rules: {
      max_position_pct: raw.rules?.max_position_pct ?? DEFAULT_CONFIG.rules.max_position_pct,
      min_cash_pct: raw.rules?.min_cash_pct ?? DEFAULT_CONFIG.rules.min_cash_pct,
      max_trades_per_round: raw.rules?.max_trades_per_round ?? DEFAULT_CONFIG.rules.max_trades_per_round,
      stop_loss_pct: raw.rules?.stop_loss_pct,
    },
  };
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
