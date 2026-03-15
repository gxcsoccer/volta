// ============================================================
// Tool-Use Loop - Multi-turn AI interaction with tool calling
// ============================================================

import type { ToolDefinition } from "./tools/types";
import type { OpenAITool, ToolCallResult } from "./tools/types";
import type { AIResponse } from "./types";
import { toOpenAITools, getToolById } from "./tools/registry";
import { parseAIResponse } from "./ai-decision";

const TOOL_TIMEOUT_MS = 10000; // 10s per tool call
const MAX_ITERATIONS = 3;
const TOTAL_TIMEOUT_MS = 45000; // 45s total (within Vercel 60s)

interface ToolLoopOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  tools: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

interface ToolLoopResult {
  response: AIResponse;
  toolCalls: ToolCallResult[];
  iterations: number;
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

/**
 * Run the tool-use loop: send request → handle tool_calls → re-send → repeat
 * Returns the final parsed AI response plus all tool call results.
 */
export async function runToolLoop(options: ToolLoopOptions): Promise<ToolLoopResult> {
  const { model, systemPrompt, userPrompt, tools, temperature = 0.7, maxTokens = 1024 } = options;
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing AI_BASE_URL or AI_API_KEY");
  }

  const openAITools: OpenAITool[] = toOpenAITools(tools);
  const allToolCalls: ToolCallResult[] = [];
  const startTime = Date.now();

  const messages: OpenAIMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Check total timeout
    if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
      console.warn("Tool loop total timeout reached, returning partial result");
      break;
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools: openAITools,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: AbortSignal.timeout(TOTAL_TIMEOUT_MS - (Date.now() - startTime)),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI gateway error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error("No response from AI gateway");
    }

    const assistantMessage = choice.message;

    // If there are tool calls, execute them
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add assistant message (with tool_calls) to conversation
      messages.push({
        role: "assistant",
        content: assistantMessage.content ?? "",
        tool_calls: assistantMessage.tool_calls,
      });

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const toolStart = Date.now();
        const toolId = toolCall.function.name;
        let args: Record<string, unknown> = {};
        let result: string;

        try {
          args = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          args = {};
        }

        const tool = getToolById(toolId);
        if (!tool) {
          result = JSON.stringify({ error: `Unknown tool: ${toolId}` });
        } else {
          try {
            // Execute with timeout
            result = await Promise.race([
              tool.execute(args),
              new Promise<string>((_, reject) =>
                setTimeout(() => reject(new Error("Tool timeout")), TOOL_TIMEOUT_MS)
              ),
            ]);
          } catch (err) {
            result = JSON.stringify({
              error: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        }

        const toolCallResult: ToolCallResult = {
          tool_call_id: toolCall.id,
          name: toolId,
          arguments: args,
          result,
          duration_ms: Date.now() - toolStart,
        };
        allToolCalls.push(toolCallResult);

        // Add tool result to conversation
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Continue to next iteration (AI will process tool results)
      continue;
    }

    // No tool calls = final response
    const responseText = assistantMessage.content ?? "{}";
    return {
      response: parseAIResponse(responseText),
      toolCalls: allToolCalls,
      iterations: iteration + 1,
    };
  }

  // Max iterations reached, try to parse whatever we have
  const lastAssistant = messages
    .filter((m) => m.role === "assistant")
    .pop();
  const responseText = lastAssistant?.content ?? "{}";

  return {
    response: parseAIResponse(responseText),
    toolCalls: allToolCalls,
    iterations: MAX_ITERATIONS,
  };
}
