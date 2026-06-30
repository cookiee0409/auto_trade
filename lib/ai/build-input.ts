import { calculateGroupedMetrics, calculateTradeMetrics } from "@/lib/trade-metrics";
import { formatKstIso, minutesBetween } from "@/lib/time";
import type { ReviewScope, Trade, TradeMetrics } from "@/lib/types";

export interface ReviewInput {
  period: {
    start: string;
    end: string;
    timezone: "Asia/Seoul";
  };
  scope: ReviewScope;
  sample_size: number;
  data_quality: {
    trades_missing_planned_stop: number;
    trades_missing_strategy: number;
    low_sample: boolean;
  };
  aggregate_metrics: TradeMetrics;
  by_strategy: Array<{
    strategy_name: string;
    trades: number;
    win_rate: number | null;
    expectancy: number | null;
    profit_factor: number | null;
    net_pnl: number;
    max_drawdown: number;
  }>;
  by_symbol: Array<{
    symbol: string;
    trades: number;
    win_rate: number | null;
    expectancy: number | null;
    net_pnl: number;
  }>;
  process_metrics: {
    rule_adherence_rate: number | null;
    pnl_when_rules_followed: number;
    pnl_when_rules_violated: number;
    avg_hold_minutes_winners: number | null;
    avg_hold_minutes_losers: number | null;
    trades_after_loss_within_60min: number;
    size_increase_after_loss_count: number;
    risk_per_trade_stddev: number | null;
  };
  notable_trades: Array<{
    trade_id: string;
    symbol: string;
    side: string;
    strategy: string | null;
    net_pnl: number;
    r_multiple: number | null;
    planned_stop: number | null;
    exit_price: number | null;
    followed_rules: string[];
    violated_rules: string[];
    emotion: string | null;
    mistake_type: string | null;
    hypothesis: string | null;
    setup_reason: string | null;
    exit_reason: string | null;
    retro_note: string | null;
  }>;
}

export function buildReviewInput({
  trades,
  periodStart,
  periodEnd,
  scope = { type: "all", value: null }
}: {
  trades: Trade[];
  periodStart: Date;
  periodEnd: Date;
  scope?: ReviewScope;
}): ReviewInput {
  const scopedTrades = filterTradesByScope(trades, scope);
  const closedTrades = scopedTrades.filter((trade) => trade.status === "closed");
  const aggregate = calculateTradeMetrics(closedTrades);
  const byStrategy = calculateGroupedMetrics(
    closedTrades,
    (trade) => trade.strategy_name ?? trade.strategy?.name ?? "미지정"
  ).map((group) => ({
    strategy_name: group.label,
    trades: group.total_trades,
    win_rate: group.win_rate,
    expectancy: group.expectancy,
    profit_factor: group.profit_factor,
    net_pnl: group.net_pnl,
    max_drawdown: group.max_drawdown
  }));
  const bySymbol = calculateGroupedMetrics(closedTrades, (trade) => trade.symbol).map((group) => ({
    symbol: group.label,
    trades: group.total_trades,
    win_rate: group.win_rate,
    expectancy: group.expectancy,
    net_pnl: group.net_pnl
  }));

  return {
    period: {
      start: formatKstIso(periodStart),
      end: formatKstIso(periodEnd),
      timezone: "Asia/Seoul"
    },
    scope,
    sample_size: aggregate.total_trades,
    data_quality: {
      trades_missing_planned_stop: closedTrades.filter((trade) => trade.planned_stop == null).length,
      trades_missing_strategy: closedTrades.filter(
        (trade) => !trade.strategy_id && !trade.strategy_name && !trade.strategy?.name
      ).length,
      low_sample: aggregate.total_trades < 20
    },
    aggregate_metrics: aggregate,
    by_strategy: byStrategy,
    by_symbol: bySymbol,
    process_metrics: buildProcessMetrics(closedTrades),
    notable_trades: selectNotableTrades(closedTrades)
  };
}

export function filterTradesByScope(trades: Trade[], scope: ReviewScope) {
  if (scope.type === "losses") {
    return trades.filter((trade) => Number(trade.net_pnl ?? 0) < 0);
  }
  if (scope.type === "strategy" && scope.value) {
    return trades.filter(
      (trade) => trade.strategy_id === scope.value || trade.strategy_name === scope.value
    );
  }
  if (scope.type === "symbol" && scope.value) {
    return trades.filter((trade) => trade.symbol.toUpperCase() === scope.value?.toUpperCase());
  }
  if (scope.type === "trade" && scope.value) {
    return trades.filter((trade) => trade.id === scope.value);
  }
  return trades;
}

function buildProcessMetrics(trades: Trade[]): ReviewInput["process_metrics"] {
  let followed = 0;
  let violated = 0;
  let pnlWhenRulesFollowed = 0;
  let pnlWhenRulesViolated = 0;

  for (const trade of trades) {
    const ruleResults = getRuleResults(trade);
    const hasViolation = ruleResults.some((rule) => rule.status === "violated");
    followed += ruleResults.filter((rule) => rule.status === "followed").length;
    violated += ruleResults.filter((rule) => rule.status === "violated").length;
    if (hasViolation) pnlWhenRulesViolated += Number(trade.net_pnl ?? 0);
    else pnlWhenRulesFollowed += Number(trade.net_pnl ?? 0);
  }

  const winners = trades.filter((trade) => Number(trade.net_pnl ?? 0) > 0);
  const losers = trades.filter((trade) => Number(trade.net_pnl ?? 0) < 0);
  const risks = trades
    .map((trade) => Number(trade.initial_risk))
    .filter((value) => Number.isFinite(value) && value > 0);

  return {
    rule_adherence_rate:
      followed + violated === 0 ? null : round(followed / (followed + violated), 4),
    pnl_when_rules_followed: round(pnlWhenRulesFollowed, 4),
    pnl_when_rules_violated: round(pnlWhenRulesViolated, 4),
    avg_hold_minutes_winners: averageHoldMinutes(winners),
    avg_hold_minutes_losers: averageHoldMinutes(losers),
    trades_after_loss_within_60min: countTradesAfterLossWithin60Min(trades),
    size_increase_after_loss_count: countSizeIncreaseAfterLoss(trades),
    risk_per_trade_stddev: risks.length === 0 ? null : round(stddev(risks), 4)
  };
}

function selectNotableTrades(trades: Trade[]) {
  const selected = new Map<string, Trade>();
  const add = (trade: Trade) => {
    if (selected.size < 30) selected.set(trade.id, trade);
  };

  [...trades]
    .sort((a, b) => Math.abs(Number(b.net_pnl ?? 0)) - Math.abs(Number(a.net_pnl ?? 0)))
    .slice(0, 8)
    .forEach(add);
  trades.filter((trade) => getRuleResults(trade).some((rule) => rule.status === "violated")).forEach(add);
  trades.filter((trade) => Number(trade.r_multiple ?? 0) <= -1).forEach(add);
  trades
    .filter((trade) => trade.mistake_type && trade.mistake_type !== "none")
    .forEach(add);

  return [...selected.values()].slice(0, 30).map((trade) => {
    const rules = getRuleResults(trade);
    return {
      trade_id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      strategy: trade.strategy_name ?? trade.strategy?.name ?? null,
      net_pnl: Number(trade.net_pnl ?? 0),
      r_multiple: nullableNumber(trade.r_multiple),
      planned_stop: nullableNumber(trade.planned_stop),
      exit_price: nullableNumber(trade.exit_price),
      followed_rules: rules
        .filter((rule) => rule.status === "followed")
        .map((rule) => rule.rule_name),
      violated_rules: rules
        .filter((rule) => rule.status === "violated")
        .map((rule) => rule.rule_name),
      emotion: trade.emotion ?? null,
      mistake_type: trade.mistake_type ?? null,
      hypothesis: trade.hypothesis ?? null,
      setup_reason: trade.setup_reason ?? null,
      exit_reason: trade.exit_reason ?? null,
      retro_note: trade.retro_note ?? null
    };
  });
}

function getRuleResults(trade: Trade) {
  if (trade.rule_results?.length) return trade.rule_results;
  return [
    ...(trade.followed_rules ?? []).map((rule_name) => ({ rule_name, status: "followed" as const })),
    ...(trade.violated_rules ?? []).map((rule_name) => ({ rule_name, status: "violated" as const }))
  ];
}

function averageHoldMinutes(trades: Trade[]) {
  const minutes = trades
    .map((trade) => minutesBetween(trade.entry_time, trade.exit_time))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (minutes.length === 0) return null;
  return round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length, 2);
}

function countTradesAfterLossWithin60Min(trades: Trade[]) {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
  );
  let count = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const gap = previous.exit_time
      ? (new Date(current.entry_time).getTime() - new Date(previous.exit_time).getTime()) / 60000
      : null;
    if (Number(previous.net_pnl ?? 0) < 0 && gap !== null && gap >= 0 && gap <= 60) count += 1;
  }
  return count;
}

function countSizeIncreaseAfterLoss(trades: Trade[]) {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
  );
  let count = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (
      Number(previous.net_pnl ?? 0) < 0 &&
      Number(current.notional_usd ?? 0) > Number(previous.notional_usd ?? 0)
    ) {
      count += 1;
    }
  }
  return count;
}

function stddev(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function nullableNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}
