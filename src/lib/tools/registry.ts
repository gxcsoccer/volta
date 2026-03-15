// ============================================================
// Tool Registry - Register and manage available tools
// ============================================================

import type { ToolDefinition, OpenAITool } from "./types";
import { technicalAnalysisTool } from "./technical-analysis";
import { historicalBarsTool } from "./historical-bars";
import { newsSearchTool } from "./news-search";
import { earningsDataTool } from "./earnings-data";
import { sectorHeatmapTool } from "./sector-heatmap";

/**
 * All registered tools
 */
const ALL_TOOLS: ToolDefinition[] = [
  technicalAnalysisTool,
  historicalBarsTool,
  newsSearchTool,
  earningsDataTool,
  sectorHeatmapTool,
];

const toolMap = new Map(ALL_TOOLS.map((t) => [t.id, t]));

/**
 * Get tools enabled for a specific agent
 */
export function getToolsForAgent(toolIds: string[]): ToolDefinition[] {
  return toolIds
    .map((id) => toolMap.get(id))
    .filter((t): t is ToolDefinition => t !== undefined);
}

/**
 * Get all available tools (for admin UI listing)
 */
export function getAllTools(): ToolDefinition[] {
  return ALL_TOOLS;
}

/**
 * Get a single tool by ID
 */
export function getToolById(id: string): ToolDefinition | undefined {
  return toolMap.get(id);
}

/**
 * Convert tool definitions to OpenAI function-calling format
 */
export function toOpenAITools(tools: ToolDefinition[]): OpenAITool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.id,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
