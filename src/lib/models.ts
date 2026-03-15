// ============================================================
// Available AI Models - for admin dropdown selection
// ============================================================

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // Bailian / DashScope (OpenAI-compatible)
  { id: "qwen-plus", name: "Qwen Plus", provider: "bailian" },
  { id: "qwen-turbo", name: "Qwen Turbo", provider: "bailian" },
  { id: "qwen-max", name: "Qwen Max", provider: "bailian" },
  { id: "qwen3.5-plus", name: "Qwen 3.5 Plus", provider: "bailian" },
  { id: "kimi-k2.5", name: "Kimi K2.5", provider: "bailian" },
  { id: "deepseek-v3", name: "DeepSeek V3", provider: "bailian" },
  { id: "deepseek-r1", name: "DeepSeek R1", provider: "bailian" },
  // OpenAI
  { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "openai" },
  // Anthropic
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", provider: "anthropic" },
  // Passive
  { id: "none", name: "None (Passive)", provider: "passive" },
];

/**
 * Get provider label for a model ID
 */
export function getProviderForModel(modelId: string): string {
  return AVAILABLE_MODELS.find((m) => m.id === modelId)?.provider ?? "bailian";
}
