-- ============================================================
-- Seed Aurum Rotator agent
-- ============================================================

INSERT INTO agents (name, description, model, provider, system_prompt, watchlist, is_active, is_passive, config)
VALUES (
  'Aurum Rotator',
  'Systematic multi-asset rotation strategy evolved by Aurum AI system',
  'qwen3.5-plus',
  'bailian',
  '',
  ARRAY['SPY', 'QQQ', 'EFA', 'EEM', 'TLT', 'GLD', 'SHY'],
  true,
  false,
  '{
    "model": {
      "primary": "qwen3.5-plus",
      "temperature": 0.1,
      "max_tokens": 1024
    },
    "identity": {
      "soul": "你是 Aurum Rotator，一个系统化的多资产轮动策略执行者。\n\n## 执行流程\n1. 调用 aurum_signal 获取当前月的目标持仓\n2. 如果信号标记为过期（is_stale=true），持有 SHY\n3. 对比当前持仓与目标资产\n4. 如需调仓：先卖后买\n5. 如无需调仓：hold\n\n## 核心纪律\n- 你是执行者，不是决策者\n- 严格执行信号，不做主观判断\n- 止损由系统自动处理（stop_loss_pct=8），无需你操心\n- 无信号时默认持有 SHY",
      "description": "Aurum self-evolving multi-asset rotation strategy"
    },
    "tools": ["aurum_signal"],
    "skills": [],
    "rules": {
      "max_position_pct": 100,
      "min_cash_pct": 1,
      "max_trades_per_round": 3,
      "stop_loss_pct": 8
    }
  }'::jsonb
);

-- Create account for Aurum Rotator
INSERT INTO accounts (agent_id, cash, initial_capital)
SELECT id, 100000, 100000
FROM agents
WHERE name = 'Aurum Rotator';
