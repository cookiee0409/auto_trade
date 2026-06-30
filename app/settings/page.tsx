import Link from "next/link";
import { Badge } from "@/components/badge";
import { ResetDataAction } from "@/components/settings-actions";

export default function SettingsPage() {
  const supabaseReady = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const openAiReady = Boolean(process.env.OPENAI_API_KEY);
  const cronReady = Boolean(process.env.CRON_SECRET);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">연결 상태, export, 초기화, 가져오기 설정을 확인합니다.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">Supabase</h2>
            <Badge tone={supabaseReady ? "good" : "warn"}>{supabaseReady ? "connected" : "missing env"}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-400">Auth, Postgres, Storage, RLS 기반 개인 데이터 저장소입니다.</p>
        </div>
        <div className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">AI Provider</h2>
            <Badge tone={openAiReady ? "good" : "warn"}>{openAiReady ? "OpenAI" : "missing key"}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-400">JSON 스키마 검증을 통과한 한국어 복기 리포트를 생성합니다.</p>
        </div>
        <div className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">Cron</h2>
            <Badge tone={cronReady ? "good" : "warn"}>{cronReady ? "secret set" : "disabled"}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-400">CRON_SECRET이 없으면 주간 복기 엔드포인트는 실행되지 않습니다.</p>
        </div>
      </section>

      <section className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
        <h2 className="text-base font-semibold text-white">Export</h2>
        <p className="mt-2 text-sm text-slate-400">로그인 쿠키 기준으로 현재 사용자 데이터만 다운로드합니다.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link className="focus-ring rounded-md bg-info px-4 py-2 text-sm font-semibold text-ink" href="/api/export?kind=trades&format=csv">거래 CSV</Link>
          <Link className="focus-ring rounded-md border border-line px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/7" href="/api/export?kind=trades&format=json">거래 JSON</Link>
          <Link className="focus-ring rounded-md bg-info px-4 py-2 text-sm font-semibold text-ink" href="/api/export?kind=reviews&format=csv">리포트 CSV</Link>
          <Link className="focus-ring rounded-md border border-line px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/7" href="/api/export?kind=reviews&format=json">리포트 JSON</Link>
        </div>
      </section>

      <section className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
        <h2 className="text-base font-semibold text-white">CSV / Hyperliquid 안내</h2>
        <p className="mt-2 text-sm text-slate-400">CSV strategy 컬럼은 전략명으로 매칭됩니다. Hyperliquid 지갑 주소는 Imports 화면에서 브라우저 로컬 저장소에 보관됩니다.</p>
      </section>

      <ResetDataAction />
    </div>
  );
}
