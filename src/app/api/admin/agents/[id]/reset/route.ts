// ============================================================
// Admin API: Reset Agent Account to $100K
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

function isAuthed(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const secret = authHeader?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET;
}

/**
 * POST /api/admin/agents/[id]/reset - Reset agent account
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getServiceClient();

  // Get account
  const { data: account, error: accError } = await db
    .from("accounts")
    .select("id")
    .eq("agent_id", id)
    .single();

  if (accError || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Delete all positions
  await db.from("positions").delete().eq("account_id", account.id);

  // Delete all trades
  await db.from("trades").delete().eq("account_id", account.id);

  // Delete all snapshots
  await db.from("snapshots").delete().eq("account_id", account.id);

  // Reset cash to $100K
  await db
    .from("accounts")
    .update({ cash: 100000.0 })
    .eq("id", account.id);

  return NextResponse.json({ success: true, message: "Account reset to $100K" });
}
