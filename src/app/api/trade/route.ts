// ============================================================
// POST /api/trade - Trigger a trading round
// ============================================================
// Can be called by:
// 1. Vercel Cron (with CRON_SECRET header)
// 2. Manual trigger from dashboard (with CRON_SECRET in body)

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { runTradingRound } from "@/lib/orchestrator";

export const maxDuration = 60; // Vercel Pro: up to 60s

export async function POST(request: NextRequest) {
  // Authenticate
  const authHeader = request.headers.get("authorization");
  const body = await request.json().catch(() => ({}));
  const secret = authHeader?.replace("Bearer ", "") ?? body.secret;

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = body.force === true; // Skip market hours check

  try {
    const db = getServiceClient();
    const result = await runTradingRound(db, { force });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Trading round error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
