// ============================================================
// GET /api/rankings - Get current leaderboard
// ============================================================

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { RankingEntry } from "@/lib/types";

export async function GET() {
  try {
    // Load agents + accounts
    const { data: agents, error: agentsErr } = await supabase
      .from("agents")
      .select("*, accounts(*)");

    if (agentsErr) throw agentsErr;
    if (!agents) return NextResponse.json([]);

    // Load all positions
    const { data: allPositions } = await supabase
      .from("positions")
      .select("*");

    // Load latest market data
    const { data: marketData } = await supabase
      .from("market_data")
      .select("*");

    const priceMap = new Map(
      (marketData ?? []).map((m) => [m.symbol, Number(m.price)])
    );

    // Load trade counts and win rates
    const { data: allTrades } = await supabase
      .from("trades")
      .select("account_id, side, price, symbol");

    const rankings: RankingEntry[] = [];

    for (const agent of agents) {
      // 1:1 relation returns object (not array)
      const account = Array.isArray(agent.accounts)
        ? agent.accounts[0]
        : agent.accounts;
      if (!account) continue;

      const positions = (allPositions ?? []).filter(
        (p) => p.account_id === account.id
      );

      const positionsValue = positions.reduce(
        (sum, p) => sum + p.shares * (priceMap.get(p.symbol) ?? p.avg_cost),
        0
      );

      const cash = Number(account.cash);
      const totalValue = cash + positionsValue;
      const initialCapital = Number(account.initial_capital);
      const returnPct =
        ((totalValue - initialCapital) / initialCapital) * 100;

      // Calculate win rate from completed trades (sells)
      const accountTrades = (allTrades ?? []).filter(
        (t) => t.account_id === account.id
      );
      const totalTrades = accountTrades.length;

      // Simplified win rate: sells above avg cost
      const sells = accountTrades.filter((t) => t.side === "sell");
      const wins = sells.filter((t) => {
        const pos = positions.find((p) => p.symbol === t.symbol);
        return pos ? Number(t.price) > Number(pos.avg_cost) : true;
      });
      const winRate =
        sells.length > 0 ? (wins.length / sells.length) * 100 : 0;

      rankings.push({
        agent_id: agent.id,
        agent_name: agent.name,
        model: agent.model,
        total_value: Math.round(totalValue * 100) / 100,
        return_pct: Math.round(returnPct * 100) / 100,
        cash: Math.round(cash * 100) / 100,
        positions_count: positions.length,
        total_trades: totalTrades,
        win_rate: Math.round(winRate * 100) / 100,
      });
    }

    // Sort by total value descending
    rankings.sort((a, b) => b.total_value - a.total_value);

    return NextResponse.json(rankings);
  } catch (err) {
    console.error("Rankings error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
