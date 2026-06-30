"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/badge";
import type { Strategy, Trade } from "@/lib/types";
import { getAccessToken } from "@/lib/supabase/session";
import { calculateTradeMetrics } from "@/lib/trade-metrics";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

export function StrategiesManager({
  initialStrategies,
  trades
}: {
  initialStrategies: Strategy[];
  trades: Trade[];
}) {
  const [strategies, setStrategies] = useState(initialStrategies);
  const [message, setMessage] = useState("");

  async function createStrategy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const strategy = await request("/api/strategies", "POST", {
      name: text(form, "name"),
      description: text(form, "description"),
      status: text(form, "status") || "active"
    });
    setStrategies((current) => [strategy, ...current]);
    event.currentTarget.reset();
    setMessage("전략이 생성되었습니다.");
  }

  async function updateStrategy(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const strategy = await request(`/api/strategies/${id}`, "PATCH", {
      name: text(form, "name"),
      description: text(form, "description"),
      status: text(form, "status") || "active"
    });
    setStrategies((current) => current.map((item) => item.id === id ? strategy : item));
    setMessage("전략이 저장되었습니다.");
  }

  async function deleteStrategy(id: string) {
    await request(`/api/strategies/${id}`, "DELETE");
    setStrategies((current) => current.filter((item) => item.id !== id));
    setMessage("전략이 삭제되었습니다.");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Strategies</h1>
        <p className="mt-1 text-sm text-slate-400">전략별 승률, 기대값, Profit Factor, MDD를 실제 거래 기준으로 봅니다.</p>
      </header>

      <form onSubmit={createStrategy} className="grid gap-3 rounded-md border border-line bg-panel p-4 shadow-dashboard md:grid-cols-[1fr_2fr_160px_auto]">
        <input name="name" required placeholder="전략 이름" className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200" />
        <input name="description" placeholder="설명" className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200" />
        <select name="status" defaultValue="active" className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200">
          <option value="active">active</option>
          <option value="testing">testing</option>
          <option value="paused">paused</option>
          <option value="retired">retired</option>
        </select>
        <button className="focus-ring rounded-md bg-info px-4 py-2 text-sm font-semibold text-ink">추가</button>
      </form>
      {message ? <p className="text-sm text-slate-300">{message}</p> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        {strategies.length > 0 ? strategies.map((strategy) => {
          const strategyTrades = trades.filter((trade) => trade.strategy_id === strategy.id);
          const metrics = calculateTradeMetrics(strategyTrades);
          return (
            <article key={strategy.id} className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
              <form onSubmit={(event) => updateStrategy(event, strategy.id)} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <input name="name" defaultValue={strategy.name} required className="focus-ring min-w-0 flex-1 rounded-md border border-line bg-ink px-3 py-2 text-sm font-semibold text-white" />
                  <Badge tone={strategy.status === "active" ? "good" : strategy.status === "testing" ? "info" : "warn"}>{strategy.status}</Badge>
                </div>
                <textarea name="description" defaultValue={strategy.description ?? ""} rows={2} className="focus-ring w-full resize-y rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200" />
                <select name="status" defaultValue={strategy.status} className="focus-ring w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200">
                  <option value="active">active</option>
                  <option value="testing">testing</option>
                  <option value="paused">paused</option>
                  <option value="retired">retired</option>
                </select>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="거래" value={`${metrics.total_trades}`} />
                  <Stat label="승률" value={formatPercent(metrics.win_rate)} />
                  <Stat label="기대값" value={formatCurrency(metrics.expectancy)} />
                  <Stat label="PF" value={metrics.profit_factor === null ? "-" : formatNumber(metrics.profit_factor)} />
                  <Stat label="MDD" value={formatCurrency(metrics.max_drawdown)} />
                  <Stat label="손익" value={formatCurrency(metrics.net_pnl)} />
                </div>
                <div className="flex gap-2">
                  <button className="focus-ring flex-1 rounded-md bg-info px-3 py-2 text-sm font-semibold text-ink">저장</button>
                  <button type="button" onClick={() => void deleteStrategy(strategy.id)} className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-slate-300 hover:text-white">
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </form>
            </article>
          );
        }) : (
          <div className="rounded-md border border-line bg-panel p-6 text-sm text-slate-400">등록된 전략이 없습니다.</div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-ink/55 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 font-semibold text-white">{value}</div>
    </div>
  );
}

async function request(url: string, method: string, body?: unknown) {
  const token = await getAccessToken();
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Request failed");
  return payload.strategy ?? payload;
}

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
