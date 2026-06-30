"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { Badge } from "@/components/badge";
import { TradeEditor } from "@/components/trade-editor";
import type { Rule, Strategy, Trade } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/utils";

export function TradesManager({
  initialTrades,
  strategies,
  rules
}: {
  initialTrades: Trade[];
  strategies: Strategy[];
  rules: Rule[];
}) {
  const [trades, setTrades] = useState(initialTrades);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Trades</h1>
          <p className="mt-1 text-sm text-slate-400">진입 이유, 규칙 준수, 감정, 손익을 Supabase에 저장합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="focus-ring inline-flex items-center gap-2 rounded-md bg-info px-4 py-2 text-sm font-semibold text-ink"
        >
          <Plus size={17} aria-hidden />
          새 거래
        </button>
      </header>

      {showForm ? (
        <TradeEditor
          strategies={strategies}
          rules={rules}
          onSaved={(trade) => {
            setTrades((current) => [trade, ...current.filter((item) => item.id !== trade.id)]);
            setShowForm(false);
          }}
        />
      ) : null}

      <section className="overflow-hidden rounded-md border border-line bg-panel shadow-dashboard">
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full border-collapse text-sm">
            <thead className="bg-ink text-xs uppercase tracking-normal text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">거래일</th>
                <th className="px-4 py-3 text-left">심볼</th>
                <th className="px-4 py-3 text-left">방향</th>
                <th className="px-4 py-3 text-left">상태</th>
                <th className="px-4 py-3 text-right">진입가</th>
                <th className="px-4 py-3 text-right">청산가</th>
                <th className="px-4 py-3 text-right">R배수</th>
                <th className="px-4 py-3 text-right">손익</th>
                <th className="px-4 py-3 text-left">전략</th>
                <th className="px-4 py-3 text-left">규칙</th>
                <th className="px-4 py-3 text-left">감정</th>
                <th className="px-4 py-3 text-left">보기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {trades.length > 0 ? trades.map((trade) => {
                const violated = trade.rule_results?.filter((rule) => rule.status === "violated") ?? [];
                return (
                  <tr key={trade.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-300">{new Date(trade.entry_time).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</td>
                    <td className="px-4 py-3 font-medium text-white">{trade.symbol}</td>
                    <td className="px-4 py-3"><Badge tone={trade.side === "long" ? "good" : "bad"}>{trade.side}</Badge></td>
                    <td className="px-4 py-3"><Badge tone={trade.status === "closed" ? "neutral" : "info"}>{trade.status}</Badge></td>
                    <td className="px-4 py-3 text-right text-slate-300">{formatNumber(Number(trade.entry_price))}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{trade.exit_price ? formatNumber(Number(trade.exit_price)) : "-"}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{trade.r_multiple ? formatNumber(Number(trade.r_multiple)) : "-"}</td>
                    <td className={Number(trade.net_pnl ?? 0) >= 0 ? "px-4 py-3 text-right text-good" : "px-4 py-3 text-right text-bad"}>{trade.net_pnl ? formatCurrency(Number(trade.net_pnl)) : "-"}</td>
                    <td className="px-4 py-3 text-slate-300">{trade.strategy_name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {violated.length > 0 ? violated.map((rule) => <Badge key={rule.rule_id ?? rule.rule_name} tone="bad">{rule.rule_name}</Badge>) : <Badge tone="good">위반 없음</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{trade.emotion ?? "-"}</td>
                    <td className="px-4 py-3">
                      <Link className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-300 hover:text-white" href={`/trades/${trade.id}`} title="거래 상세">
                        <Eye size={16} aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-sm text-slate-400">
                    저장된 거래가 없습니다. 새 거래를 추가하거나 CSV를 가져오세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
