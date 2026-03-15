// ============================================================
// Skill Registry - Load and format skills for prompt injection
// ============================================================

import { SupabaseClient } from "@supabase/supabase-js";
import type { Skill } from "../types";

/**
 * Load skills from the database by their IDs
 */
export async function loadSkills(
  db: SupabaseClient,
  skillIds: string[]
): Promise<Skill[]> {
  if (skillIds.length === 0) return [];

  const { data, error } = await db
    .from("skills")
    .select("*")
    .in("id", skillIds);

  if (error) {
    console.error("Failed to load skills:", error.message);
    return [];
  }

  return (data ?? []) as Skill[];
}

/**
 * Load skills by name (for backward compat / seed data)
 */
export async function loadSkillsByName(
  db: SupabaseClient,
  names: string[]
): Promise<Skill[]> {
  if (names.length === 0) return [];

  const { data, error } = await db
    .from("skills")
    .select("*")
    .in("name", names);

  if (error) {
    console.error("Failed to load skills by name:", error.message);
    return [];
  }

  return (data ?? []) as Skill[];
}

/**
 * Format skills as markdown sections for system prompt injection
 */
export function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) return "";

  const sections = skills.map(
    (s) => `## Skill: ${s.name}\n${s.content}`
  );

  return `\n# Active Skills\n\n${sections.join("\n\n")}`;
}
