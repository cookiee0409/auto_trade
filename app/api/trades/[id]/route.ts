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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user, error } = await requireUser(request);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  const { data, error: queryError } = await supabase
    .from("trades")
    .select(tradeSelect)
    .eq("user_id", user.id)
    .eq("id", params.id)
    .single();

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 404 });
  return NextResponse.json({ trade: normalizeTrade(data) });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user, error } = await requireUser(request);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  const payload = await request.json();
  const ruleResults = extractRuleResults(payload);
  await assertStrategyBelongsToUser(supabase, user.id, payload.strategy_id);
  const update = buildTradePayload(payload);
  const { data, error: updateError } = await supabase
    .from("trades")
    .update(update)
    .eq("user_id", user.id)
    .eq("id", params.id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  try {
    await replaceTradeRules(supabase, user.id, params.id, ruleResults);
    return NextResponse.json({ trade: await loadSavedTrade(supabase, user.id, data.id) });
  } catch (saveError) {
    const message = saveError instanceof Error ? saveError.message : "Failed to save trade rules.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user, error } = await requireUser(request);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  const { error: deleteError } = await supabase
    .from("trades")
    .delete()
    .eq("user_id", user.id)
    .eq("id", params.id);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
