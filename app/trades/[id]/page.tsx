import { notFound } from "next/navigation";
import { Badge } from "@/components/badge";
import { ScreenshotUpload } from "@/components/screenshot-upload";
import { TradeReviewButton } from "@/components/trade-review-button";
import { TradeEditor } from "@/components/trade-editor";
import { loadRulesForUser, loadStrategiesForUser, loadTradeForUser } from "@/lib/data";
import { requireServerUser } from "@/lib/supabase/server";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default async function TradeDetailPage({ params }: { params: { id: string } }) {
  const { supabase, user } = await requireServerUser();
  if (!user) {
    return (
      <div className="rounded-md border border-line bg-panel p-6 shadow-dashboard">
        <h1 className="text-xl font-semibold text-white">로그인이 필요합니다</h1>
        <p className="mt-2 text-sm text-slate-400">거래 상세를 보려면 먼저 로그인하세요.</p>
      </div>
    );
  }

  const [trade, strategies, rules] = await Promise.all([
    loadTradeForUser(supabase, user.id, params.id),
    loadStrategiesForUser(supabase, user.id),
    loadRulesForUser(supabase, user.id)
  ]);
  if (!trade) notFound();

  const followed = trade.rule_results?.filter((rule) => rule.status === "followed") ?? [];
  const violated = trade.rule_results?.filter((rule) => rule.status === "violated") ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{trade.symbol} Trade Detail</h1>
          <p className="mt-1 text-sm text-slate-400">{trade.exchange} · {trade.side} · {trade.status}</p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <Badge tone={Number(trade.net_pnl ?? 0) >= 0 ? "good" : "bad"}>{trade.net_pnl ? formatCurrency(Number(trade.net_pnl)) : "open"}</Badge>
          <TradeReviewButton tradeId={trade.id} entryTime={trade.entry_time} />
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          ["진입가", formatNumber(Number(trade.entry_price))],
          ["청산가", trade.exit_price ? formatNumber(Number(trade.exit_price)) : "-"],
          ["계획 손절", trade.planned_stop ? formatNumber(Number(trade.planned_stop)) : "-"],
          ["R배수", trade.r_multiple ? formatNumber(Number(trade.r_multiple)) : "-"]
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-line bg-panel p-4">
            <div className="text-xs text-slate-400">{label}</div>
            <div className="mt-2 text-xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-md border border-line bg-panel p-4">
          <h2 className="text-base font-semibold text-white">복기 입력</h2>
          <dl className="mt-4 grid gap-4 md:grid-cols-2">
            <Detail label="진입 가설" value={trade.hypothesis} />
            <Detail label="진입 이유" value={trade.setup_reason} />
            <Detail label="청산 이유" value={trade.exit_reason} />
            <Detail label="다시 한다면" value={trade.retro_note} />
            <Detail label="감정" value={trade.emotion} />
            <Detail label="실수 유형" value={trade.mistake_type} />
          </dl>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-line bg-panel p-4">
            <h2 className="text-base font-semibold text-white">규칙</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {followed.map((rule) => <Badge key={rule.rule_id ?? rule.rule_name} tone="good">{rule.rule_name}</Badge>)}
              {violated.map((rule) => <Badge key={rule.rule_id ?? rule.rule_name} tone="bad">{rule.rule_name}</Badge>)}
              {followed.length + violated.length === 0 ? <span className="text-sm text-slate-400">기록된 규칙이 없습니다.</span> : null}
            </div>
          </div>
          <div className="rounded-md border border-line bg-panel p-4">
            <h2 className="text-base font-semibold text-white">스크린샷</h2>
            <div className="mt-3 grid gap-3">
              {(trade.screenshots ?? []).length > 0 ? trade.screenshots?.map((screenshot) => (
                <figure key={screenshot.id} className="overflow-hidden rounded-md border border-line bg-ink">
                  {screenshot.signed_url ? <img src={screenshot.signed_url} alt={screenshot.caption ?? "trade screenshot"} className="w-full object-cover" /> : null}
                  <figcaption className="px-3 py-2 text-xs text-slate-400">{screenshot.caption ?? screenshot.storage_path}</figcaption>
                </figure>
              )) : (
                <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-line bg-ink text-sm text-slate-500">
                  no screenshots
                </div>
              )}
            </div>
            <ScreenshotUpload tradeId={trade.id} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-white">이 거래만 수정</h2>
        <TradeEditor initialTrade={trade} strategies={strategies} rules={rules} />
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-1 rounded-md border border-line bg-ink/55 p-3 text-sm text-slate-200">
        {value || "-"}
      </dd>
    </div>
  );
}
