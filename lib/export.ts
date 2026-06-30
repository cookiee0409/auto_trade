import type { Trade } from "@/lib/types";

const columns = [
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
  "setup_reason",
  "exit_reason",
  "emotion",
  "mistake_type",
  "notes"
] as const;

export function tradesToCsv(trades: Trade[]) {
  const lines = [columns.join(",")];
  for (const trade of trades) {
    lines.push(columns.map((column) => quoteCsv(trade[column] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

const reviewColumns = [
  "period_start",
  "period_end",
  "scope_type",
  "scope_value",
  "trade_count",
  "process_score",
  "outcome_pnl",
  "confidence",
  "status",
  "summary_text",
  "model",
  "prompt_version",
  "created_at"
] as const;

export function reviewsToCsv(reviews: Array<Record<string, unknown>>) {
  const lines = [reviewColumns.join(",")];
  for (const review of reviews) {
    lines.push(reviewColumns.map((column) => quoteCsv(review[column] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function quoteCsv(value: unknown) {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
