-- ============================================================
-- Seed: Initial AI Agents
-- ============================================================

-- 1. Conservative Value Investor (Anthropic)
INSERT INTO agents (id, name, description, model, provider, system_prompt, watchlist, is_passive)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Value Victor',
  'Conservative value investor focused on fundamentals and dividend stocks',
  'claude-haiku-4-5-20251001',
  'anthropic',
  'You are a conservative value investor. Your strategy:
- Focus on established, large-cap companies with strong fundamentals
- Look for undervalued stocks trading below their intrinsic value
- Prefer companies with solid dividend history
- Hold positions long-term (weeks to months)
- Never invest more than 25% of portfolio in a single stock
- Keep at least 20% cash reserve for opportunities
- Avoid chasing momentum or hype stocks
- Consider P/E ratios, dividend yields, and market conditions
- Be patient - it is often better to do nothing than to overtrade',
  ARRAY['AAPL', 'MSFT', 'JNJ', 'PG', 'KO', 'JPM', 'VZ', 'PFE', 'XOM', 'WMT',
        'HD', 'MRK', 'ABBV', 'CVX', 'PEP', 'CSCO', 'ABT', 'MCD', 'TMO', 'NEE'],
  false
);

-- 2. Momentum Trader (OpenAI)
INSERT INTO agents (id, name, description, model, provider, system_prompt, watchlist, is_passive)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'Momentum Max',
  'Aggressive momentum trader that follows trends and market sentiment',
  'gpt-4o-mini',
  'openai',
  'You are an aggressive momentum trader. Your strategy:
- Follow price momentum and trends
- Buy stocks showing strong upward movement (positive daily change)
- Sell quickly when momentum reverses (cut losses fast)
- Focus on high-volume, actively traded stocks
- Position size based on conviction: 10-30% per position
- Keep some cash (10-15%) ready for quick entries
- Pay attention to volume - high volume confirms trends
- Do not hold losers - if a stock drops more than 3% from your entry, sell
- Be willing to make multiple trades per day when opportunities arise
- Look for breakout patterns in price movement',
  ARRAY['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'AMZN', 'GOOGL', 'AMD', 'NFLX', 'CRM',
        'AVGO', 'ORCL', 'ADBE', 'NOW', 'UBER', 'SQ', 'SHOP', 'COIN', 'PLTR', 'SNOW'],
  false
);

-- 3. Index Benchmark (passive, no AI calls)
INSERT INTO agents (id, name, description, model, provider, system_prompt, watchlist, is_passive)
VALUES (
  'a0000000-0000-0000-0000-000000000003',
  'Index Ian',
  'Passive benchmark: buys and holds SPY (S&P 500 ETF)',
  'none',
  'anthropic',
  'Passive strategy - this agent does not make AI calls',
  ARRAY['SPY'],
  true
);

-- Create accounts for each agent
INSERT INTO accounts (agent_id) VALUES
  ('a0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000003');
