"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Badge } from "@/components/badge";
import { MetricCard } from "@/components/metric-card";
import { getAccessToken } from "@/lib/supabase/session";
import { formatCurrency } from "@/lib/utils";

type ReviewRecord = {
  id: string;
  result_json?: any;
  summary_text?: string | null;
  process_score?: number | null;
  outcome_pnl?: string | number | null;
  confidence?: "low" | "medium" | "high" | null;
  trade_count?: number;
};

export function AiReviewRunner({
  defaultStart,
  defaultEnd
}: {
  defaultStart: string;
  defaultEnd: string;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<ReviewRecord | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setStatus("");

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/ai/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          period_start: form.get("period_start"),
          period_end: form.get("period_end"),
          scope_type: form.get("scope_type"),
          scope_value: form.get("scope_value") || null
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "AI review failed");
      setReview(payload.review);
      setStatus(payload.skipped ? "이미 생성된 리포트를 불러왔습니다." : "리포트 생성 완료");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI review failed");
    } finally {
      setBusy(false);
    }
  }

  const result = review?.result_json;

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_160px_1fr_auto]">
          <input
            name="period_start"
            type="date"
            className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200"
            defaultValue={defaultStart}
          />
          <input
            name="period_end"
            type="date"
            className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200"
            defaultValue={defaultEnd}
          />
          <select
            name="scope_type"
            className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200"
            defaultValue="all"
          >
            <option value="all">전체</option>
            <option value="losses">손실만</option>
            <option value="strategy">특정 전략</option>
            <option value="symbol">특정 심볼</option>
            <option value="trade">특정 거래 ID</option>
          </select>
          <input
            name="scope_value"
            placeholder="전략명, 심볼 또는 거래 ID"
            className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200"
          />
          <button
            disabled={busy}
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-info px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
          >
            <Play size={17} aria-hidden />
            생성
          </button>
        </div>
        {status ? <p className="mt-3 text-sm text-slate-300">{status}</p> : null}
      </form>

      {review ? (
        <section className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">생성된 리포트</h2>
            {review.confidence ? <Badge tone={review.confidence === "high" ? "good" : review.confidence === "medium" ? "info" : "warn"}>{review.confidence}</Badge> : null}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <MetricCard label="과정 점수" value={review.process_score === null || review.process_score === undefined ? "-" : `${review.process_score} / 100`} tone="warn" />
            <MetricCard label="결과 손익" value={formatCurrency(Number(review.outcome_pnl ?? result?.outcome?.net_pnl))} tone={Number(review.outcome_pnl ?? result?.outcome?.net_pnl ?? 0) >= 0 ? "good" : "bad"} />
            <MetricCard label="표본" value={`${review.trade_count ?? result?.sample_size ?? 0}건`} detail={(review.trade_count ?? result?.sample_size ?? 0) < 20 ? "20건 미만" : undefined} />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">{review.summary_text ?? result?.summary}</p>
          {result?.data_quality_warnings?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {result.data_quality_warnings.map((warning: string) => <Badge key={warning} tone="warn">{warning}</Badge>)}
            </div>
          ) : null}
          {result?.key_findings?.length ? (
            <div className="mt-4 space-y-3">
              {result.key_findings.map((finding: any, index: number) => (
                <article key={`${finding.finding}-${index}`} className="rounded-md border border-line bg-ink/55 p-3">
                  <div className="font-medium text-white">{finding.finding}</div>
                  <p className="mt-1 text-sm text-slate-400">{finding.evidence}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
