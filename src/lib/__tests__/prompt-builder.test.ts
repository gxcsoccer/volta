import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../prompt-builder";
import type { Agent, Skill } from "../types";
import type { ToolDefinition } from "../tools/types";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "a1",
    name: "Test Agent",
    description: "A test agent",
    model: "qwen-plus",
    provider: "bailian",
    system_prompt: "You are a value investor.",
    watchlist: ["AAPL"],
    is_active: true,
    is_passive: false,
    config: {
      model: { primary: "qwen-plus", temperature: 0.7, max_tokens: 1024 },
      identity: { soul: "You are a value investor.", description: "A test agent" },
      tools: [],
      skills: [],
      rules: { max_position_pct: 25, min_cash_pct: 10, max_trades_per_round: 5 },
    },
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "s1",
    name: "risk_management",
    description: "Risk management framework",
    category: "risk",
    content: "## Risk Rules\n- Max 25% per position",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    id: "test_tool",
    name: "Test Tool",
    description: "A test tool for analysis",
    category: "analysis",
    parameters: { type: "object", properties: {}, required: [] },
    execute: async () => "{}",
    ...overrides,
  };
}

describe("buildSystemPrompt", () => {
  it("includes soul/identity text", () => {
    const prompt = buildSystemPrompt(makeAgent());
    expect(prompt).toContain("You are a value investor.");
  });

  it("includes trading rules", () => {
    const prompt = buildSystemPrompt(makeAgent());
    expect(prompt).toContain("Maximum position size: 25%");
    expect(prompt).toContain("Minimum cash reserve: 10%");
    expect(prompt).toContain("Maximum trades per round: 5");
  });

  it("includes stop loss rule when configured", () => {
    const agent = makeAgent({
      config: {
        model: { primary: "qwen-plus" },
        identity: { soul: "Soul", description: "" },
        tools: [],
        skills: [],
        rules: { max_position_pct: 25, min_cash_pct: 10, max_trades_per_round: 5, stop_loss_pct: 8 },
      },
    });
    const prompt = buildSystemPrompt(agent);
    expect(prompt).toContain("Stop loss: sell if position drops 8%");
  });

  it("does not include tool section when no tools", () => {
    const prompt = buildSystemPrompt(makeAgent());
    expect(prompt).not.toContain("Available Tools");
  });

  it("includes tool descriptions when tools provided", () => {
    const tools = [makeTool({ name: "Technical Analysis", description: "RSI and SMA" })];
    const prompt = buildSystemPrompt(makeAgent(), tools);
    expect(prompt).toContain("Available Tools");
    expect(prompt).toContain("**Technical Analysis**");
    expect(prompt).toContain("RSI and SMA");
  });

  it("does not include skills section when no skills", () => {
    const prompt = buildSystemPrompt(makeAgent());
    expect(prompt).not.toContain("Active Skills");
  });

  it("includes skills content when skills provided", () => {
    const skills = [makeSkill({ name: "risk_management", content: "## Risk\n- Rule 1" })];
    const prompt = buildSystemPrompt(makeAgent(), undefined, skills);
    expect(prompt).toContain("Active Skills");
    expect(prompt).toContain("Skill: risk_management");
    expect(prompt).toContain("- Rule 1");
  });

  it("combines all sections when everything provided", () => {
    const tools = [makeTool()];
    const skills = [makeSkill()];
    const prompt = buildSystemPrompt(makeAgent(), tools, skills);

    expect(prompt).toContain("You are a value investor."); // soul
    expect(prompt).toContain("Trading Rules");              // rules
    expect(prompt).toContain("Available Tools");             // tools
    expect(prompt).toContain("Active Skills");               // skills
  });
});
