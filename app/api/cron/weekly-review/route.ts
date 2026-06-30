import { NextResponse, type NextRequest } from "next/server";
import { buildReviewInput } from "@/lib/ai/build-input";
import { getAiReviewProvider } from "@/lib/ai/provider";
import { REVIEW_PROMPT_VERSION } from "@/lib/ai/prompts";
import { validateAiReview } from "@/lib/ai/validate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRecentKstWindow } from "@/lib/time";
import type { Trade } from "@/lib/types";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = process.env.APP_USER_ID;
  if (!userId) return NextResponse.json({ error: "APP_USER_ID is not configured." }, { status: 500 });

  const supabase = createSupabaseAdminClient();
  const { start, end } = getRecentKstWindow(7);
  const scope = { type: "all" as const, value: null };

  let existingQuery = supabase
    .from("ai_reviews")
    .select("*")
    .eq("user_id", userId)
    .eq("period_start", start.toISOString())
    .eq("period_end", end.toISOString())
    .eq("scope_type", scope.type)
    .is("scope_value", null);
  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing?.status === "done") return NextResponse.json({ skipped: true, review: existing });

  const { data: rows, error: tradeError } = await supabase
    .from("trades")
    .select("*, strategies(id,name,status), trade_rules(status, rules(id,name))")
    .eq("user_id", userId)
    .gte("entry_time", start.toISOString())
    .lt("entry_time", end.toISOString())
    .order("entry_time", { ascending: true });
  if (tradeError) return NextResponse.json({ error: tradeError.message }, { status: 500 });

  const trades: Trade[] = (rows ?? []).map((row: any) => ({
    ...row,
    strategy: row.strategies,
    strategy_name: row.strategies?.name ?? null,
    rule_results: (row.trade_rules ?? []).map((item: any) => ({
      rule_id: item.rules?.id,
      rule_name: item.rules?.name ?? "unknown",
      status: item.status
    }))
  }));
  const input = buildReviewInput({ trades, periodStart: start, periodEnd: end, scope });

  const { data: pending, error: pendingError } = existing
    ? await supabase.from("ai_reviews").update({ status: "pending", input_summary_json: input }).eq("id", existing.id).select().single()
    : await supabase.from("ai_reviews").insert({
        user_id: userId,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        scope_type: "all",
        scope_value: null,
        trade_count: input.sample_size,
        input_summary_json: input,
        status: "pending",
        prompt_version: REVIEW_PROMPT_VERSION
      }).select().single();
  if (pendingError) return NextResponse.json({ error: pendingError.message }, { status: 500 });

  try {
    const provider = getAiReviewProvider();
    let completion = await provider.completeReview(input);
    let validated;
    try {
      validated = validateAiReview(completion.content, input);
    } catch {
      completion = await provider.completeReview(input, "JSON만 출력하고 스키마를 정확히 지켜라.");
      validated = validateAiReview(completion.content, input);
    }
    const { data, error } = await supabase
      .from("ai_reviews")
      .update({
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
      .eq("id", pending.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ review: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "weekly review failed";
    await supabase.from("ai_reviews").update({ status: "failed", error_message: message }).eq("id", pending.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
