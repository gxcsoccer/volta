// ============================================================
// GET /api/cron - Vercel Cron handler
// ============================================================
// Vercel Cron calls this endpoint on schedule.
// On Hobby plan: limited to 1 cron/day. On Pro: every 15 min during market hours.
// The vercel.json schedule "*/15 9-16 * * 1-5" runs every 15min, Mon-Fri, 9am-4pm UTC.
// Adjust for your timezone (EST market hours = 14:30-21:00 UTC).

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { runTradingRound } from "@/lib/orchestrator";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Vercel Cron sends the secret in the Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getServiceClient();
    const result = await runTradingRound(db);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Cron trading round error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
