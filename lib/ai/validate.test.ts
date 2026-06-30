import { describe, expect, it } from "vitest";
import { validateAiReview } from "@/lib/ai/validate";
import type { ReviewInput } from "@/lib/ai/build-input";

const input: ReviewInput = {
  period: {
    start: "2026-06-21T00:00:00+09:00",
    end: "2026-06-28T00:00:00+09:00",
    timezone: "Asia/Seoul"
  },
  scope: { type: "all", value: null },
  sample_size: 3,
  data_quality: {
    trades_missing_planned_stop: 0,
    trades_missing_strategy: 0,
    low_sample: true
  },
  aggregate_metrics: {
    total_trades: 3,
    wins: 1,
    losses: 2,
    breakeven: 0,
    decisive: 3,
    win_rate: 0.3333,
    loss_rate: 0.6667,
    average_win: 10,
    average_loss: 5,
    win_loss_ratio: 2,
    gross_profit: 10,
    gross_loss: 10,
    profit_factor: 1,
    expectancy: 0,
    r_expectancy: null,
    total_fees: 0,
    total_funding: 0,
    net_pnl: 7,
    max_consecutive_losses: 2,
    max_drawdown: -10
  },
  by_strategy: [{ strategy_name: "돌파", trades: 3, win_rate: 0.33, expectancy: 0, profit_factor: 1, net_pnl: 7, max_drawdown: -10 }],
  by_symbol: [{ symbol: "BTC", trades: 3, win_rate: 0.33, expectancy: 0, net_pnl: 7 }],
  process_metrics: {
    rule_adherence_rate: 0.5,
    pnl_when_rules_followed: 10,
    pnl_when_rules_violated: -3,
    avg_hold_minutes_winners: 30,
    avg_hold_minutes_losers: 90,
    trades_after_loss_within_60min: 1,
    size_increase_after_loss_count: 1,
    risk_per_trade_stddev: 2
  },
  notable_trades: [
    {
      trade_id: "8841deea-bd2f-4575-aa30-c4f383564404",
      symbol: "BTC",
      side: "long",
      strategy: "돌파",
      net_pnl: 7,
      r_multiple: 1,
      planned_stop: 100,
      exit_price: 120,
      followed_rules: ["손절 준수"],
      violated_rules: [],
      emotion: "calm",
      mistake_type: "none",
      hypothesis: null,
      setup_reason: null,
      exit_reason: null,
      retro_note: null
    }
  ]
};

function validPayload() {
  return {
    summary: "표본은 작지만 규칙 위반이 손익에 영향을 줬다.",
    process_score: 62,
    outcome: { net_pnl: 999, note: "결과는 표본 크기와 운에 영향받음" },
    confidence: "medium",
    sample_size: 99,
    data_quality_warnings: [],
    key_findings: [
      {
        finding: "손실 후 재진입이 보인다.",
        evidence: "1건 확인",
        related_trade_ids: ["8841deea-bd2f-4575-aa30-c4f383564404", "missing"],
        confidence: "medium"
      }
    ],
    best_strategies: [
      { strategy_name: "돌파", reason: "순손익 양수", stats: { trades: 3, win_rate: 0.33, expectancy: 0, profit_factor: 1 } }
    ],
    worst_strategies: [],
    repeated_mistakes: [
      { mistake: "복수매매", evidence: "60분 내 재진입", related_trade_ids: ["missing"], fix: "휴식 규칙 체크" }
    ],
    rule_violations: [
      { trade_id: "missing", violation: "없는 거래", impact: "제거 대상" },
      { trade_id: "8841deea-bd2f-4575-aa30-c4f383564404", violation: "손절 지연", impact: "손실 확대" }
    ],
    behavioral_observations: {
      disposition_effect: "손실 보유가 길다.",
      revenge_trading: "손실 직후 재진입이 있다.",
      sizing_consistency: "초기 위험 편차가 있다."
    },
    keep_doing: [{ item: "기록 유지", rationale: "분석 가능", supporting_stat: "3건" }],
    stop_doing: [{ item: "손실 후 즉시 재진입", rationale: "복수매매 신호", supporting_stat: "1건" }],
    experiments_next_week: [{ experiment: "손실 후 60분 휴식", why: "감정 거래 완화" }],
    risk_warnings: ["투자 조언 아님"]
  };
}

describe("validateAiReview", () => {
  it("removes hallucinated trade ids and enforces low-sample guards", () => {
    const result = validateAiReview(JSON.stringify(validPayload()), input);
    expect(result.removed_hallucinated_ids).toBe(true);
    expect(result.review.confidence).toBe("low");
    expect(result.review.outcome.net_pnl).toBe(7);
    expect(result.review.key_findings[0].related_trade_ids).toEqual([
      "8841deea-bd2f-4575-aa30-c4f383564404"
    ]);
    expect(result.review.rule_violations).toHaveLength(1);
    expect(result.review.data_quality_warnings).toContain("참조 불가 ID 제거됨");
  });
});
