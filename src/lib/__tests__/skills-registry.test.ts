import { describe, it, expect } from "vitest";
import { formatSkillsForPrompt } from "../skills/registry";
import type { Skill } from "../types";

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "s1",
    name: "test_skill",
    description: "A test skill",
    category: "general",
    content: "## Test\nSome content here.",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("formatSkillsForPrompt", () => {
  it("returns empty string for no skills", () => {
    expect(formatSkillsForPrompt([])).toBe("");
  });

  it("formats a single skill", () => {
    const skills = [makeSkill({ name: "risk_management", content: "## Risk\n- Rule 1" })];
    const result = formatSkillsForPrompt(skills);

    expect(result).toContain("# Active Skills");
    expect(result).toContain("## Skill: risk_management");
    expect(result).toContain("- Rule 1");
  });

  it("formats multiple skills", () => {
    const skills = [
      makeSkill({ name: "skill_a", content: "Content A" }),
      makeSkill({ id: "s2", name: "skill_b", content: "Content B" }),
    ];
    const result = formatSkillsForPrompt(skills);

    expect(result).toContain("## Skill: skill_a");
    expect(result).toContain("Content A");
    expect(result).toContain("## Skill: skill_b");
    expect(result).toContain("Content B");
  });
});
