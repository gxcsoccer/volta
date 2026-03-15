-- ============================================================
-- Sync existing agents to new config architecture + add skills
-- ============================================================

-- 1. Update Value Victor: value investing skills + earnings tool
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
  'tools', '["earnings_data", "sector_heatmap"]'::jsonb,
  'skills', '["value_investing", "risk_management"]'::jsonb,
  'rules', jsonb_build_object(
    'max_position_pct', 25,
    'min_cash_pct', 20,
    'max_trades_per_round', 3,
    'stop_loss_pct', 10
  )
)
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- 2. Update Momentum Max: momentum skills + technical tools
UPDATE agents SET config = jsonb_build_object(
  'model', jsonb_build_object(
    'primary', model,
    'temperature', 0.8,
    'max_tokens', 1024
  ),
  'identity', jsonb_build_object(
    'soul', system_prompt,
    'description', description
  ),
  'tools', '["technical_analysis", "historical_bars", "news_search"]'::jsonb,
  'skills', '["momentum_trading", "market_sentiment"]'::jsonb,
  'rules', jsonb_build_object(
    'max_position_pct', 30,
    'min_cash_pct', 10,
    'max_trades_per_round', 5,
    'stop_loss_pct', 5
  )
)
WHERE id = 'a0000000-0000-0000-0000-000000000002';

-- 3. Update Index Ian: passive, no tools/skills
UPDATE agents SET config = jsonb_build_object(
  'model', jsonb_build_object('primary', 'none'),
  'identity', jsonb_build_object('soul', system_prompt, 'description', description),
  'tools', '[]'::jsonb,
  'skills', '[]'::jsonb,
  'rules', jsonb_build_object(
    'max_position_pct', 100,
    'min_cash_pct', 0,
    'max_trades_per_round', 1
  )
)
WHERE id = 'a0000000-0000-0000-0000-000000000003';

-- 4. Add two new skills
INSERT INTO skills (name, description, category, content) VALUES
(
  'mean_reversion',
  'Mean reversion strategy using statistical analysis and Bollinger Bands',
  'strategy',
  '## Mean Reversion Strategy

### Core Principle
Prices tend to revert to their historical mean. Extreme deviations from the average are temporary and create trading opportunities.

### Entry Signals
- Stock price drops below 2 standard deviations from 20-day mean (oversold)
- RSI below 30 indicates extreme selling pressure
- Price touches or breaks below lower Bollinger Band
- High-quality stock with temporary bad news (not structural problems)

### Exit Signals
- Price returns to 20-day moving average (take profit)
- RSI rises above 50 (momentum normalizing)
- Take partial profits at 1 standard deviation above entry
- Full exit at the mean or slight overshoot

### Risk Controls
- Only trade mean reversion on stocks with stable long-term trends
- Avoid catching falling knives: wait for stabilization (2-3 days of sideways)
- Do not average down more than once
- Maximum 15% of portfolio per mean-reversion trade
- Set hard stop at 3 standard deviations (thesis is broken)

### When NOT to Use
- During strong trending markets (momentum dominates)
- On stocks with fundamental deterioration (earnings miss, guidance cut)
- In high-volatility regimes (VIX > 35)'
),
(
  'earnings_season',
  'Strategies for trading around earnings announcements and guidance',
  'strategy',
  '## Earnings Season Playbook

### Pre-Earnings (1-2 weeks before)
- Review analyst consensus estimates and whisper numbers
- Check options implied volatility for expected move
- Look at recent earnings history: does the company typically beat or miss?
- Consider reducing position size before binary events

### Earnings Reaction Framework
- **Beat + Raise guidance**: Strong buy signal, especially on high volume
- **Beat + Lower guidance**: Caution, the beat may be priced in
- **Miss + Raise guidance**: Evaluate why — one-time charges are OK
- **Miss + Lower guidance**: Sell or avoid, fundamentals deteriorating

### Post-Earnings Drift
- Stocks that beat earnings tend to drift higher for 30-60 days
- Stocks that miss tend to drift lower
- The initial reaction is often exaggerated — wait 1-2 days for dust to settle
- Use pullbacks after earnings beats as entry opportunities

### Position Sizing
- Reduce to half position size before earnings if already holding
- Enter new positions at 1/3 size post-earnings, scale in over 1-2 weeks
- Never YOLO full position into an earnings announcement

### Sector Earnings Cascading
- First reporter in a sector sets the tone
- If a sector leader reports strong results, peers often follow
- Watch for read-through: TSMC earnings signal semiconductor demand'
)
ON CONFLICT (name) DO NOTHING;
