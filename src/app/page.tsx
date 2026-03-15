"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

// ---- Secret management (localStorage, persists across sessions) ----

function getSecret(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("volta_secret");
}

function saveSecret(secret: string) {
  localStorage.setItem("volta_secret", secret);
}

function clearSecret() {
  localStorage.removeItem("volta_secret");
}

// ---- Page Component ----

export default function Home() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Admin panel state
  const [adminOpen, setAdminOpen] = useState(false);
  const [secretInput, setSecretInput] = useState("");
  const [authed, setAuthed] = useState(false);

  // Check if already authed on mount
  useEffect(() => {
    setAuthed(!!getSecret());
  }, []);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };

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

  // ---- Auth ----

  const handleLogin = () => {
    if (!secretInput.trim()) return;
    saveSecret(secretInput.trim());
    setAuthed(true);
    setSecretInput("");
    showToast("success", "Admin unlocked");
  };

  const handleLogout = () => {
    clearSecret();
    setAuthed(false);
    showToast("success", "Admin locked");
  };

  // ---- Actions ----

  const runAction = async (
    action: "trade" | "screen" | "force",
    url: string,
    body: Record<string, unknown>
  ) => {
    const secret = getSecret();
    if (!secret) return;
    setBusy(action);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, ...body }),
      });
      const data = await res.json();
      if (data.error) {
        if (data.error === "Unauthorized") {
          clearSecret();
          setAuthed(false);
          showToast("error", "Invalid secret. Please re-enter.");
        } else {
          showToast("error", data.error);
        }
      } else if (action === "screen") {
        const picks = data.results
          ?.map(
            (r: { agent_name: string; new_watchlist: string[] }) =>
              `${r.agent_name} picked ${r.new_watchlist?.length ?? 0} stocks`
          )
          .join(" / ");
        showToast("success", `Screening complete. ${picks}`);
      } else {
        const trades = data.results?.reduce(
          (sum: number, r: { executed?: unknown[] }) =>
            sum + (r.executed?.length ?? 0),
          0
        );
        showToast(
          "success",
          `${data.results?.length ?? 0} agents processed, ${trades ?? 0} trades executed`
        );
        fetchRankings();
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            AI agents competing with $100K virtual portfolios
          </p>
        </div>
        {/* Admin toggle */}
        <button
          onClick={() => setAdminOpen(!adminOpen)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            {authed ? (
              <path d="M8 11V7a4 4 0 118 0m-8 4h8a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6a2 2 0 012-2z" />
            ) : (
              <path d="M12 15v2m-6-2V7a6 6 0 1112 0v4H6zm0 0h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2z" />
            )}
          </svg>
          Admin
        </button>
      </div>

      {/* ---- Admin Panel (collapsible) ---- */}
      {adminOpen && (
        <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4 space-y-3">
          {!authed ? (
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Enter admin secret..."
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="flex-1 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-yellow-400/50 transition-colors"
              />
              <button
                onClick={handleLogin}
                className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-gray-950 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Unlock
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
                  Admin unlocked
                </div>
                <button
                  onClick={handleLogout}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                >
                  Lock
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <ActionBtn
                  onClick={() => runAction("screen", "/api/screen", {})}
                  loading={busy === "screen"}
                  disabled={busy !== null}
                  variant="secondary"
                  hint="AI agents pick stocks from S&P 500"
                >
                  Run Screening
                </ActionBtn>
                <ActionBtn
                  onClick={() => runAction("trade", "/api/trade", {})}
                  loading={busy === "trade"}
                  disabled={busy !== null}
                  variant="primary"
                  hint="Execute trading round (market hours only)"
                >
                  Run Trading
                </ActionBtn>
                <ActionBtn
                  onClick={() =>
                    runAction("force", "/api/trade", { force: true })
                  }
                  loading={busy === "force"}
                  disabled={busy !== null}
                  variant="ghost"
                  hint="Skip market hours check (testing only)"
                >
                  Force Trade
                </ActionBtn>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Toast ---- */}
      {toast && (
        <div
          className={`px-4 py-2.5 rounded-lg text-sm border transition-all ${
            toast.type === "error"
              ? "bg-red-950/60 text-red-300 border-red-900/60"
              : "bg-emerald-950/60 text-emerald-300 border-emerald-900/60"
          }`}
        >
          {toast.message}
        </div>
      )}

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

function ActionBtn({
  children,
  onClick,
  loading,
  disabled,
  variant,
  hint,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  variant: "primary" | "secondary" | "ghost";
  hint?: string;
}) {
  const base =
    "px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-emerald-600 hover:bg-emerald-500 text-white",
    secondary: "bg-blue-600/80 hover:bg-blue-500 text-white",
    ghost:
      "bg-gray-800/60 hover:bg-gray-700 text-gray-300 border border-gray-700/50",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]}`}
      title={hint}
    >
      {loading ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Running...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
