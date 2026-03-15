import { describe, it, expect, vi, beforeEach } from "vitest";
import { runToolLoop } from "../tool-loop";
import type { ToolDefinition } from "../tools/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock tools/registry to control tool resolution
vi.mock("../tools/registry", () => ({
  toOpenAITools: vi.fn().mockReturnValue([
    { type: "function", function: { name: "test_tool", description: "test", parameters: { type: "object", properties: {}, required: [] } } },
  ]),
  getToolById: vi.fn().mockImplementation((id: string) => {
    if (id === "test_tool") {
      return {
        id: "test_tool",
        name: "Test Tool",
        description: "A test tool",
        category: "test",
        parameters: { type: "object", properties: {}, required: [] },
        execute: async () => JSON.stringify({ result: "tool_output" }),
      };
    }
    return undefined;
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AI_BASE_URL = "https://test-api.example.com/v1";
  process.env.AI_API_KEY = "test-key";
});

const testTool: ToolDefinition = {
  id: "test_tool",
  name: "Test Tool",
  description: "A test tool",
  category: "test",
  parameters: { type: "object", properties: {}, required: [] },
  execute: async () => JSON.stringify({ result: "test" }),
};

describe("runToolLoop", () => {
  it("returns direct response when AI doesn't call tools", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              decisions: [{ action: "buy", symbol: "AAPL", shares: 10, reasoning: "test" }],
              market_analysis: "bullish",
            }),
          },
        }],
      }),
    });

    const result = await runToolLoop({
      model: "test-model",
      systemPrompt: "You are a trader.",
      userPrompt: "What to buy?",
      tools: [testTool],
    });

    expect(result.response.decisions).toHaveLength(1);
    expect(result.response.decisions[0].symbol).toBe("AAPL");
    expect(result.toolCalls).toHaveLength(0);
    expect(result.iterations).toBe(1);
  });

  it("executes tool calls and returns final response", async () => {
    // First call: AI requests a tool call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: "",
            tool_calls: [{
              id: "tc_1",
              type: "function",
              function: { name: "test_tool", arguments: "{}" },
            }],
          },
        }],
      }),
    });

    // Second call: AI returns final response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              decisions: [{ action: "sell", symbol: "MSFT", shares: 5, reasoning: "tool said so" }],
              market_analysis: "neutral",
            }),
          },
        }],
      }),
    });

    const result = await runToolLoop({
      model: "test-model",
      systemPrompt: "sys",
      userPrompt: "user",
      tools: [testTool],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("test_tool");
    expect(result.toolCalls[0].result).toContain("tool_output");
    expect(result.response.decisions).toHaveLength(1);
    expect(result.response.decisions[0].action).toBe("sell");
    expect(result.iterations).toBe(2);
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(
      runToolLoop({
        model: "test-model",
        systemPrompt: "sys",
        userPrompt: "user",
        tools: [testTool],
      })
    ).rejects.toThrow("AI gateway error (500)");
  });

  it("throws when missing env vars", async () => {
    delete process.env.AI_BASE_URL;

    await expect(
      runToolLoop({
        model: "test-model",
        systemPrompt: "sys",
        userPrompt: "user",
        tools: [testTool],
      })
    ).rejects.toThrow("Missing AI_BASE_URL or AI_API_KEY");
  });

  it("handles unknown tool gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: "",
            tool_calls: [{
              id: "tc_1",
              type: "function",
              function: { name: "unknown_tool", arguments: "{}" },
            }],
          },
        }],
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"decisions":[],"market_analysis":"err"}' } }],
      }),
    });

    const result = await runToolLoop({
      model: "test-model",
      systemPrompt: "sys",
      userPrompt: "user",
      tools: [testTool],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].result).toContain("Unknown tool");
  });
});
