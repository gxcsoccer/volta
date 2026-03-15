-- ============================================================
-- Agent Config (JSONB) + Skills Table
-- ============================================================

-- 1. Add config JSONB column to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}';

-- 2. Migrate existing flat fields into config
UPDATE agents SET config = jsonb_build_object(
  'model', jsonb_build_object(
    'primary', model,
    'temperature', 0.7,
    'max_tokens', 1024
  ),
  'identity', jsonb_build_object(
    'soul', system_prompt,
    'description', description
  ),
  'tools', '[]'::jsonb,
  'skills', '[]'::jsonb,
  'rules', jsonb_build_object(
    'max_position_pct', 25,
    'min_cash_pct', 10,
    'max_trades_per_round', 5
  )
)
WHERE config = '{}'::jsonb;

-- 3. Create skills table
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for skills
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read skills" ON skills FOR SELECT USING (true);
CREATE POLICY "Service write skills" ON skills FOR ALL USING (auth.role() = 'service_role');

-- 4. Seed initial skills
INSERT INTO skills (name, description, category, content) VALUES
(
  'risk_management',
  'Position sizing, stop-loss rules, and portfolio diversification guidelines',
  'risk',
  '## Risk Management Framework

### Position Sizing
- Never allocate more than 25% of total portfolio to a single position
- Scale into positions: start with 1/3 of target size, add on confirmation
- Total equity exposure should typically be 60-90% of portfolio

### Stop-Loss Rules
- Hard stop: exit if any position loses more than 8% from entry
- Trailing stop: move stop to breakeven after 5% gain
- Portfolio stop: if total portfolio drops 5% in a day, halt all new buys

### Diversification
- Hold minimum 5 positions across at least 3 sectors
- No more than 40% in any single sector
- Keep at least 10% cash for opportunities

### Risk/Reward
- Only enter trades with minimum 2:1 reward-to-risk ratio
- Calculate position size based on stop distance, not conviction'
),
(
  'momentum_trading',
  'Trend following, volume confirmation, and breakout patterns',
  'strategy',
  '## Momentum Trading Strategy

### Trend Identification
- Use price relative to 20-day and 50-day moving averages
- Bullish: price > 20 SMA > 50 SMA (uptrend confirmed)
- Bearish: price < 20 SMA < 50 SMA (downtrend confirmed)

### Volume Confirmation
- Valid breakout: volume should be 1.5x average or higher
- Declining volume on pullbacks is healthy (low selling pressure)
- Rising volume on advances confirms institutional buying

### Entry Rules
- Buy on pullbacks to 20-day SMA in confirmed uptrends
- Buy breakouts above resistance with volume confirmation
- Avoid buying extended stocks (>10% above 20-day SMA)

### Exit Rules
- Sell when price closes below 20-day SMA on high volume
- Take partial profits (1/3) at 10% gain
- Cut losses at 3-5% below entry'
),
(
  'value_investing',
  'Fundamental analysis, valuation metrics, and quality assessment',
  'strategy',
  '## Value Investing Framework

### Valuation Metrics
- Look for P/E ratios below sector average
- Price-to-Book < 3.0 for established companies
- PEG ratio < 1.5 suggests growth at reasonable price
- Dividend yield above market average is a plus

### Quality Indicators
- Consistent revenue growth (3+ years)
- Stable or expanding profit margins
- Strong free cash flow generation
- Low debt-to-equity ratio (< 1.0 preferred)

### Margin of Safety
- Target 20-30% discount to estimated intrinsic value
- Be patient: wait for market overreactions to create opportunities
- Average down only if thesis remains intact

### When to Sell
- Sell when stock reaches fair value estimate
- Sell if fundamentals deteriorate (thesis broken)
- Sell if much better opportunity arises (opportunity cost)'
),
(
  'market_sentiment',
  'Contrarian indicators, fear/greed analysis, and market breadth',
  'analysis',
  '## Market Sentiment Analysis

### Contrarian Indicators
- Extreme fear (VIX > 30) often marks buying opportunities
- Extreme greed (VIX < 15) warrants caution and position trimming
- "Buy when others are fearful, sell when others are greedy"

### Market Breadth
- Check advance/decline ratio for market health
- New highs vs new lows indicates underlying strength
- Sector rotation: money flowing to defensive = risk-off

### Sentiment Signals
- Analyst consensus: when everyone is bullish, be cautious
- Insider buying clusters: positive signal (insiders know their business)
- Short interest: high short interest can fuel squeezes

### Application
- Use sentiment as a timing tool, not a primary decision driver
- Fade extreme sentiment readings
- Combine with technical and fundamental analysis for best results'
);
