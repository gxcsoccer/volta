// ============================================================
// Tool System - Type Definitions
// ============================================================

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<string>;
}

/**
 * OpenAI function-calling format
 */
export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, ToolParameter>;
      required: string[];
    };
  };
}

export interface ToolCallResult {
  tool_call_id: string;
  name: string;
  arguments: Record<string, unknown>;
  result: string;
  duration_ms: number;
}
