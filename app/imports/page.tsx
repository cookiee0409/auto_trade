import Link from "next/link";
import { CsvUpload } from "@/components/csv-upload";
import { HyperliquidImportForm } from "@/components/hyperliquid-import-form";

export default function ImportsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Imports</h1>
        <p className="mt-1 text-sm text-slate-400">CSV 업로드와 Hyperliquid 지갑 조회로 거래를 가져옵니다.</p>
      </header>

      <CsvUpload />

      <section className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
        <h2 className="text-base font-semibold text-white">CSV 표준 컬럼</h2>
        <p className="mt-2 text-sm text-slate-400">
          <Link href="/sample-trades.csv" className="text-info hover:text-white">샘플 CSV</Link>
          를 내려받아 같은 헤더로 업로드하세요. strategy 컬럼은 기존 전략명에 매칭되고, 없으면 새 전략을 만듭니다.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-ink p-3 text-xs text-slate-300">
{`exchange,symbol,side,status,entry_time,exit_time,entry_price,exit_price,quantity,leverage,planned_stop,planned_target,gross_pnl,fee,funding,net_pnl,strategy,setup_reason,exit_reason,emotion,mistake_type,notes`}
        </pre>
      </section>

      <section className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
        <h2 className="text-base font-semibold text-white">Hyperliquid</h2>
        <p className="mt-2 text-sm text-slate-400">최근 7일 fills를 조회해 포지션 단위 VWAP 거래로 병합합니다.</p>
        <HyperliquidImportForm />
      </section>
    </div>
  );
}
