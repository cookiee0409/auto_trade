import { aiReviewSchema, type AiReviewResult } from "@/lib/ai/schemas";
import type { ReviewInput } from "@/lib/ai/build-input";

export interface ValidatedReview {
  review: AiReviewResult;
  removed_hallucinated_ids: boolean;
}

export function stripJsonFences(raw: string) {
  return raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

export function validateAiReview(raw: string, input: ReviewInput): ValidatedReview {
  const parsed = JSON.parse(stripJsonFences(raw));
  const review = aiReviewSchema.parse(parsed);
  const allowedTradeIds = new Set(input.notable_trades.map((trade) => trade.trade_id));
  let removed = false;

  for (const finding of review.key_findings) {
    const filtered = finding.related_trade_ids.filter((id) => allowedTradeIds.has(id));
    if (filtered.length !== finding.related_trade_ids.length) removed = true;
    finding.related_trade_ids = filtered;
    if (input.sample_size < 20) finding.confidence = "low";
  }

  for (const mistake of review.repeated_mistakes) {
    const filtered = mistake.related_trade_ids.filter((id) => allowedTradeIds.has(id));
    if (filtered.length !== mistake.related_trade_ids.length) removed = true;
    mistake.related_trade_ids = filtered;
  }

  const ruleViolations = review.rule_violations.filter((violation) =>
    allowedTradeIds.has(violation.trade_id)
  );
  if (ruleViolations.length !== review.rule_violations.length) removed = true;
  review.rule_violations = ruleViolations;

  review.outcome.net_pnl = input.aggregate_metrics.net_pnl;
  review.sample_size = input.sample_size;

  if (input.sample_size < 20) {
    review.confidence = "low";
    pushWarning(review, "전체 표본이 20건 미만이라 모든 결론의 신뢰도를 낮게 해석해야 합니다.");
  }

  for (const strategy of input.by_strategy) {
    if (strategy.trades > 0 && strategy.trades < 10) {
      pushWarning(
        review,
        `${strategy.strategy_name} 전략 표본이 10건 미만이라 전략별 결론의 신뢰도가 낮습니다.`
      );
    }
  }

  if (removed) {
    pushWarning(review, "참조 불가 ID 제거됨");
  }

  return { review, removed_hallucinated_ids: removed };
}

function pushWarning(review: AiReviewResult, warning: string) {
  if (!review.data_quality_warnings.includes(warning)) {
    review.data_quality_warnings.push(warning);
  }
}
