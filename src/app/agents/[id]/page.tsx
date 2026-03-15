"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ---- Types ----

interface AgentDetail {
  agent: {
    id: string;
    name: string;
    description: string;
    model: string;
    provider: string;
    system_prompt: string;
    watchlist: string[];
    is_passive: boolean;
    config?: {
      tools?: string[];
      skills?: string[];
      rules?: {
        max_position_pct?: number;
        min_cash_pct?: number;
        max_trades_per_round?: number;
        stop_loss_pct?: number;
      };
    };
  };
  account: { cash: number; initial_capital: number };
  positions: {
    symbol: string;
    shares: number;
    avg_cost: number;
    current_price: number;
    market_value: number;
    unrealized_pnl: number;
  }[];
  trades: {
    id: string;
    symbol: string;
    side: string;
    shares: number;
    price: number;
    total: number;
    reasoning: string;
    created_at: string;
  }[];
  snapshots: {
    total_value: number;
    return_pct: number;
    created_at: string;
  }[];
  total_value: number;
  return_pct: number;
}

// ---- Helpers ----

const fmt = {
  usd: (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n),
  usd2: (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(n),
  pct: (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`,
  pnl: (n: number) => `${n >= 0 ? "+" : ""}${fmt.usd2(n)}`,
  date: (s: string) =>
    new Date(s).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  time: (s: string) =>
    new Date(s).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
};

const PIE_COLORS = [
  "#facc15", "#38bdf8", "#a78bfa", "#fb923c", "#34d399",
  "#f472b6", "#60a5fa", "#fbbf24", "#c084fc", "#fb7185",
  "#4ade80", "#e879f9", "#22d3ee", "#f97316", "#a3e635",
];

// ---- Page ----

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/agents/${id}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 mt-4">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="skeleton h-32 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (!data?.agent) {
    return (
      <div className="text-center py-20 text-gray-500">Agent not found</div>
    );
  }

  const { agent, account, positions, trades, snapshots, total_value, return_pct } = data;
  const cash = Number(account.cash);
  const positionsValue = positions.reduce((s, p) => s + p.market_value, 0);
  const cashPct = total_value > 0 ? (cash / total_value) * 100 : 100;

  // Chart data
  const chartData = snapshots.map((s) => ({
    time: fmt.date(s.created_at) + " " + fmt.time(s.created_at),
    value: s.total_value,
  }));

  // Allocation data for pie chart
  const allocData = [
    ...positions
      .sort((a, b) => b.market_value - a.market_value)
      .map((p) => ({
        name: p.symbol,
        value: p.market_value,
      })),
    ...(cash > 0 ? [{ name: "Cash", value: cash }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Back */}
      <a
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 transition-colors"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M15 19l-7-7 7-7" />
        </svg>
        Leaderboard
      </a>

      {/* ---- Hero ---- */}
      <div className="bg-gray-900/50 border border-gray-800/60 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {agent.name}
              </h1>
              {agent.is_passive && (
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30">
                  Passive
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400">{agent.description}</p>
            <div className="flex gap-2 flex-wrap">
              <Tag>{agent.model}</Tag>
              <Tag>{agent.provider}</Tag>
              <Tag>{agent.watchlist.length} watchlist</Tag>
            </div>
          </div>
          <div className="text-right space-y-0.5">
            <div className="text-3xl font-bold font-mono tabular-nums tracking-tight">
              {fmt.usd(total_value)}
            </div>
            <div
              className={`text-lg font-mono font-semibold tabular-nums ${
                return_pct >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {fmt.pct(return_pct)}
            </div>
          </div>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-5 border-t border-gray-800/60">
          <Stat label="Cash" value={fmt.usd(cash)} sub={`${cashPct.toFixed(0)}%`} />
          <Stat label="Invested" value={fmt.usd(positionsValue)} sub={`${(100 - cashPct).toFixed(0)}%`} />
          <Stat label="Positions" value={String(positions.length)} />
          <Stat label="Total Trades" value={String(trades.length)} />
          <Stat label="Watchlist" value={`${agent.watchlist.length} stocks`} />
        </div>
      </div>

      {/* ---- Charts row ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Performance chart */}
        <div className="lg:col-span-2 bg-gray-900/50 border border-gray-800/60 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Portfolio Value
          </h2>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#facc15" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#facc15" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  stroke="#374151"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#374151"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  width={52}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #1f2937",
                    borderRadius: "10px",
                    fontSize: "12px",
                    boxShadow: "0 8px 32px rgba(0,0,0,.4)",
                  }}
                  formatter={(value) => [
                    fmt.usd(Number(value)),
                    "Value",
                  ]}
                />
                <ReferenceLine
                  y={Number(account.initial_capital)}
                  stroke="#374151"
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#facc15"
                  strokeWidth={2}
                  fill="url(#valueGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-600 text-sm">
              Chart available after 2+ trading rounds
            </div>
          )}
        </div>

        {/* Allocation pie */}
        <div className="bg-gray-900/50 border border-gray-800/60 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Allocation
          </h2>
          {allocData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={allocData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {allocData.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={
                          allocData[idx].name === "Cash"
                            ? "#374151"
                            : PIE_COLORS[idx % PIE_COLORS.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #1f2937",
                      borderRadius: "10px",
                      fontSize: "12px",
                    }}
                    formatter={(value) => fmt.usd(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
                {allocData.map((d, idx) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          d.name === "Cash"
                            ? "#374151"
                            : PIE_COLORS[idx % PIE_COLORS.length],
                      }}
                    />
                    {d.name}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-gray-600 text-sm">
              No allocations yet
            </div>
          )}
        </div>
      </div>

      {/* ---- Positions ---- */}
      <div className="bg-gray-900/50 border border-gray-800/60 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Positions
        </h2>
        {positions.length === 0 ? (
          <p className="text-gray-600 text-sm py-4">No open positions</p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="pb-3 text-left font-medium">Symbol</th>
                  <th className="pb-3 text-right font-medium">Shares</th>
                  <th className="pb-3 text-right font-medium">Avg Cost</th>
                  <th className="pb-3 text-right font-medium">Price</th>
                  <th className="pb-3 text-right font-medium">Value</th>
                  <th className="pb-3 text-right font-medium">P&L</th>
                  <th className="pb-3 text-right font-medium">Weight</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {positions
                  .sort((a, b) => b.market_value - a.market_value)
                  .map((p) => {
                    const pnlPct =
                      Number(p.avg_cost) > 0
                        ? ((p.current_price - Number(p.avg_cost)) /
                            Number(p.avg_cost)) *
                          100
                        : 0;
                    const weight =
                      total_value > 0
                        ? (p.market_value / total_value) * 100
                        : 0;
                    return (
                      <tr
                        key={p.symbol}
                        className="border-t border-gray-800/40 hover:bg-gray-800/20 transition-colors"
                      >
                        <td className="py-3 text-left">
                          <span className="font-semibold text-gray-200 font-sans">
                            {p.symbol}
                          </span>
                        </td>
                        <td className="py-3 text-right text-gray-300">
                          {p.shares}
                        </td>
                        <td className="py-3 text-right text-gray-400">
                          {fmt.usd2(Number(p.avg_cost))}
                        </td>
                        <td className="py-3 text-right text-gray-300">
                          {fmt.usd2(p.current_price)}
                        </td>
                        <td className="py-3 text-right text-gray-200">
                          {fmt.usd(p.market_value)}
                        </td>
                        <td
                          className={`py-3 text-right font-semibold ${
                            p.unrealized_pnl >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {fmt.pnl(p.unrealized_pnl)}
                          <span className="text-[10px] ml-1 opacity-70">
                            ({pnlPct >= 0 ? "+" : ""}
                            {pnlPct.toFixed(1)}%)
                          </span>
                        </td>
                        <td className="py-3 text-right text-gray-500">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-yellow-400/60 rounded-full"
                                style={{ width: `${Math.min(weight, 100)}%` }}
                              />
                            </div>
                            <span className="text-[11px] w-8">
                              {weight.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Trade History ---- */}
      <div className="bg-gray-900/50 border border-gray-800/60 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Trade History
          {trades.length > 0 && (
            <span className="ml-2 text-gray-600 normal-case">
              ({trades.length})
            </span>
          )}
        </h2>
        {trades.length === 0 ? (
          <p className="text-gray-600 text-sm py-4">No trades yet</p>
        ) : (
          <div className="space-y-2">
            {trades.map((t) => (
              <div
                key={t.id}
                className="group flex flex-col gap-1.5 px-4 py-3 rounded-xl bg-gray-800/20 hover:bg-gray-800/40 transition-colors border border-transparent hover:border-gray-800/60"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        t.side === "buy"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {t.side}
                    </span>
                    <span className="font-semibold text-gray-200 text-sm">
                      {t.symbol}
                    </span>
                    <span className="text-gray-500 text-xs font-mono tabular-nums">
                      {t.shares} &times; {fmt.usd2(Number(t.price))}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-semibold text-sm text-gray-300 tabular-nums">
                      {fmt.usd(Number(t.total))}
                    </span>
                    <span className="text-[11px] text-gray-600 tabular-nums shrink-0">
                      {fmt.date(t.created_at)} {fmt.time(t.created_at)}
                    </span>
                  </div>
                </div>
                {t.reasoning && (
                  <p className="text-xs text-gray-500 leading-relaxed pl-[3.25rem]">
                    {t.reasoning}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Watchlist ---- */}
      <div className="bg-gray-900/50 border border-gray-800/60 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Watchlist
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {agent.watchlist.map((s) => (
            <span
              key={s}
              className="text-xs font-mono px-2 py-1 rounded-md bg-gray-800/60 text-gray-400"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* ---- Tools & Skills ---- */}
      {!agent.is_passive && (agent.config?.tools?.length || agent.config?.skills?.length || agent.config?.rules) && (
        <div className="bg-gray-900/50 border border-gray-800/60 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Configuration
          </h2>
          <div className="flex flex-wrap gap-4 text-xs">
            {agent.config?.tools && agent.config.tools.length > 0 && (
              <div>
                <span className="text-gray-500">Tools:</span>{" "}
                {agent.config.tools.map((t) => (
                  <span key={t} className="inline-block px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 mr-1.5 mb-1">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {agent.config?.skills && agent.config.skills.length > 0 && (
              <div>
                <span className="text-gray-500">Skills:</span>{" "}
                {agent.config.skills.map((s) => (
                  <span key={s} className="inline-block px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 mr-1.5 mb-1">
                    {s}
                  </span>
                ))}
              </div>
            )}
            {agent.config?.rules && (
              <div className="text-gray-500">
                Rules: max {agent.config.rules.max_position_pct}% position,
                min {agent.config.rules.min_cash_pct}% cash,
                {agent.config.rules.max_trades_per_round} trades/round
                {agent.config.rules.stop_loss_pct && `, ${agent.config.rules.stop_loss_pct}% stop-loss`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Strategy ---- */}
      {!agent.is_passive && (
        <details className="bg-gray-900/50 border border-gray-800/60 rounded-2xl p-5 group">
          <summary className="text-sm font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none flex items-center gap-2">
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              className="transition-transform group-open:rotate-90"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            Strategy Prompt
          </summary>
          <pre className="mt-4 text-sm text-gray-400 whitespace-pre-wrap leading-relaxed font-sans">
            {agent.system_prompt}
          </pre>
        </details>
      )}
    </div>
  );
}

// ---- Sub-components ----

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-800/80 text-gray-400">
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
        {label}
      </div>
      <div className="font-mono font-semibold text-gray-200 tabular-nums mt-0.5">
        {value}
        {sub && (
          <span className="text-xs text-gray-500 font-normal ml-1">{sub}</span>
        )}
      </div>
    </div>
  );
}
