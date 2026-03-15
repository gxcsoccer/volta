"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface AgentRow {
  id: string;
  name: string;
  model: string;
  provider: string;
  is_active: boolean;
  is_passive: boolean;
  watchlist: string[];
  config: Record<string, unknown>;
  account: { cash: number; initial_capital: number } | null;
  total_trades: number;
}

function getSecret(): string {
  return localStorage.getItem("volta_secret") ?? "";
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, message: msg });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/agents", {
        headers: { Authorization: `Bearer ${getSecret()}` },
      });
      if (res.ok) {
        setAgents(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // ---- Quick Actions (screening / trading / force trade) ----

  const runAction = async (
    action: "trade" | "screen" | "force",
    url: string,
    body: Record<string, unknown>
  ) => {
    setBusy(action);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: getSecret(), ...body }),
      });
      const data = await res.json();
      if (data.error) {
        showToast("error", data.error);
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
      }
      fetchAgents();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  // ---- Agent Actions ----

  const toggleActive = async (agent: AgentRow) => {
    setBusy(agent.id);
    try {
      await fetch(`/api/admin/agents/${agent.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getSecret()}`,
        },
        body: JSON.stringify({ is_active: !agent.is_active }),
      });
      await fetchAgents();
      showToast("success", `${agent.name} ${agent.is_active ? "deactivated" : "activated"}`);
    } finally {
      setBusy(null);
    }
  };

  const resetAgent = async (agent: AgentRow) => {
    if (!confirm(`Reset ${agent.name}'s account to $100K? This deletes all trades and positions.`)) return;
    setBusy(agent.id);
    try {
      await fetch(`/api/admin/agents/${agent.id}/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getSecret()}` },
      });
      await fetchAgents();
      showToast("success", `${agent.name} reset to $100K`);
    } finally {
      setBusy(null);
    }
  };

  const deleteAgent = async (agent: AgentRow) => {
    if (!confirm(`Delete ${agent.name}? This cannot be undone.`)) return;
    setBusy(agent.id);
    try {
      await fetch(`/api/admin/agents/${agent.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getSecret()}` },
      });
      await fetchAgents();
      showToast("success", `${agent.name} deleted`);
    } finally {
      setBusy(null);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="space-y-5">
      {/* ---- Quick Actions ---- */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-3">
          Quick Actions
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
            onClick={() => runAction("force", "/api/trade", { force: true })}
            loading={busy === "force"}
            disabled={busy !== null}
            variant="ghost"
            hint="Skip market hours check (testing only)"
          >
            Force Trade
          </ActionBtn>
        </div>
      </div>

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

      {/* ---- Agents Header ---- */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Agents</h1>
        <a
          href="/admin/agents/new"
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-gray-950 text-sm font-semibold rounded-lg transition-colors"
        >
          + New Agent
        </a>
      </div>

      {/* ---- Agent List ---- */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          No agents yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`border rounded-xl p-4 transition-colors ${
                agent.is_active
                  ? "border-gray-800/60 bg-gray-900/40"
                  : "border-gray-800/30 bg-gray-900/20 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={`/admin/agents/${agent.id}`}
                      className="font-semibold text-gray-100 hover:text-yellow-400 transition-colors"
                    >
                      {agent.name}
                    </a>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                      {agent.model}
                    </span>
                    {agent.is_passive && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">
                        Passive
                      </span>
                    )}
                    {!agent.is_active && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>Cash: {agent.account ? fmt(Number(agent.account.cash)) : "--"}</span>
                    <span>Trades: {agent.total_trades}</span>
                    <span>Watchlist: {agent.watchlist.length}</span>
                    {(() => {
                      const tools = (agent.config as Record<string, unknown>)?.tools as string[] | undefined;
                      return tools && tools.length > 0 ? <span>Tools: {tools.length}</span> : null;
                    })()}
                  </div>
                </div>

                <div className="flex gap-1.5 shrink-0">
                  <SmallBtn
                    onClick={() => toggleActive(agent)}
                    disabled={busy === agent.id}
                  >
                    {agent.is_active ? "Deactivate" : "Activate"}
                  </SmallBtn>
                  <SmallBtn
                    onClick={() => resetAgent(agent)}
                    disabled={busy === agent.id}
                    variant="warning"
                  >
                    Reset
                  </SmallBtn>
                  <SmallBtn
                    onClick={() => deleteAgent(agent)}
                    disabled={busy === agent.id}
                    variant="danger"
                  >
                    Delete
                  </SmallBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

function SmallBtn({
  children,
  onClick,
  disabled,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "warning" | "danger";
}) {
  const styles = {
    default: "bg-gray-800/60 hover:bg-gray-700 text-gray-300 border-gray-700/50",
    warning: "bg-amber-900/30 hover:bg-amber-800/40 text-amber-400 border-amber-800/40",
    danger: "bg-red-900/30 hover:bg-red-800/40 text-red-400 border-red-800/40",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]}`}
    >
      {children}
    </button>
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
