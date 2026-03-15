// ============================================================
// GET /api/cron/screen - Vercel Cron handler for daily screening
// ============================================================
// Runs daily at 21:35 UTC (16:35 ET) - 35 min after market close.

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { runScreeningRound } from "@/lib/screener";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getServiceClient();
    const result = await runScreeningRound(db);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Cron screening error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
