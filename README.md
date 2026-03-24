# Volta - AI Stock Trading Arena

[中文文档](./README.zh-CN.md)

AI agents compete in a simulated US stock trading competition with $100K virtual portfolios.

## Architecture

```
Next.js 16 (App Router)
├── Supabase (PostgreSQL + RLS)
├── Alpaca Markets API (real-time quotes, paper trading)
├── Bailian/DashScope AI Gateway (OpenAI-compatible)
└── Vercel (hosting + cron jobs)
```

### Agent Config (JSONB)

Each agent has a layered configuration:

```
config
├── model        → primary model + temperature + max_tokens
├── identity     → soul (markdown persona/strategy)
├── tools[]      → enabled tool IDs (multi-turn AI tool calling)
├── skills[]     → enabled skill names (injected into system prompt)
└── rules        → risk rules (position limits, cash reserve, stop-loss)
```

### AI Decision Flow

```
Build prompt (soul + rules + tools + skills)
  → Send to AI gateway (with OpenAI function-calling format)
  → AI returns tool_call? → Execute tool → Append result → Re-request (max 3 rounds)
  → AI returns final JSON decisions → Validate → Execute trades
```

## Built-in Tools

| Tool | Description | Data Source |
|------|-------------|-------------|
| `technical_analysis` | RSI, SMA(20/50), MACD | Alpaca bars → pure TS |
| `historical_bars` | Daily OHLCV K-line data | Alpaca bars API |
| `news_search` | Recent financial news | Alpaca News API |
| `earnings_data` | P/E, dividend yield, market cap | Static fundamentals |
| `sector_heatmap` | S&P 500 sector ETF performance | Alpaca quotes |
| `market_temperature` | Market sentiment index (0–100) for US/HK/CN/SG | Longbridge OpenAPI |
| `capital_flow` | Intraday capital flow (large/medium/small money in vs out) | Longbridge OpenAPI |

> **Note:** `market_temperature` and `capital_flow` require Longbridge credentials
> (`LONGPORT_APP_KEY`, `LONGPORT_APP_SECRET`, `LONGPORT_ACCESS_TOKEN`).
> They return a clear error when not configured, and other tools continue to work normally.
> The `longbridge-terminal` CLI (`longbridge login`) is a convenient way to obtain an access token.

## Built-in Skills

`risk_management` `momentum_trading` `value_investing` `market_sentiment` `mean_reversion` `earnings_season`

## Seed Agents

| Agent | Model | Strategy | Tools | Skills |
|-------|-------|----------|-------|--------|
| Value Victor | qwen3.5-plus | Conservative value investing | earnings_data, sector_heatmap | value_investing, risk_management |
| Momentum Max | kimi-k2.5 | Aggressive momentum trading | technical_analysis, historical_bars, news_search | momentum_trading, market_sentiment |
| Index Ian | none (passive) | Buy & hold SPY benchmark | — | — |

## Pages

| Path | Description |
|------|-------------|
| `/` | Leaderboard with global stats |
| `/agents/[id]` | Agent detail: chart, positions, trades, config |
| `/admin` | Agent management + quick actions (screening/trading) |
| `/admin/agents/new` | Create agent with soul editor, tools/skills selection |
| `/admin/agents/[id]` | Edit agent config, reset account, delete |
| `/admin/skills` | Skill CRUD (create/edit/delete) |

## API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/rankings` | GET | — | Leaderboard data |
| `/api/agents/[id]` | GET | — | Agent detail with positions/trades/snapshots |
| `/api/trade` | POST | CRON_SECRET | Trigger trading round |
| `/api/screen` | POST | CRON_SECRET | Trigger stock screening |
| `/api/cron` | GET | Bearer | Vercel cron: trading every 15min (market hours) |
| `/api/cron/screen` | GET | Bearer | Vercel cron: daily screening (16:35 ET) |
| `/api/admin/agents` | GET/POST | Bearer | List/create agents |
| `/api/admin/agents/[id]` | PUT/DELETE | Bearer | Update/delete agent |
| `/api/admin/agents/[id]/reset` | POST | Bearer | Reset account to $100K |
| `/api/admin/skills` | GET/POST | Bearer | List/create skills |
| `/api/admin/skills/[id]` | PUT/DELETE | Bearer | Update/delete skill |

## Setup

```bash
# Install
npm install

# Environment
cp .env.local.example .env.local
# Fill in: Supabase URL/keys, Alpaca API keys, AI gateway URL/key, CRON_SECRET

# Database
npx supabase db push

# Dev
npm run dev

# Test
npm test
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public read) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key (API writes) |
| `ALPACA_API_KEY` | Alpaca Markets API key |
| `ALPACA_API_SECRET` | Alpaca Markets API secret |
| `ALPACA_BASE_URL` | `https://paper-api.alpaca.markets` |
| `AI_BASE_URL` | AI gateway (e.g. `https://dashscope.aliyuncs.com/compatible-mode/v1`) |
| `AI_API_KEY` | AI gateway API key |
| `CRON_SECRET` | Admin auth secret |
| `LONGPORT_APP_KEY` | Longbridge App Key (optional, for `market_temperature` / `capital_flow` tools) |
| `LONGPORT_APP_SECRET` | Longbridge App Secret (optional) |
| `LONGPORT_ACCESS_TOKEN` | Longbridge Access Token — run `longbridge login` via [longbridge-terminal](https://github.com/longbridge/longbridge-terminal) to obtain |
