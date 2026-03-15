-- Remove provider constraint to support any AI gateway model
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_provider_check;

-- Update existing agents to use OpenClaw gateway models
UPDATE agents SET model = 'qwen3.5-plus', provider = 'bailian'
WHERE id = 'a0000000-0000-0000-0000-000000000001';

UPDATE agents SET model = 'kimi-k2.5', provider = 'bailian'
WHERE id = 'a0000000-0000-0000-0000-000000000002';

UPDATE agents SET model = 'none', provider = 'passive'
WHERE id = 'a0000000-0000-0000-0000-000000000003';
