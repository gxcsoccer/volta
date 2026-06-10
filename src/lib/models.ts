// ============================================================
// Available AI Models - for admin dropdown selection
// ============================================================

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "qwen3.7-max", name: "Qwen 3.7 Max", provider: "bailian" },
  { id: "qwen3.7-plus", name: "Qwen 3.7 Plus", provider: "bailian" },
  { id: "qwen3.6-plus", name: "Qwen 3.6 Plus", provider: "bailian" },
  { id: "qwen3.6-flash", name: "Qwen 3.6 Flash", provider: "bailian" },
  { id: "kimi-k2.5", name: "Kimi K2.5", provider: "bailian" },
  { id: "kimi-k2.6", name: "Kimi K2.6", provider: "bailian" },
  { id: "deepseek-v3.2", name: "DeepSeek V3.2", provider: "bailian" },
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", provider: "bailian" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "bailian" },
  { id: "glm-5", name: "GLM-5", provider: "bailian" },
  { id: "glm-5.1", name: "GLM-5.1", provider: "bailian" },
  { id: "MiniMax-M2.5", name: "MiniMax M2.5", provider: "bailian" },
];

/**
 * Get provider label for a model ID
 */
export function getProviderForModel(modelId: string): string {
  return AVAILABLE_MODELS.find((m) => m.id === modelId)?.provider ?? "bailian";
}
