// ============================================================
// Aurum Signal Tool - Read monthly rotation signal from Aurum
// ============================================================

import { getServiceClient } from "../supabase";
import type { ToolDefinition } from "./types";

export const aurumSignalTool: ToolDefinition = {
  id: "aurum_signal",
  name: "Aurum Rotation Signal",
  description:
    "Get the current monthly asset rotation signal from the Aurum strategy evolution system. " +
    "Returns which ETF to hold this month (e.g. SPY, QQQ, EFA, EEM, TLT, GLD, or SHY). " +
    "The signal is computed offline using multi-period momentum with volatility adjustment.",
  category: "strategy",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async (): Promise<string> => {
    try {
      const supabase = getServiceClient();
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("aurum_signals")
        .select("*")
        .eq("strategy_name", "rotation_v1")
        .lte("valid_from", today)
        .order("valid_from", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return JSON.stringify({
          error: "No active Aurum signal found",
          fallback: "Hold SHY (cash equivalent) when no signal is available",
          target_asset: "SHY",
        });
      }

      // Signal staleness detection (>45 days = stale)
      const signalDate = new Date(data.valid_from);
      const daysSinceSignal = Math.floor(
        (Date.now() - signalDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const isStale = daysSinceSignal > 45;

      const metadata = (data.metadata ?? {}) as Record<string, unknown>;
      const scores =
        (metadata?.momentum_scores as Record<string, number>) ?? {};

      // Format momentum ranking
      const ranking = Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .map(
          ([asset, score], i) =>
            `${i + 1}. ${asset}: ${(score * 100).toFixed(1)}%`
        )
        .join(", ");

      return JSON.stringify({
        target_asset: isStale ? "SHY" : data.target_asset,
        target_weight: data.target_weight,
        valid_from: data.valid_from,
        valid_until: data.valid_until,
        is_stale: isStale,
        stale_warning: isStale
          ? `Signal is ${daysSinceSignal} days old, auto-degraded to SHY. Check signal publishing.`
          : null,
        momentum_ranking: ranking,
      });
    } catch (err) {
      return JSON.stringify({
        error: `Failed to fetch Aurum signal: ${err instanceof Error ? err.message : String(err)}`,
        target_asset: "SHY",
      });
    }
  },
};
