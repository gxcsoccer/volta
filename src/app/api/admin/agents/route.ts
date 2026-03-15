// ============================================================
// Admin API: Agents CRUD
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

function isAuthed(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const secret = authHeader?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET;
}

/**
 * GET /api/admin/agents - List all agents with account summaries
 */
export async function GET(request: NextRequest) {
  if (!isAuthed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();

  const { data: agents, error } = await db
    .from("agents")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with account data
  const enriched = await Promise.all(
    (agents ?? []).map(async (agent) => {
      const { data: account } = await db
        .from("accounts")
        .select("*")
        .eq("agent_id", agent.id)
        .single();

      const { count: tradesCount } = await db
        .from("trades")
        .select("*", { count: "exact", head: true })
        .eq("account_id", account?.id ?? "");

      return {
        ...agent,
        account: account
          ? { cash: account.cash, initial_capital: account.initial_capital }
          : null,
        total_trades: tradesCount ?? 0,
      };
    })
  );

  return NextResponse.json(enriched);
}

/**
 * POST /api/admin/agents - Create a new agent with $100K account
 */
export async function POST(request: NextRequest) {
  if (!isAuthed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const db = getServiceClient();

  const {
    name,
    description = "",
    model,
    provider = "bailian",
    system_prompt = "",
    watchlist = ["SPY"],
    is_passive = false,
    config = {},
  } = body;

  if (!name || !model) {
    return NextResponse.json(
      { error: "name and model are required" },
      { status: 400 }
    );
  }

  // Build config JSONB
  const agentConfig = {
    model: {
      primary: model,
      temperature: config.model?.temperature ?? 0.7,
      max_tokens: config.model?.max_tokens ?? 1024,
      fallbacks: config.model?.fallbacks ?? [],
    },
    identity: {
      soul: system_prompt || config.identity?.soul || "",
      description: description || config.identity?.description || "",
    },
    tools: config.tools ?? [],
    skills: config.skills ?? [],
    rules: {
      max_position_pct: config.rules?.max_position_pct ?? 25,
      min_cash_pct: config.rules?.min_cash_pct ?? 10,
      max_trades_per_round: config.rules?.max_trades_per_round ?? 5,
      ...(config.rules?.stop_loss_pct ? { stop_loss_pct: config.rules.stop_loss_pct } : {}),
    },
  };

  // Insert agent
  const { data: agent, error: agentError } = await db
    .from("agents")
    .insert({
      name,
      description: agentConfig.identity.description,
      model,
      provider,
      system_prompt: agentConfig.identity.soul,
      watchlist,
      is_passive,
      is_active: true,
      config: agentConfig,
    })
    .select()
    .single();

  if (agentError) {
    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  // Create account with $100K
  const { error: accountError } = await db.from("accounts").insert({
    agent_id: agent.id,
  });

  if (accountError) {
    // Rollback agent
    await db.from("agents").delete().eq("id", agent.id);
    return NextResponse.json({ error: accountError.message }, { status: 500 });
  }

  return NextResponse.json(agent, { status: 201 });
}
