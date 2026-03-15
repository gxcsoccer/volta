import { describe, it, expect } from "vitest";
import { getToolsForAgent, getAllTools, getToolById, toOpenAITools } from "../tools/registry";

describe("tools/registry", () => {
  it("getAllTools returns all 5 registered tools", () => {
    const tools = getAllTools();
    expect(tools.length).toBe(5);

    const ids = tools.map((t) => t.id);
    expect(ids).toContain("technical_analysis");
    expect(ids).toContain("historical_bars");
    expect(ids).toContain("news_search");
    expect(ids).toContain("earnings_data");
    expect(ids).toContain("sector_heatmap");
  });

  it("getToolById returns correct tool", () => {
    const tool = getToolById("technical_analysis");
    expect(tool).toBeDefined();
    expect(tool!.name).toBe("Technical Analysis");
  });

  it("getToolById returns undefined for unknown ID", () => {
    expect(getToolById("nonexistent")).toBeUndefined();
  });

  it("getToolsForAgent returns only requested tools", () => {
    const tools = getToolsForAgent(["technical_analysis", "news_search"]);
    expect(tools.length).toBe(2);
    expect(tools.map((t) => t.id)).toEqual(["technical_analysis", "news_search"]);
  });

  it("getToolsForAgent ignores unknown IDs", () => {
    const tools = getToolsForAgent(["technical_analysis", "unknown_tool"]);
    expect(tools.length).toBe(1);
    expect(tools[0].id).toBe("technical_analysis");
  });

  it("getToolsForAgent returns empty for empty input", () => {
    expect(getToolsForAgent([])).toEqual([]);
  });

  it("toOpenAITools converts to correct format", () => {
    const tools = getToolsForAgent(["historical_bars"]);
    const openAI = toOpenAITools(tools);

    expect(openAI.length).toBe(1);
    expect(openAI[0].type).toBe("function");
    expect(openAI[0].function.name).toBe("historical_bars");
    expect(openAI[0].function.description).toBeTruthy();
    expect(openAI[0].function.parameters.type).toBe("object");
  });

  it("toOpenAITools handles multiple tools", () => {
    const tools = getAllTools();
    const openAI = toOpenAITools(tools);
    expect(openAI.length).toBe(5);
    openAI.forEach((t) => {
      expect(t.type).toBe("function");
      expect(t.function.name).toBeTruthy();
    });
  });
});
