"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface SkillOption {
  id: string;
  name: string;
  description: string;
  category: string;
}

const AVAILABLE_TOOLS = [
  { id: "technical_analysis", name: "Technical Analysis", description: "RSI, SMA, MACD calculations" },
  { id: "historical_bars", name: "Historical Bars", description: "OHLCV K-line data" },
  { id: "news_search", name: "News Search", description: "Recent financial news" },
  { id: "earnings_data", name: "Earnings & Fundamentals", description: "P/E, dividend yield, market cap" },
  { id: "sector_heatmap", name: "Sector Heatmap", description: "S&P 500 sector performance" },
];

function getSecret(): string {
  return localStorage.getItem("volta_secret") ?? "";
}

interface AgentData {
  id: string;
  name: string;
  description: string;
  model: string;
  provider: string;
  system_prompt: string;
  watchlist: string[];
  is_active: boolean;
  is_passive: boolean;
  config: {
    model?: { primary?: string; temperature?: number; max_tokens?: number };
    identity?: { soul?: string; description?: string };
    tools?: string[];
    skills?: string[];
    rules?: {
      max_position_pct?: number;
      min_cash_pct?: number;
      max_trades_per_round?: number;
      stop_loss_pct?: number;
    };
  };
}

export default function EditAgentPage() {
  const { id } = useParams();
  const router = useRouter();
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillOption[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [provider, setProvider] = useState("");
  const [soul, setSoul] = useState("");
  const [description, setDescription] = useState("");
  const [watchlistInput, setWatchlistInput] = useState("");
  const [isPassive, setIsPassive] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [maxPositionPct, setMaxPositionPct] = useState(25);
  const [minCashPct, setMinCashPct] = useState(10);
  const [maxTradesPerRound, setMaxTradesPerRound] = useState(5);
  const [stopLossPct, setStopLossPct] = useState<number | "">("");
  const [temperature, setTemperature] = useState(0.7);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAgent = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/agents`, {
        headers: { Authorization: `Bearer ${getSecret()}` },
      });
      if (!res.ok) return;
      const agents = await res.json();
      const found = agents.find((a: AgentData) => a.id === id);
      if (found) {
        setAgent(found);
        setName(found.name);
        setModel(found.config?.model?.primary ?? found.model);
        setProvider(found.provider);
        setSoul(found.config?.identity?.soul ?? found.system_prompt);
        setDescription(found.config?.identity?.description ?? found.description);
        setWatchlistInput(found.watchlist.join(", "));
        setIsPassive(found.is_passive);
        setIsActive(found.is_active);
        setSelectedTools(found.config?.tools ?? []);
        setSelectedSkills(found.config?.skills ?? []);
        setMaxPositionPct(found.config?.rules?.max_position_pct ?? 25);
        setMinCashPct(found.config?.rules?.min_cash_pct ?? 10);
        setMaxTradesPerRound(found.config?.rules?.max_trades_per_round ?? 5);
        setStopLossPct(found.config?.rules?.stop_loss_pct ?? "");
        setTemperature(found.config?.model?.temperature ?? 0.7);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAgent();
    fetch("/api/admin/skills", {
      headers: { Authorization: `Bearer ${getSecret()}` },
    })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSkills(data); })
      .catch(console.error);
  }, [fetchAgent]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const watchlist = watchlistInput
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const res = await fetch(`/api/admin/agents/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getSecret()}`,
        },
        body: JSON.stringify({
          name,
          provider,
          watchlist,
          is_active: isActive,
          is_passive: isPassive,
          config: {
            model: { primary: model, temperature, max_tokens: 1024 },
            identity: { soul, description },
            tools: selectedTools,
            skills: selectedSkills,
            rules: {
              max_position_pct: maxPositionPct,
              min_cash_pct: minCashPct,
              max_trades_per_round: maxTradesPerRound,
              ...(stopLossPct ? { stop_loss_pct: Number(stopLossPct) } : {}),
            },
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      showToast("Agent updated");
      await fetchAgent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset account to $100K? This deletes all trades and positions.")) return;
    await fetch(`/api/admin/agents/${id}/reset`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getSecret()}` },
    });
    showToast("Account reset to $100K");
  };

  const handleDelete = async () => {
    if (!confirm("Delete this agent? This cannot be undone.")) return;
    await fetch(`/api/admin/agents/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getSecret()}` },
    });
    router.push("/admin");
  };

  const toggleTool = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
    );
  };

  const toggleSkill = (skillName: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillName) ? prev.filter((s) => s !== skillName) : [...prev, skillName]
    );
  };

  if (loading) {
    return <div className="skeleton h-96 rounded-xl" />;
  }

  if (!agent) {
    return <div className="text-center py-20 text-gray-500">Agent not found</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <a href="/admin" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
          Agents
        </a>
        <span className="text-gray-700">/</span>
        <h1 className="text-xl font-bold">{agent.name}</h1>
      </div>

      {toast && (
        <div className="px-4 py-2 rounded-lg text-sm bg-emerald-950/60 text-emerald-300 border border-emerald-900/60">
          {toast}
        </div>
      )}
      {error && (
        <div className="px-4 py-2 rounded-lg text-sm bg-red-950/60 text-red-300 border border-red-900/60">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Info */}
        <Section title="Basic Info">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" required />
          </Field>
          <Field label="Description">
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Model">
              <input value={model} onChange={(e) => setModel(e.target.value)} className="input-field" required />
            </Field>
            <Field label="Provider">
              <input value={provider} onChange={(e) => setProvider(e.target.value)} className="input-field" />
            </Field>
          </div>
          <Field label="Temperature">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-mono text-gray-400 w-8">{temperature}</span>
            </div>
          </Field>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={isPassive}
                onChange={(e) => setIsPassive(e.target.checked)}
              />
              Passive (buy & hold)
            </label>
          </div>
        </Section>

        {/* Soul */}
        {!isPassive && (
          <Section title="Soul (System Prompt)">
            <textarea
              value={soul}
              onChange={(e) => setSoul(e.target.value)}
              rows={10}
              className="input-field font-mono text-xs leading-relaxed"
            />
          </Section>
        )}

        {/* Watchlist */}
        <Section title="Watchlist">
          <textarea
            value={watchlistInput}
            onChange={(e) => setWatchlistInput(e.target.value)}
            rows={3}
            className="input-field font-mono text-xs"
          />
        </Section>

        {/* Tools */}
        {!isPassive && (
          <Section title="Tools">
            <div className="space-y-2">
              {AVAILABLE_TOOLS.map((tool) => (
                <label
                  key={tool.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTools.includes(tool.id)
                      ? "border-yellow-400/40 bg-yellow-400/5"
                      : "border-gray-800/50 bg-gray-800/20 hover:border-gray-700/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTools.includes(tool.id)}
                    onChange={() => toggleTool(tool.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-200">{tool.name}</div>
                    <div className="text-xs text-gray-500">{tool.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </Section>
        )}

        {/* Skills */}
        {!isPassive && skills.length > 0 && (
          <Section title="Skills">
            <div className="space-y-2">
              {skills.map((skill) => (
                <label
                  key={skill.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedSkills.includes(skill.name)
                      ? "border-yellow-400/40 bg-yellow-400/5"
                      : "border-gray-800/50 bg-gray-800/20 hover:border-gray-700/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSkills.includes(skill.name)}
                    onChange={() => toggleSkill(skill.name)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-200">
                      {skill.name}
                      <span className="text-[10px] text-gray-500 ml-2">{skill.category}</span>
                    </div>
                    <div className="text-xs text-gray-500">{skill.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </Section>
        )}

        {/* Rules */}
        {!isPassive && (
          <Section title="Risk Rules">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Max Position %">
                <input
                  type="number"
                  value={maxPositionPct}
                  onChange={(e) => setMaxPositionPct(Number(e.target.value))}
                  min={5}
                  max={100}
                  className="input-field"
                />
              </Field>
              <Field label="Min Cash %">
                <input
                  type="number"
                  value={minCashPct}
                  onChange={(e) => setMinCashPct(Number(e.target.value))}
                  min={0}
                  max={100}
                  className="input-field"
                />
              </Field>
              <Field label="Max Trades/Round">
                <input
                  type="number"
                  value={maxTradesPerRound}
                  onChange={(e) => setMaxTradesPerRound(Number(e.target.value))}
                  min={1}
                  max={20}
                  className="input-field"
                />
              </Field>
              <Field label="Stop Loss %">
                <input
                  type="number"
                  value={stopLossPct}
                  onChange={(e) => setStopLossPct(e.target.value ? Number(e.target.value) : "")}
                  min={1}
                  max={50}
                  placeholder="Optional"
                  className="input-field"
                />
              </Field>
            </div>
          </Section>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-gray-950 text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 bg-amber-900/30 hover:bg-amber-800/40 text-amber-400 text-sm font-medium rounded-lg border border-amber-800/40 transition-colors cursor-pointer"
          >
            Reset Account
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2.5 bg-red-900/30 hover:bg-red-800/40 text-red-400 text-sm font-medium rounded-lg border border-red-800/40 transition-colors cursor-pointer"
          >
            Delete Agent
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        {title}
      </h2>
      <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-4 space-y-4">
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      {children}
    </div>
  );
}
