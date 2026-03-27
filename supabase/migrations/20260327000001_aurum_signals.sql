-- ============================================================
-- Aurum 策略信号表
-- Aurum 系统每月发布一条轮动信号，Volta agent 读取执行
-- ============================================================

CREATE TABLE IF NOT EXISTS aurum_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 策略标识
  strategy_name TEXT NOT NULL DEFAULT 'rotation_v1',

  -- 信号内容
  target_asset TEXT NOT NULL,
  target_weight NUMERIC(4,2) DEFAULT 1.0,

  -- 策略元数据
  metadata JSONB DEFAULT '{}',

  -- 有效期
  valid_from DATE NOT NULL,
  valid_until DATE,

  -- 审计
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 唯一约束：防止同月重复插入
ALTER TABLE aurum_signals ADD CONSTRAINT uq_aurum_signal_month
  UNIQUE (strategy_name, valid_from);

-- 索引：快速查找当前有效信号
CREATE INDEX idx_aurum_signals_valid
  ON aurum_signals (strategy_name, valid_from DESC);

-- RLS：公开读，服务端写
ALTER TABLE aurum_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read aurum_signals"
  ON aurum_signals FOR SELECT
  USING (true);

CREATE POLICY "Service write aurum_signals"
  ON aurum_signals FOR ALL
  USING (true)
  WITH CHECK (true);
