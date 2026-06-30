import { NextResponse, type NextRequest } from "next/server";
import { buildReviewInput } from "@/lib/ai/build-input";
import { getAiReviewProvider } from "@/lib/ai/provider";
import { REVIEW_PROMPT_VERSION } from "@/lib/ai/prompts";
import { validateAiReview } from "@/lib/ai/validate";
import { getRecentKstWindow } from "@/lib/time";
import { requireUser } from "@/lib/supabase/server";
import type { ReviewScope, Trade } from "@/lib/types";

export async function POST(request: NextRequest) {
  const { supabase, user, error } = await requireUser(request);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const window = getRecentKstWindow(7);
  const periodStart = body.period_start ? new Date(body.period_start) : window.start;
  const periodEnd = body.period_end ? new Date(body.period_end) : window.end;
  const scope: ReviewScope = {
    type: body.scope_type ?? "all",
    value: body.scope_value ?? null
  };
  if (scope.type === "trade" && !scope.value) {
    return NextResponse.json({ error: "scope_value is required for trade reviews." }, { status: 400 });
  }

  const existing = await findExistingReview(supabase, user.id, periodStart, periodEnd, scope);
  if (existing?.status === "done") {
    return NextResponse.json({ skipped: true, review: existing });
  }

  const trades = scope.type === "trade" && scope.value
    ? await loadTradeById(supabase, user.id, scope.value)
    : await loadTrades(supabase, user.id, periodStart, periodEnd);
  const input = buildReviewInput({ trades, periodStart, periodEnd, scope });

  const reviewRecord = existing ?? await insertPendingReview(supabase, user.id, periodStart, periodEnd, scope, input);

  try {
    const provider = getAiReviewProvider();
    let completion = await provider.completeReview(input);
    let validated;
    try {
      validated = validateAiReview(completion.content, input);
    } catch (firstError) {
      completion = await provider.completeReview(input, "이전 응답은 JSON 파싱 또는 스키마 검증에 실패했다. JSON만 출력하라.");
      validated = validateAiReview(completion.content, input);
    }

    const { data, error: updateError } = await supabase
      .from("ai_reviews")
      .update({
        input_summary_json: input,
        result_json: validated.review,
        summary_text: validated.review.summary,
        process_score: validated.review.process_score,
        outcome_pnl: validated.review.outcome.net_pnl,
        confidence: validated.review.confidence,
        model: completion.model,
        prompt_version: REVIEW_PROMPT_VERSION,
        token_usage: completion.token_usage ?? null,
        trade_count: input.sample_size,
        status: "done",
        error_message: null
      })
      .eq("id", reviewRecord.id)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ review: data });
  } catch (reviewError) {
    const message = reviewError instanceof Error ? reviewError.message : "AI review failed";
    await supabase
      .from("ai_reviews")
      .update({ status: "failed", error_message: message })
      .eq("id", reviewRecord.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function loadTradeById(supabase: any, userId: string, tradeId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("*, strategies(id,name,status), trade_rules(status, rules(id,name))")
    .eq("user_id", userId)
    .eq("id", tradeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Trade not found.");
  return [normalizeTradeForReview(data)];
}

async function loadTrades(supabase: any, userId: string, start: Date, end: Date): Promise<Trade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("*, strategies(id,name,status), trade_rules(status, rules(id,name))")
    .eq("user_id", userId)
    .gte("entry_time", start.toISOString())
    .lt("entry_time", end.toISOString())
    .order("entry_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeTradeForReview);
}

function normalizeTradeForReview(row: any): Trade {
  return {
    ...row,
    strategy: row.strategies,
    strategy_name: row.strategies?.name ?? null,
    rule_results: (row.trade_rules ?? []).map((item: any) => ({
      rule_id: item.rules?.id,
      rule_name: item.rules?.name ?? "unknown",
      status: item.status
    }))
  };
}

async function findExistingReview(
  supabase: any,
  userId: string,
  start: Date,
  end: Date,
  scope: ReviewScope
) {
  let query = supabase
    .from("ai_reviews")
    .select("*")
    .eq("user_id", userId)
    .eq("period_start", start.toISOString())
    .eq("period_end", end.toISOString())
    .eq("scope_type", scope.type);
  query = scope.value === null ? query.is("scope_value", null) : query.eq("scope_value", scope.value);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function insertPendingReview(
  supabase: any,
  userId: string,
  start: Date,
  end: Date,
  scope: ReviewScope,
  input: unknown
) {
  const { data, error } = await supabase
    .from("ai_reviews")
    .insert({
      user_id: userId,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      scope_type: scope.type,
      scope_value: scope.value,
      input_summary_json: input,
      trade_count: 0,
      status: "pending",
      prompt_version: REVIEW_PROMPT_VERSION
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
