// ============================================================
// Prompt Builder - Assembles system prompts from agent config
// ============================================================

import type { Agent, AgentConfig, Skill } from "./types";
import type { ToolDefinition } from "./tools/types";
import { getAgentConfig } from "./types";
import { formatSkillsForPrompt } from "./skills/registry";

/**
 * Build the complete system prompt from agent config components:
 * 1. Identity (soul markdown)
 * 2. Rules (risk management rules)
 * 3. Tools (descriptions of available tools)
 * 4. Skills (injected skill content)
 * 5. Decision schema (JSON format requirements)
 */
export function buildSystemPrompt(
  agent: Agent,
  tools?: ToolDefinition[],
  skills?: Skill[]
): string {
  const config = getAgentConfig(agent);
  const parts: string[] = [];

  // 1. Identity / Soul
  parts.push(config.identity.soul);

  // 2. Trading Rules
  parts.push(formatRules(config.rules));

  // 3. Tool descriptions (only when tools are available)
  if (tools && tools.length > 0) {
    parts.push(formatToolDescriptions(tools));
  }

  // 4. Skills
  if (skills && skills.length > 0) {
    parts.push(formatSkillsForPrompt(skills));
  }

  return parts.join("\n\n");
}

/**
 * Format risk management rules as readable text
 */
function formatRules(rules: AgentConfig["rules"]): string {
  const lines = [
    "# Trading Rules",
    `- Maximum position size: ${rules.max_position_pct}% of portfolio`,
    `- Minimum cash reserve: ${rules.min_cash_pct}% of portfolio`,
    `- Maximum trades per round: ${rules.max_trades_per_round}`,
  ];

  if (rules.stop_loss_pct) {
    lines.push(`- Stop loss: sell if position drops ${rules.stop_loss_pct}% from entry`);
  }

  return lines.join("\n");
}

/**
 * Format tool descriptions for the system prompt
 * (When using tool-use protocol, this is informational;
 *  the actual tool schemas are sent via the tools parameter)
 */
function formatToolDescriptions(tools: ToolDefinition[]): string {
  const lines = tools.map(
    (t) => `- **${t.name}**: ${t.description}`
  );
  return `# Available Tools\nYou can call these tools to gather more information before making decisions:\n${lines.join("\n")}`;
}
