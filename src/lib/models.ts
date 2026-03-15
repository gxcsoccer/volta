// ============================================================
// Available AI Models - for admin dropdown selection
// ============================================================

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "qwen-plus", name: "Qwen Plus", provider: "bailian" },
  { id: "qwen-turbo", name: "Qwen Turbo", provider: "bailian" },
  { id: "qwen-max", name: "Qwen Max", provider: "bailian" },
  { id: "qwen3.5-plus", name: "Qwen 3.5 Plus", provider: "bailian" },
  { id: "kimi-k2.5", name: "Kimi K2.5", provider: "bailian" },
  { id: "deepseek-v3", name: "DeepSeek V3", provider: "bailian" },
  { id: "deepseek-r1", name: "DeepSeek R1", provider: "bailian" },
];

/**
 * Get provider label for a model ID
 */
export function getProviderForModel(modelId: string): string {
  return AVAILABLE_MODELS.find((m) => m.id === modelId)?.provider ?? "bailian";
}
