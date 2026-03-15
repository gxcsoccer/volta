// ============================================================
// GET /api/agents/[id] - Agent detail with portfolio
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Agent
    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("*")
      .eq("id", id)
      .single();

    if (agentErr || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Account
    const { data: account } = await supabase
      .from("accounts")
      .select("*")
      .eq("agent_id", id)
      .single();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Positions with current prices
    const { data: positions } = await supabase
      .from("positions")
      .select("*")
      .eq("account_id", account.id);

    const { data: marketData } = await supabase
      .from("market_data")
      .select("*");

    const priceMap = new Map(
      (marketData ?? []).map((m) => [m.symbol, Number(m.price)])
    );

    const enrichedPositions = (positions ?? []).map((p) => {
      const currentPrice = priceMap.get(p.symbol) ?? Number(p.avg_cost);
      const marketValue = p.shares * currentPrice;
      const unrealizedPnl = (currentPrice - Number(p.avg_cost)) * p.shares;
      return { ...p, current_price: currentPrice, market_value: marketValue, unrealized_pnl: unrealizedPnl };
    });

    // Recent trades
    const { data: trades } = await supabase
      .from("trades")
      .select("*")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(50);

    // Snapshots for chart
    const { data: snapshots } = await supabase
      .from("snapshots")
      .select("*")
      .eq("account_id", account.id)
      .order("created_at", { ascending: true })
      .limit(500);

    // Total value
    const positionsValue = enrichedPositions.reduce(
      (sum, p) => sum + p.market_value,
      0
    );
    const totalValue = Number(account.cash) + positionsValue;
    const returnPct =
      ((totalValue - Number(account.initial_capital)) /
        Number(account.initial_capital)) *
      100;

    return NextResponse.json({
      agent,
      account,
      positions: enrichedPositions,
      trades: trades ?? [],
      snapshots: snapshots ?? [],
      total_value: Math.round(totalValue * 100) / 100,
      return_pct: Math.round(returnPct * 100) / 100,
    });
  } catch (err) {
    console.error("Agent detail error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
