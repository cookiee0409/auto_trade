"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/badge";
import type { Rule, Trade } from "@/lib/types";
import { getAccessToken } from "@/lib/supabase/session";
import { formatCurrency, formatPercent } from "@/lib/utils";

export function RulesManager({
  initialRules,
  trades
}: {
  initialRules: Rule[];
  trades: Trade[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [message, setMessage] = useState("");

  async function createRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rule = await request("/api/rules", "POST", {
      name: text(form, "name"),
      description: text(form, "description"),
      is_active: form.get("is_active") === "on"
    });
    setRules((current) => [rule, ...current]);
    event.currentTarget.reset();
    setMessage("규칙이 생성되었습니다.");
  }

  async function updateRule(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rule = await request(`/api/rules/${id}`, "PATCH", {
      name: text(form, "name"),
      description: text(form, "description"),
      is_active: form.get("is_active") === "on"
    });
    setRules((current) => current.map((item) => item.id === id ? rule : item));
    setMessage("규칙이 저장되었습니다.");
  }

  async function deleteRule(id: string) {
    await request(`/api/rules/${id}`, "DELETE");
    setRules((current) => current.filter((item) => item.id !== id));
    setMessage("규칙이 삭제되었습니다.");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Rules</h1>
        <p className="mt-1 text-sm text-slate-400">규칙별 준수율과 준수/위반 손익을 실제 거래 기록으로 계산합니다.</p>
      </header>

      <form onSubmit={createRule} className="grid gap-3 rounded-md border border-line bg-panel p-4 shadow-dashboard md:grid-cols-[1fr_2fr_auto_auto]">
        <input name="name" required placeholder="규칙 이름" className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200" />
        <input name="description" placeholder="설명" className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200" />
        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          <input name="is_active" type="checkbox" defaultChecked className="h-4 w-4 rounded border-line bg-ink" />
          active
        </label>
        <button className="focus-ring rounded-md bg-info px-4 py-2 text-sm font-semibold text-ink">추가</button>
      </form>
      {message ? <p className="text-sm text-slate-300">{message}</p> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        {rules.length > 0 ? rules.map((rule) => {
          const assignments = trades.flatMap((trade) =>
            (trade.rule_results ?? [])
              .filter((item) => item.rule_id === rule.id)
              .map((item) => ({ ...item, pnl: Number(trade.net_pnl ?? 0) }))
          );
          const followed = assignments.filter((item) => item.status === "followed");
          const violated = assignments.filter((item) => item.status === "violated");
          const adherence = assignments.length === 0 ? null : followed.length / assignments.length;

          return (
            <article key={rule.id} className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
              <form onSubmit={(event) => updateRule(event, rule.id)} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <input name="name" defaultValue={rule.name} required className="focus-ring min-w-0 flex-1 rounded-md border border-line bg-ink px-3 py-2 text-sm font-semibold text-white" />
                  <Badge tone={rule.is_active ? "good" : "neutral"}>{rule.is_active ? "active" : "off"}</Badge>
                </div>
                <textarea name="description" defaultValue={rule.description ?? ""} rows={2} className="focus-ring w-full resize-y rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200" />
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <input name="is_active" type="checkbox" defaultChecked={rule.is_active} className="h-4 w-4 rounded border-line bg-ink" />
                  active
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <Mini label="준수율" value={formatPercent(adherence)} />
                  <Mini label="준수 PnL" value={formatCurrency(followed.reduce((sum, item) => sum + item.pnl, 0))} />
                  <Mini label="위반 PnL" value={formatCurrency(violated.reduce((sum, item) => sum + item.pnl, 0))} />
                </div>
                <div className="flex gap-2">
                  <button className="focus-ring flex-1 rounded-md bg-info px-3 py-2 text-sm font-semibold text-ink">저장</button>
                  <button type="button" onClick={() => void deleteRule(rule.id)} className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-slate-300 hover:text-white">
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </form>
            </article>
          );
        }) : (
          <div className="rounded-md border border-line bg-panel p-6 text-sm text-slate-400">등록된 규칙이 없습니다.</div>
        )}
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-ink/55 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
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
  return payload.rule ?? payload;
}

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
