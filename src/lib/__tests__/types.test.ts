import { describe, it, expect } from "vitest";
import { getAgentConfig } from "../types";
import type { Agent } from "../types";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "a1",
    name: "Test Agent",
    description: "A test agent",
    model: "qwen-plus",
    provider: "bailian",
    system_prompt: "You are a test agent.",
    watchlist: ["AAPL", "SPY"],
    is_active: true,
    is_passive: false,
    config: {} as never,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("getAgentConfig", () => {
  it("falls back to flat fields when config is empty", () => {
    const agent = makeAgent({ config: {} as never });
    const config = getAgentConfig(agent);

    expect(config.model.primary).toBe("qwen-plus");
    expect(config.identity.soul).toBe("You are a test agent.");
    expect(config.identity.description).toBe("A test agent");
    expect(config.tools).toEqual([]);
    expect(config.skills).toEqual([]);
    expect(config.rules.max_position_pct).toBe(25);
    expect(config.rules.min_cash_pct).toBe(10);
    expect(config.rules.max_trades_per_round).toBe(5);
  });

  it("uses config fields when present", () => {
    const agent = makeAgent({
      config: {
        model: { primary: "gpt-4o", temperature: 0.3, max_tokens: 2048 },
        identity: { soul: "Custom soul", description: "Custom desc" },
        tools: ["technical_analysis", "news_search"],
        skills: ["risk_management"],
        rules: {
          max_position_pct: 30,
          min_cash_pct: 20,
          max_trades_per_round: 3,
          stop_loss_pct: 8,
        },
      },
    });
    const config = getAgentConfig(agent);

    expect(config.model.primary).toBe("gpt-4o");
    expect(config.model.temperature).toBe(0.3);
    expect(config.model.max_tokens).toBe(2048);
    expect(config.identity.soul).toBe("Custom soul");
    expect(config.tools).toEqual(["technical_analysis", "news_search"]);
    expect(config.skills).toEqual(["risk_management"]);
    expect(config.rules.max_position_pct).toBe(30);
    expect(config.rules.stop_loss_pct).toBe(8);
  });

  it("fills in defaults for partial config", () => {
    const agent = makeAgent({
      config: {
        model: { primary: "gpt-4o" },
        identity: { soul: "Soul text", description: "" },
        tools: [],
        skills: [],
        rules: { max_position_pct: 50, min_cash_pct: 5, max_trades_per_round: 10 },
      },
    });
    const config = getAgentConfig(agent);

    expect(config.model.temperature).toBe(0.7); // default
    expect(config.model.max_tokens).toBe(1024); // default
    expect(config.model.fallbacks).toEqual([]); // default
    expect(config.rules.stop_loss_pct).toBeUndefined();
  });

  it("handles null/undefined config gracefully", () => {
    const agent = makeAgent({ config: undefined as never });
    const config = getAgentConfig(agent);

    expect(config.model.primary).toBe("qwen-plus");
    expect(config.identity.soul).toBe("You are a test agent.");
  });
});
