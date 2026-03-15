-- ============================================================
-- Volta - AI Stock Trading Simulator - Initial Schema
-- ============================================================

-- AI Agents (strategies)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai')),
  system_prompt TEXT NOT NULL,
  watchlist TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_passive BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Virtual trading accounts (1:1 with agent)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  cash NUMERIC(12, 2) NOT NULL DEFAULT 100000.00,
  initial_capital NUMERIC(12, 2) NOT NULL DEFAULT 100000.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock positions
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  shares INTEGER NOT NULL CHECK (shares > 0),
  avg_cost NUMERIC(10, 2) NOT NULL CHECK (avg_cost >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, symbol)
);

-- Trade history
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  shares INTEGER NOT NULL CHECK (shares > 0),
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  total NUMERIC(12, 2) NOT NULL,
  fee NUMERIC(8, 4) NOT NULL DEFAULT 0,
  reasoning TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Market data cache (latest quotes)
CREATE TABLE market_data (
  symbol TEXT PRIMARY KEY,
  price NUMERIC(10, 2) NOT NULL,
  prev_close NUMERIC(10, 2) NOT NULL DEFAULT 0,
  change_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  volume BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Portfolio snapshots for historical tracking / charting
CREATE TABLE snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  total_value NUMERIC(12, 2) NOT NULL,
  cash NUMERIC(12, 2) NOT NULL,
  positions_value NUMERIC(12, 2) NOT NULL,
  return_pct NUMERIC(8, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_positions_account ON positions(account_id);
CREATE INDEX idx_trades_account ON trades(account_id);
CREATE INDEX idx_trades_created ON trades(created_at DESC);
CREATE INDEX idx_snapshots_account ON snapshots(account_id);
CREATE INDEX idx_snapshots_created ON snapshots(created_at DESC);

-- ============================================================
-- RPC Functions
-- ============================================================

-- Atomically adjust account cash (positive = add, negative = subtract)
CREATE OR REPLACE FUNCTION adjust_cash(p_account_id UUID, p_amount NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE accounts
  SET cash = cash + p_amount
  WHERE id = p_account_id;

  -- Verify cash didn't go negative
  IF (SELECT cash FROM accounts WHERE id = p_account_id) < 0 THEN
    RAISE EXCEPTION 'Insufficient cash';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Row Level Security (public read, service role write)
-- ============================================================

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY "Public read agents" ON agents FOR SELECT USING (true);
CREATE POLICY "Public read accounts" ON accounts FOR SELECT USING (true);
CREATE POLICY "Public read positions" ON positions FOR SELECT USING (true);
CREATE POLICY "Public read trades" ON trades FOR SELECT USING (true);
CREATE POLICY "Public read market_data" ON market_data FOR SELECT USING (true);
CREATE POLICY "Public read snapshots" ON snapshots FOR SELECT USING (true);

-- Service role can do everything (API routes use service role key)
CREATE POLICY "Service write agents" ON agents FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write accounts" ON accounts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write positions" ON positions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write trades" ON trades FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write market_data" ON market_data FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write snapshots" ON snapshots FOR ALL USING (auth.role() = 'service_role');
