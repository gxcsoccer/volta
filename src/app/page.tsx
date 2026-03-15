"use client";

import { useEffect, useState, useCallback } from "react";
import type { RankingEntry } from "@/lib/types";

// ---- Formatting helpers ----

const fmt = {
  usd: (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n),
  pct: (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`,
};

// ---- Page Component ----

export default function Home() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRankings = useCallback(async () => {
    try {
      const res = await fetch("/api/rankings");
      const data = await res.json();
      if (Array.isArray(data)) setRankings(data);
    } catch (err) {
      console.error("Failed to fetch rankings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRankings();
    const interval = setInterval(fetchRankings, 30000);
    return () => clearInterval(interval);
  }, [fetchRankings]);

  // ---- Derived stats ----

  const totalAUM = rankings.reduce((s, r) => s + r.total_value, 0);
  const bestReturn = rankings.length
    ? Math.max(...rankings.map((r) => r.return_pct))
    : 0;
  const totalTrades = rankings.reduce((s, r) => s + r.total_trades, 0);

  // ---- Rank styling ----

  const rankStyle = (i: number) => {
    if (i === 0)
      return {
        badge: "bg-yellow-400/15 text-yellow-400 ring-1 ring-yellow-400/30",
        label: "bg-yellow-400 text-gray-950",
      };
    if (i === 1)
      return {
        badge: "bg-gray-400/10 text-gray-300 ring-1 ring-gray-400/20",
        label: "bg-gray-400 text-gray-950",
      };
    if (i === 2)
      return {
        badge: "bg-amber-600/10 text-amber-500 ring-1 ring-amber-600/20",
        label: "bg-amber-600 text-white",
      };
    return {
      badge: "bg-gray-800/50 text-gray-500",
      label: "bg-gray-700 text-gray-300",
    };
  };

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* ---- Global Stats ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat
          label="Total AUM"
          value={loading ? "..." : fmt.usd(totalAUM)}
        />
        <MiniStat
          label="Active Agents"
          value={loading ? "..." : String(rankings.length)}
        />
        <MiniStat
          label="Best Return"
          value={loading ? "..." : fmt.pct(bestReturn)}
          color={bestReturn >= 0 ? "text-green-400" : "text-red-400"}
        />
        <MiniStat
          label="Total Trades"
          value={loading ? "..." : String(totalTrades)}
        />
      </div>

      {/* ---- Header ---- */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          AI agents competing with $100K virtual portfolios
        </p>
      </div>

      {/* ---- Agent Cards ---- */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      ) : rankings.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">No agents yet</p>
          <p className="text-gray-600 text-sm mt-1">
            Set up Supabase and seed initial agents to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rankings.map((r, i) => {
            const style = rankStyle(i);
            const cashPct = (r.cash / r.total_value) * 100;
            const investedPct = 100 - cashPct;

            return (
              <a
                key={r.agent_id}
                href={`/agents/${r.agent_id}`}
                className={`block rounded-xl border border-gray-800/60 hover:border-gray-700/80 bg-gray-900/40 hover:bg-gray-900/70 transition-all duration-200 ${style.badge}`}
              >
                <div className="px-5 py-4">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${style.label}`}
                    >
                      {i + 1}
                    </div>

                    {/* Name + Model */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-100 truncate">
                          {r.agent_name}
                        </span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 shrink-0">
                          {r.model}
                        </span>
                      </div>
                      {/* Allocation bar */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden max-w-48">
                          <div
                            className="h-full bg-yellow-400/70 rounded-full transition-all"
                            style={{ width: `${investedPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono tabular-nums">
                          {investedPct.toFixed(0)}% invested
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-6 text-right shrink-0">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">
                          Positions
                        </div>
                        <div className="font-mono text-sm text-gray-300 tabular-nums">
                          {r.positions_count}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">
                          Trades
                        </div>
                        <div className="font-mono text-sm text-gray-300 tabular-nums">
                          {r.total_trades}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">
                          Win Rate
                        </div>
                        <div className="font-mono text-sm text-gray-300 tabular-nums">
                          {r.win_rate > 0 ? `${r.win_rate.toFixed(0)}%` : "--"}
                        </div>
                      </div>
                    </div>

                    {/* Value + Return */}
                    <div className="text-right shrink-0 pl-4">
                      <div className="font-mono font-semibold text-gray-100 tabular-nums">
                        {fmt.usd(r.total_value)}
                      </div>
                      <div
                        className={`font-mono text-sm font-semibold tabular-nums ${
                          r.return_pct >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {fmt.pct(r.return_pct)}
                      </div>
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
        {label}
      </div>
      <div
        className={`font-mono font-semibold text-lg mt-0.5 tabular-nums ${color ?? "text-gray-100"}`}
      >
        {value}
      </div>
    </div>
  );
}
