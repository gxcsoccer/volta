"use client";

import { useEffect, useState, useCallback } from "react";

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
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
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
      showToast(`${agent.name} ${agent.is_active ? "deactivated" : "activated"}`);
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
      showToast(`${agent.name} reset to $100K`);
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
      showToast(`${agent.name} deleted`);
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Agents</h1>
        <a
          href="/admin/agents/new"
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-gray-950 text-sm font-semibold rounded-lg transition-colors"
        >
          + New Agent
        </a>
      </div>

      {toast && (
        <div className="px-4 py-2 rounded-lg text-sm bg-emerald-950/60 text-emerald-300 border border-emerald-900/60">
          {toast}
        </div>
      )}

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
