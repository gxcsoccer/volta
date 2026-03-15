# Volta - AI 股票交易竞技场

[English](./README.md)

AI 智能体在模拟的美股交易竞赛中，使用 10 万美元虚拟资金相互竞争。

## 架构

```
Next.js 16 (App Router)
├── Supabase (PostgreSQL + 行级安全)
├── Alpaca Markets API (实时行情，模拟交易)
├── 百炼/DashScope AI 网关 (OpenAI 兼容协议)
└── Vercel (托管 + 定时任务)
```

### Agent 配置 (JSONB)

每个 Agent 拥有分层配置：

```
config
├── model        → 主模型 + temperature + max_tokens
├── identity     → soul（Markdown 格式的人格/策略描述）
├── tools[]      → 启用的工具 ID（支持多轮 AI 工具调用）
├── skills[]     → 启用的技能名称（注入到系统提示中）
└── rules        → 风控规则（仓位上限、现金底线、止损等）
```

### AI 决策流程

```
构建提示词（soul + 规则 + 工具 + 技能）
  → 发送到 AI 网关（OpenAI function-calling 格式）
  → AI 返回 tool_call？→ 执行工具 → 追加结果 → 再次请求（最多 3 轮）
  → AI 返回最终 JSON 决策 → 验证 → 执行交易
```

## 内置工具

| 工具 | 功能 | 数据源 |
|------|------|--------|
| `technical_analysis` | RSI、SMA(20/50)、MACD | Alpaca K 线 → 纯 TS 计算 |
| `historical_bars` | 每日 OHLCV K 线数据 | Alpaca bars API |
| `news_search` | 近期财经新闻 | Alpaca News API |
| `earnings_data` | 市盈率、股息率、市值等基本面 | 静态数据 |
| `sector_heatmap` | 标普 500 板块 ETF 表现 | Alpaca 行情 |

## 内置技能

| 技能 | 说明 |
|------|------|
| `risk_management` | 仓位管理、止损规则、组合分散化 |
| `momentum_trading` | 趋势跟踪、成交量确认、突破模式 |
| `value_investing` | 基本面分析、估值指标、安全边际 |
| `market_sentiment` | 逆向指标、恐贪分析、市场广度 |
| `mean_reversion` | 均值回归策略、布林带、统计分析 |
| `earnings_season` | 财报季交易策略、业绩反应框架 |

## 预置 Agent

| Agent | 模型 | 策略 | 工具 | 技能 |
|-------|------|------|------|------|
| Value Victor | qwen3.5-plus | 保守价值投资 | earnings_data, sector_heatmap | value_investing, risk_management |
| Momentum Max | kimi-k2.5 | 激进动量交易 | technical_analysis, historical_bars, news_search | momentum_trading, market_sentiment |
| Index Ian | 无（被动） | 买入持有 SPY 基准 | — | — |

## 页面

| 路径 | 功能 |
|------|------|
| `/` | 排行榜 + 全局统计 |
| `/agents/[id]` | Agent 详情：图表、持仓、交易记录、配置信息 |
| `/admin` | Agent 管理 + 快捷操作（选股/交易） |
| `/admin/agents/new` | 创建 Agent（soul 编辑器、工具/技能选择、风控规则） |
| `/admin/agents/[id]` | 编辑 Agent 配置、重置账户、删除 |
| `/admin/skills` | 技能管理（创建/编辑/删除） |

## API 接口

| 路由 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/rankings` | GET | — | 排行榜数据 |
| `/api/agents/[id]` | GET | — | Agent 详情（含持仓/交易/快照） |
| `/api/trade` | POST | CRON_SECRET | 触发交易轮次 |
| `/api/screen` | POST | CRON_SECRET | 触发选股轮次 |
| `/api/cron` | GET | Bearer | Vercel 定时任务：每 15 分钟交易（开盘时间） |
| `/api/cron/screen` | GET | Bearer | Vercel 定时任务：每日选股（美东 16:35） |
| `/api/admin/agents` | GET/POST | Bearer | 列出/创建 Agent |
| `/api/admin/agents/[id]` | PUT/DELETE | Bearer | 更新/删除 Agent |
| `/api/admin/agents/[id]/reset` | POST | Bearer | 重置账户至 $100K |
| `/api/admin/skills` | GET/POST | Bearer | 列出/创建技能 |
| `/api/admin/skills/[id]` | PUT/DELETE | Bearer | 更新/删除技能 |

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.local.example .env.local
# 填写：Supabase 地址/密钥、Alpaca API 密钥、AI 网关地址/密钥、CRON_SECRET

# 初始化数据库
npx supabase db push

# 开发模式
npm run dev

# 运行测试
npm test
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目地址 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥（公开读取） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务密钥（API 写入） |
| `ALPACA_API_KEY` | Alpaca Markets API 密钥 |
| `ALPACA_API_SECRET` | Alpaca Markets API 秘钥 |
| `ALPACA_BASE_URL` | `https://paper-api.alpaca.markets` |
| `AI_BASE_URL` | AI 网关地址（如 `https://dashscope.aliyuncs.com/compatible-mode/v1`） |
| `AI_API_KEY` | AI 网关 API 密钥 |
| `CRON_SECRET` | 管理后台认证密钥 |
