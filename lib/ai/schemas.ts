import { z } from "zod";

const confidenceSchema = z.enum(["low", "medium", "high"]);

const statSchema = z.object({
  trades: z.number(),
  win_rate: z.number().nullable(),
  expectancy: z.number().nullable(),
  profit_factor: z.number().nullable()
});

export const aiReviewSchema = z.object({
  summary: z.string(),
  process_score: z.number().int().min(0).max(100),
  outcome: z.object({
    net_pnl: z.number(),
    note: z.string()
  }),
  confidence: confidenceSchema,
  sample_size: z.number().int().min(0),
  data_quality_warnings: z.array(z.string()),
  key_findings: z.array(
    z.object({
      finding: z.string(),
      evidence: z.string(),
      related_trade_ids: z.array(z.string()),
      confidence: confidenceSchema
    })
  ),
  best_strategies: z.array(
    z.object({
      strategy_name: z.string(),
      reason: z.string(),
      stats: statSchema
    })
  ),
  worst_strategies: z.array(
    z.object({
      strategy_name: z.string(),
      reason: z.string(),
      stats: statSchema
    })
  ),
  repeated_mistakes: z.array(
    z.object({
      mistake: z.string(),
      evidence: z.string(),
      related_trade_ids: z.array(z.string()),
      fix: z.string()
    })
  ),
  rule_violations: z.array(
    z.object({
      trade_id: z.string(),
      violation: z.string(),
      impact: z.string()
    })
  ),
  behavioral_observations: z.object({
    disposition_effect: z.string(),
    revenge_trading: z.string(),
    sizing_consistency: z.string()
  }),
  keep_doing: z.array(
    z.object({
      item: z.string(),
      rationale: z.string(),
      supporting_stat: z.string()
    })
  ),
  stop_doing: z.array(
    z.object({
      item: z.string(),
      rationale: z.string(),
      supporting_stat: z.string()
    })
  ),
  experiments_next_week: z.array(
    z.object({
      experiment: z.string(),
      why: z.string()
    })
  ),
  risk_warnings: z.array(z.string())
});

export type AiReviewResult = z.infer<typeof aiReviewSchema>;
