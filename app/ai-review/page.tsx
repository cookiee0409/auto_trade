import { BrainCircuit } from "lucide-react";
import { AiReviewRunner } from "@/components/ai-review-runner";
import { Badge } from "@/components/badge";
import { MetricCard } from "@/components/metric-card";
import { loadAiReviewsForUser, loadTradesForUser } from "@/lib/data";
import { requireServerUser } from "@/lib/supabase/server";
import { calculateTradeMetrics } from "@/lib/trade-metrics";
import { getRecentKstWindow } from "@/lib/time";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

export default async function AiReviewPage() {
  const { supabase, user } = await requireServerUser();
  const window = getRecentKstWindow(7);

  if (!user) {
    return (
      <div className="rounded-md border border-line bg-panel p-6 shadow-dashboard">
        <h1 className="text-xl font-semibold text-white">로그인이 필요합니다</h1>
        <p className="mt-2 text-sm text-slate-400">AI 리포트를 생성하고 조회하려면 먼저 로그인하세요.</p>
      </div>
    );
  }

  const [reviews, trades] = await Promise.all([
    loadAiReviewsForUser(supabase, user.id, 10),
    loadTradesForUser(supabase, user.id)
  ]);
  const metrics = calculateTradeMetrics(trades);
  const latest = reviews[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">AI Review</h1>
          <p className="mt-1 text-sm text-slate-400">기간과 범위를 선택해 한국어 복기 리포트를 저장합니다.</p>
        </div>
        <Badge tone="info">process_score != outcome</Badge>
      </header>

      <AiReviewRunner defaultStart={toDateInput(window.start)} defaultEnd={toDateInput(window.end)} />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="과정 점수" value={latest?.process_score === null || latest?.process_score === undefined ? "-" : `${latest.process_score} / 100`} tone="warn" detail="규율 기준" />
        <MetricCard label="결과 손익" value={formatCurrency(Number(latest?.outcome_pnl ?? metrics.net_pnl))} tone={Number(latest?.outcome_pnl ?? metrics.net_pnl) >= 0 ? "good" : "bad"} />
        <MetricCard label="신뢰도" value={latest?.confidence ?? "-"} detail={(latest?.trade_count ?? metrics.total_trades) < 20 ? "표본 20건 미만" : undefined} />
      </section>

      <section className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
        <div className="flex items-center gap-2">
          <BrainCircuit size={18} className="text-info" aria-hidden />
          <h2 className="text-base font-semibold text-white">최근 리포트</h2>
        </div>
        <div className="mt-4 space-y-3">
          {reviews.length > 0 ? reviews.map((review) => (
            <article key={review.id} className="rounded-md border border-line bg-ink/55 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-medium text-white">
                  {formatKstDate(review.period_start)} - {formatKstDate(review.period_end)} · {review.scope_type}{review.scope_value ? `:${review.scope_value}` : ""}
                </div>
                <Badge tone={review.status === "done" ? review.confidence === "high" ? "good" : "warn" : review.status === "failed" ? "bad" : "info"}>
                  {review.status === "done" ? review.confidence ?? "done" : review.status}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{review.summary_text ?? review.error_message ?? "아직 결과가 없습니다."}</p>
              <ReviewDetails result={review.result_json} />
            </article>
          )) : (
            <div className="rounded-md border border-dashed border-line bg-ink/55 p-6 text-sm text-slate-400">생성된 리포트가 없습니다.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function ReviewDetails({ result }: { result: any }) {
  if (!result || typeof result !== "object") return null;

  return (
    <details className="mt-4 rounded-md border border-line bg-panel/60 p-3">
      <summary className="cursor-pointer text-sm font-medium text-white">상세 보기</summary>
      <div className="mt-4 space-y-4">
        <ListSection
          title="핵심 발견"
          items={result.key_findings}
          render={(item: any) => (
            <>
              <div className="font-medium text-white">{item.finding}</div>
              <p className="mt-1 text-slate-400">{item.evidence}</p>
              {item.related_trade_ids?.length ? <p className="mt-1 text-xs text-slate-500">trades: {item.related_trade_ids.join(", ")}</p> : null}
            </>
          )}
        />
        <ListSection
          title="반복 실수"
          items={result.repeated_mistakes}
          render={(item: any) => (
            <>
              <div className="font-medium text-white">{item.mistake}</div>
              <p className="mt-1 text-slate-400">{item.evidence}</p>
              <p className="mt-1 text-info">{item.fix}</p>
            </>
          )}
        />
        {result.behavioral_observations ? (
          <div>
            <h3 className="text-sm font-semibold text-white">행동 관찰</h3>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <Mini label="Disposition" value={result.behavioral_observations.disposition_effect} />
              <Mini label="Revenge" value={result.behavioral_observations.revenge_trading} />
              <Mini label="Sizing" value={result.behavioral_observations.sizing_consistency} />
            </div>
          </div>
        ) : null}
        <ListSection
          title="계속할 것"
          items={result.keep_doing}
          render={(item: any) => (
            <>
              <div className="font-medium text-white">{item.item}</div>
              <p className="mt-1 text-slate-400">{item.rationale}</p>
              <p className="mt-1 text-xs text-slate-500">{item.supporting_stat}</p>
            </>
          )}
        />
        <ListSection
          title="중단할 것"
          items={result.stop_doing}
          render={(item: any) => (
            <>
              <div className="font-medium text-white">{item.item}</div>
              <p className="mt-1 text-slate-400">{item.rationale}</p>
              <p className="mt-1 text-xs text-slate-500">{item.supporting_stat}</p>
            </>
          )}
        />
        <ListSection
          title="다음 주 실험"
          items={result.experiments_next_week}
          render={(item: any) => (
            <>
              <div className="font-medium text-white">{item.experiment}</div>
              <p className="mt-1 text-slate-400">{item.why}</p>
            </>
          )}
        />
        <SimpleList title="위험 경고" items={result.risk_warnings} />
        <SimpleList title="데이터 품질 경고" items={result.data_quality_warnings} />
        <StrategySection title="강한 전략" items={result.best_strategies} />
        <StrategySection title="약한 전략" items={result.worst_strategies} />
      </div>
    </details>
  );
}

function ListSection({
  title,
  items,
  render
}: {
  title: string;
  items?: any[];
  render: (item: any) => React.ReactNode;
}) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <div key={index} className="rounded-md border border-line bg-ink/70 p-3 text-sm">
            {render(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

function SimpleList({ title, items }: { title: string; items?: string[] }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-2 space-y-1 text-sm text-slate-400">
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}

function StrategySection({ title, items }: { title: string; items?: any[] }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <ListSection
      title={title}
      items={items}
      render={(item) => (
        <>
          <div className="font-medium text-white">{item.strategy_name}</div>
          <p className="mt-1 text-slate-400">{item.reason}</p>
          {item.stats ? (
            <p className="mt-1 text-xs text-slate-500">
              trades {item.stats.trades}, win {formatPercent(item.stats.win_rate)}, expectancy {formatCurrency(item.stats.expectancy)}, PF {formatNumber(item.stats.profit_factor)}
            </p>
          ) : null}
        </>
      )}
    />
  );
}

function Mini({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md border border-line bg-ink/70 p-3 text-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-slate-300">{value || "-"}</div>
    </div>
  );
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatKstDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
}
