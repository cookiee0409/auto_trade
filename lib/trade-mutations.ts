import { deriveTradeFields } from "@/lib/trade-calculations";
import { normalizeTrade, tradeSelect } from "@/lib/data";
import type { RuleStatus, Trade } from "@/lib/types";

const tradeFields = [
  "exchange",
  "symbol",
  "side",
  "status",
  "entry_time",
  "exit_time",
  "entry_price",
  "exit_price",
  "quantity",
  "leverage",
  "notional_usd",
  "planned_stop",
  "planned_target",
  "initial_risk",
  "r_multiple",
  "gross_pnl",
  "fee",
  "funding",
  "net_pnl",
  "pnl_percent",
  "strategy_id",
  "hypothesis",
  "setup_reason",
  "exit_reason",
  "retro_note",
  "notes",
  "emotion",
  "mistake_type",
  "source",
  "external_trade_ids",
  "dedup_key"
] as const;

export interface RuleMutation {
  rule_id: string;
  status: RuleStatus;
}

export function extractRuleResults(payload: any): RuleMutation[] | undefined {
  if (!Array.isArray(payload.rule_results)) return undefined;
  return payload.rule_results
    .filter((item: any) => item?.rule_id && (item.status === "followed" || item.status === "violated"))
    .map((item: any) => ({
      rule_id: String(item.rule_id),
      status: item.status
    }));
}

export function buildTradePayload(payload: any, userId?: string) {
  const trade: Record<string, unknown> = {};
  for (const field of tradeFields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      trade[field] = payload[field] === "" ? null : payload[field];
    }
  }
  if (userId) trade.user_id = userId;
  return deriveTradeFields(trade as Partial<Trade>);
}

export async function assertStrategyBelongsToUser(supabase: any, userId: string, strategyId: unknown) {
  if (!strategyId) return;
  const { data, error } = await supabase
    .from("strategies")
    .select("id")
    .eq("user_id", userId)
    .eq("id", strategyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("strategy_id does not belong to the current user.");
}

export async function replaceTradeRules(
  supabase: any,
  userId: string,
  tradeId: string,
  rules: RuleMutation[] | undefined
) {
  if (rules === undefined) return;

  const ruleIds = [...new Set(rules.map((rule) => rule.rule_id))];
  if (ruleIds.length > 0) {
    const { data, error } = await supabase
      .from("rules")
      .select("id")
      .eq("user_id", userId)
      .in("id", ruleIds);
    if (error) throw new Error(error.message);
    if ((data ?? []).length !== ruleIds.length) {
      throw new Error("One or more rules do not belong to the current user.");
    }
  }

  const { error: deleteError } = await supabase
    .from("trade_rules")
    .delete()
    .eq("user_id", userId)
    .eq("trade_id", tradeId);
  if (deleteError) throw new Error(deleteError.message);

  if (rules.length === 0) return;

  const { error: insertError } = await supabase.from("trade_rules").insert(
    rules.map((rule) => ({
      user_id: userId,
      trade_id: tradeId,
      rule_id: rule.rule_id,
      status: rule.status
    }))
  );
  if (insertError) throw new Error(insertError.message);
}

export async function loadSavedTrade(supabase: any, userId: string, tradeId: string) {
  const { data, error } = await supabase
    .from("trades")
    .select(tradeSelect)
    .eq("user_id", userId)
    .eq("id", tradeId)
    .single();
  if (error) throw new Error(error.message);
  return normalizeTrade(data);
}
