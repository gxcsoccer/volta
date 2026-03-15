// ============================================================
// Admin API: Skills CRUD
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

function isAuthed(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const secret = authHeader?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET;
}

/**
 * GET /api/admin/skills - List all skills
 */
export async function GET(request: NextRequest) {
  if (!isAuthed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from("skills")
    .select("*")
    .order("category")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/admin/skills - Create a new skill
 */
export async function POST(request: NextRequest) {
  if (!isAuthed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const db = getServiceClient();

  const { name, description = "", category = "general", content = "" } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data, error } = await db
    .from("skills")
    .insert({ name, description, category, content })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
