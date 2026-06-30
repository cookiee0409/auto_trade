import { EquityChart } from "@/components/equity-chart";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/badge";
import { loadAiReviewsForUser, loadTradesForUser } from "@/lib/data";
import { requireServerUser } from "@/lib/supabase/server";
import { calculateGroupedMetrics, calculateTradeMetrics } from "@/lib/trade-metrics";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

export default async function DashboardPage() {
  const { supabase, user } = await requireServerUser();
  if (!user) return <EmptyState title="로그인이 필요합니다" message="왼쪽 사이드바에서 로그인하면 Supabase에 저장된 거래와 리포트를 불러옵니다." />;

  const [trades, reviews] = await Promise.all([
    loadTradesForUser(supabase, user.id),
    loadAiReviewsForUser(supabase, user.id, 1)
  ]);
  const metrics = calculateTradeMetrics(trades);
  const byStrategy = calculateGroupedMetrics(
    trades,
    (trade) => trade.strategy_id ?? "unassigned",
    (key) => trades.find((trade) => trade.strategy_id === key)?.strategy_name ?? "미지정"
  );
  const followed = trades.flatMap((trade) => trade.rule_results ?? []).filter((rule) => rule.status === "followed").length;
  const violated = trades.flatMap((trade) => trade.rule_results ?? []).filter((rule) => rule.status === "violated").length;
  const ruleRate = followed + violated === 0 ? null : followed / (followed + violated);
  const latestReview = reviews[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">Supabase에 저장된 거래 기준의 성과와 복기 요약입니다.</p>
        </div>
        <Badge tone="info">투자 조언 아님 · 거래 기록 분석</Badge>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="총 PnL" value={formatCurrency(metrics.net_pnl)} tone={metrics.net_pnl >= 0 ? "good" : "bad"} />
        <MetricCard label="승률" value={formatPercent(metrics.win_rate)} detail="본전 제외" />
        <MetricCard label="Profit Factor" value={metrics.profit_factor === null ? "-" : formatNumber(metrics.profit_factor)} />
        <MetricCard label="기대값" value={formatCurrency(metrics.expectancy)} />
        <MetricCard label="최대 낙폭" value={formatCurrency(metrics.max_drawdown)} detail="누적 PnL 기준" tone="warn" />
        <MetricCard label="평균 수익" value={formatCurrency(metrics.average_win)} />
        <MetricCard label="평균 손실" value={formatCurrency(metrics.average_loss)} />
        <MetricCard label="규칙 준수율" value={formatPercent(ruleRate)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <div className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">누적 PnL 곡선</h2>
            <span className="text-xs text-slate-400">closed 거래 기준</span>
          </div>
          {trades.length > 0 ? <EquityChart trades={trades} /> : <NoData message="아직 거래가 없습니다." />}
        </div>

        <div className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
          <h2 className="text-base font-semibold text-white">전략별 성과</h2>
          <div className="mt-4 space-y-3">
            {byStrategy.length > 0 ? byStrategy.map((strategy) => (
              <div key={strategy.key} className="rounded-md border border-line bg-ink/55 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-white">{strategy.label}</div>
                  <Badge tone={strategy.net_pnl >= 0 ? "good" : "bad"}>
                    {formatCurrency(strategy.net_pnl)}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-400">
                  <span>{strategy.total_trades} trades</span>
                  <span>{formatPercent(strategy.win_rate)}</span>
                  <span>PF {strategy.profit_factor === null ? "-" : formatNumber(strategy.profit_factor)}</span>
                </div>
              </div>
            )) : <NoData message="전략에 연결된 거래가 없습니다." />}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">최근 AI 복기</h2>
            <p className="mt-1 text-sm text-slate-400">과정 점수와 결과 손익을 분리해서 표시합니다.</p>
          </div>
          {latestReview?.confidence ? <Badge tone={latestReview.confidence === "high" ? "good" : latestReview.confidence === "medium" ? "info" : "warn"}>confidence {latestReview.confidence}</Badge> : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <MetricCard label="과정 점수" value={latestReview?.process_score === null || latestReview?.process_score === undefined ? "-" : `${latestReview.process_score} / 100`} tone="warn" />
          <MetricCard label="결과 손익" value={formatCurrency(Number(latestReview?.outcome_pnl ?? metrics.net_pnl))} tone={Number(latestReview?.outcome_pnl ?? metrics.net_pnl) >= 0 ? "good" : "bad"} />
          <MetricCard label="표본" value={`${latestReview?.trade_count ?? metrics.total_trades}건`} detail={(latestReview?.trade_count ?? metrics.total_trades) < 20 ? "20건 미만 경고" : undefined} />
        </div>
      </section>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-6 shadow-dashboard">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      <p className="mt-2 text-sm text-slate-400">{message}</p>
    </div>
  );
}

function NoData({ message }: { message: string }) {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed border-line bg-ink/60 text-sm text-slate-500">
      {message}
    </div>
  );
}
