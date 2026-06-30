export type NumericInput = string | number | null | undefined;

export const tradeSides = ["long", "short"] as const;
export type TradeSide = (typeof tradeSides)[number];

export const tradeStatuses = ["open", "closed"] as const;
export type TradeStatus = (typeof tradeStatuses)[number];

export const strategyStatuses = ["active", "testing", "paused", "retired"] as const;
export type StrategyStatus = (typeof strategyStatuses)[number];

export const emotions = [
  "calm",
  "confident",
  "fearful",
  "greedy",
  "fomo",
  "revenge",
  "bored",
  "frustrated"
] as const;
export type Emotion = (typeof emotions)[number];

export const mistakeTypes = [
  "none",
  "late_stop",
  "no_stop",
  "early_exit",
  "oversize",
  "revenge_trade",
  "chasing",
  "plan_deviation",
  "overtrading"
] as const;
export type MistakeType = (typeof mistakeTypes)[number];

export const ruleStatuses = ["followed", "violated"] as const;
export type RuleStatus = (typeof ruleStatuses)[number];

export type ReviewScopeType = "all" | "losses" | "strategy" | "symbol" | "trade";

export interface Strategy {
  id: string;
  user_id?: string;
  name: string;
  description?: string | null;
  status: StrategyStatus;
  created_at?: string;
  updated_at?: string;
}

export interface Rule {
  id: string;
  user_id?: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface Screenshot {
  id: string;
  user_id?: string;
  trade_id: string;
  storage_path: string;
  caption?: string | null;
  created_at?: string;
  signed_url?: string | null;
}

export interface TradeRuleResult {
  rule_id?: string;
  rule_name: string;
  status: RuleStatus;
}

export interface Trade {
  id: string;
  user_id?: string;
  exchange: string;
  symbol: string;
  side: TradeSide;
  status: TradeStatus;
  entry_time: string;
  exit_time?: string | null;
  entry_price: NumericInput;
  exit_price?: NumericInput;
  quantity: NumericInput;
  leverage?: NumericInput;
  notional_usd?: NumericInput;
  planned_stop?: NumericInput;
  planned_target?: NumericInput;
  initial_risk?: NumericInput;
  r_multiple?: NumericInput;
  gross_pnl?: NumericInput;
  fee?: NumericInput;
  funding?: NumericInput;
  net_pnl?: NumericInput;
  pnl_percent?: NumericInput;
  strategy_id?: string | null;
  strategy_name?: string | null;
  strategy?: Pick<Strategy, "id" | "name" | "status"> | null;
  hypothesis?: string | null;
  setup_reason?: string | null;
  exit_reason?: string | null;
  retro_note?: string | null;
  notes?: string | null;
  emotion?: Emotion | null;
  mistake_type?: MistakeType | null;
  source?: "manual" | "csv" | "hyperliquid";
  external_trade_ids?: string[] | null;
  dedup_key?: string | null;
  created_at?: string;
  updated_at?: string;
  rule_results?: TradeRuleResult[];
  followed_rules?: string[];
  violated_rules?: string[];
  screenshots?: Screenshot[];
}

export interface AiReview {
  id: string;
  user_id?: string;
  period_start: string;
  period_end: string;
  scope_type: ReviewScopeType;
  scope_value?: string | null;
  trade_count: number;
  input_summary_json?: unknown;
  result_json?: any;
  summary_text?: string | null;
  process_score?: number | null;
  outcome_pnl?: NumericInput;
  confidence?: "low" | "medium" | "high" | null;
  model?: string | null;
  prompt_version?: string | null;
  token_usage?: unknown;
  status: "pending" | "done" | "failed";
  error_message?: string | null;
  created_at?: string;
}

export interface TradeMetrics {
  total_trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  decisive: number;
  win_rate: number | null;
  loss_rate: number | null;
  average_win: number;
  average_loss: number;
  win_loss_ratio: number | null;
  gross_profit: number;
  gross_loss: number;
  profit_factor: number | null;
  expectancy: number | null;
  r_expectancy: number | null;
  total_fees: number;
  total_funding: number;
  net_pnl: number;
  max_consecutive_losses: number;
  max_drawdown: number;
}

export interface GroupedTradeMetrics extends TradeMetrics {
  key: string;
  label: string;
}

export interface ReviewScope {
  type: ReviewScopeType;
  value: string | null;
}
