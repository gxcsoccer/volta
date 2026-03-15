// ============================================================
// Admin API: Single Agent CRUD
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

function isAuthed(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const secret = authHeader?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET;
}

/**
 * PUT /api/admin/agents/[id] - Update agent config
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const db = getServiceClient();

  // Build update object - sync flat fields with config
  const update: Record<string, unknown> = {};

  if (body.name !== undefined) update.name = body.name;
  if (body.is_active !== undefined) update.is_active = body.is_active;
  if (body.is_passive !== undefined) update.is_passive = body.is_passive;
  if (body.watchlist !== undefined) update.watchlist = body.watchlist;

  if (body.config) {
    update.config = body.config;

    // Sync flat fields from config
    if (body.config.model?.primary) {
      update.model = body.config.model.primary;
    }
    if (body.config.identity?.soul !== undefined) {
      update.system_prompt = body.config.identity.soul;
    }
    if (body.config.identity?.description !== undefined) {
      update.description = body.config.identity.description;
    }
  }

  if (body.model !== undefined) update.model = body.model;
  if (body.provider !== undefined) update.provider = body.provider;
  if (body.system_prompt !== undefined) update.system_prompt = body.system_prompt;
  if (body.description !== undefined) update.description = body.description;

  const { data, error } = await db
    .from("agents")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/admin/agents/[id] - Delete agent and cascade
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getServiceClient();

  const { error } = await db.from("agents").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
