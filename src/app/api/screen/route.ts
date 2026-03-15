// ============================================================
// POST /api/screen - Trigger stock screening round
// ============================================================
// Each AI agent independently picks 15-20 stocks from the S&P 500 pool.
// Should run daily after market close (e.g. 16:30 ET).

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { runScreeningRound } from "@/lib/screener";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const body = await request.json().catch(() => ({}));
  const secret = authHeader?.replace("Bearer ", "") ?? body.secret;

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getServiceClient();
    const result = await runScreeningRound(db);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Screening round error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
