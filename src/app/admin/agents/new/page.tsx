"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AVAILABLE_MODELS, getProviderForModel } from "@/lib/models";

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

export default function NewAgentPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillOption[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [model, setModel] = useState("qwen-plus");
  const [provider, setProvider] = useState("bailian");
  const [soul, setSoul] = useState("");
  const [description, setDescription] = useState("");
  const [watchlistInput, setWatchlistInput] = useState("SPY");
  const [isPassive, setIsPassive] = useState(false);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [maxPositionPct, setMaxPositionPct] = useState(25);
  const [minCashPct, setMinCashPct] = useState(10);
  const [maxTradesPerRound, setMaxTradesPerRound] = useState(5);
  const [stopLossPct, setStopLossPct] = useState<number | "">("");
  const [temperature, setTemperature] = useState(0.7);

  useEffect(() => {
    fetch("/api/admin/skills", {
      headers: { Authorization: `Bearer ${getSecret()}` },
    })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSkills(data); })
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !model.trim()) {
      setError("Name and model are required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const watchlist = watchlistInput
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const res = await fetch("/api/admin/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getSecret()}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          model: model.trim(),
          provider: provider.trim(),
          description: description.trim(),
          system_prompt: soul.trim(),
          watchlist,
          is_passive: isPassive,
          config: {
            model: {
              primary: model.trim(),
              temperature,
              max_tokens: 1024,
            },
            identity: {
              soul: soul.trim(),
              description: description.trim(),
            },
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
        setError(data.error || "Failed to create agent");
        return;
      }

      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const toggleTool = (id: string) => {
    setSelectedTools((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const toggleSkill = (name: string) => {
    setSelectedSkills((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <a href="/admin" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
          Agents
        </a>
        <span className="text-gray-700">/</span>
        <h1 className="text-xl font-bold">New Agent</h1>
      </div>

      {error && (
        <div className="px-4 py-2 rounded-lg text-sm bg-red-950/60 text-red-300 border border-red-900/60">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Section title="Basic Info">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Value Victor"
              className="input-field"
              required
            />
          </Field>
          <Field label="Description">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the agent's strategy"
              className="input-field"
            />
          </Field>
          <Field label="Model">
            <select
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setProvider(getProviderForModel(e.target.value));
              }}
              className="input-field"
              required
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
              ))}
            </select>
          </Field>
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
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={isPassive}
              onChange={(e) => setIsPassive(e.target.checked)}
              className="rounded"
            />
            Passive benchmark (buy & hold, no AI calls)
          </label>
        </Section>

        {/* Soul / System Prompt */}
        {!isPassive && (
          <Section title="Soul (System Prompt)">
            <textarea
              value={soul}
              onChange={(e) => setSoul(e.target.value)}
              placeholder="You are a conservative value investor. Your strategy:&#10;- Focus on established, large-cap companies..."
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
            placeholder="AAPL, MSFT, GOOGL, SPY"
            rows={3}
            className="input-field font-mono text-xs"
          />
          <p className="text-[11px] text-gray-600 mt-1">
            Comma or space separated ticker symbols
          </p>
        </Section>

        {/* Tools */}
        {!isPassive && (
          <Section title="Tools">
            <p className="text-xs text-gray-500 mb-3">
              Enable tools for multi-turn AI interaction. The agent can call these during decision-making.
            </p>
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
            <p className="text-xs text-gray-500 mb-3">
              Skills inject domain knowledge into the system prompt.
            </p>
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
              <Field label="Stop Loss % (optional)">
                <input
                  type="number"
                  value={stopLossPct}
                  onChange={(e) => setStopLossPct(e.target.value ? Number(e.target.value) : "")}
                  min={1}
                  max={50}
                  placeholder="e.g., 8"
                  className="input-field"
                />
              </Field>
            </div>
          </Section>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-gray-950 text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Agent"}
          </button>
          <a
            href="/admin"
            className="px-6 py-2.5 bg-gray-800/60 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-gray-700/50"
          >
            Cancel
          </a>
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
