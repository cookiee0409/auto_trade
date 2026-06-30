import { NextResponse, type NextRequest } from "next/server";
import { normalizeTrade, tradeSelect } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import {
  assertStrategyBelongsToUser,
  buildTradePayload,
  extractRuleResults,
  loadSavedTrade,
  replaceTradeRules
} from "@/lib/trade-mutations";

export async function GET(request: NextRequest) {
  const { supabase, user, error } = await requireUser(request);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  const { data, error: queryError } = await supabase
    .from("trades")
    .select(tradeSelect)
    .eq("user_id", user.id)
    .order("entry_time", { ascending: false });

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ trades: (data ?? []).map(normalizeTrade) });
}

export async function POST(request: NextRequest) {
  const { supabase, user, error } = await requireUser(request);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  const payload = await request.json();
  const ruleResults = extractRuleResults(payload);
  await assertStrategyBelongsToUser(supabase, user.id, payload.strategy_id);
  const trade = buildTradePayload({ ...payload, source: payload.source ?? "manual" }, user.id);

  const { data, error: insertError } = await supabase
    .from("trades")
    .insert(trade)
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  try {
    await replaceTradeRules(supabase, user.id, data.id, ruleResults ?? []);
    return NextResponse.json({ trade: await loadSavedTrade(supabase, user.id, data.id) }, { status: 201 });
  } catch (saveError) {
    await supabase.from("trades").delete().eq("user_id", user.id).eq("id", data.id);
    const message = saveError instanceof Error ? saveError.message : "Failed to save trade rules.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
