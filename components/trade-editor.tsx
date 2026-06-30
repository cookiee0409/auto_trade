"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import type { Rule, RuleStatus, Strategy, Trade } from "@/lib/types";
import { getAccessToken } from "@/lib/supabase/session";

const emotions = ["calm", "confident", "fearful", "greedy", "fomo", "revenge", "bored", "frustrated"];
const mistakeTypes = ["none", "late_stop", "no_stop", "early_exit", "oversize", "revenge_trade", "chasing", "plan_deviation", "overtrading"];

export function TradeEditor({
  initialTrade,
  strategies,
  rules,
  endpoint = initialTrade ? `/api/trades/${initialTrade.id}` : "/api/trades",
  method = initialTrade ? "PATCH" : "POST",
  submitLabel = initialTrade ? "거래 저장" : "거래 추가",
  onSaved
}: {
  initialTrade?: Trade;
  strategies: Strategy[];
  rules: Rule[];
  endpoint?: string;
  method?: "POST" | "PATCH";
  submitLabel?: string;
  onSaved?: (trade: Trade) => void;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const ruleStatusById = useMemo(() => {
    const map = new Map<string, RuleStatus>();
    for (const result of initialTrade?.rule_results ?? []) {
      if (result.rule_id) map.set(result.rule_id, result.status);
    }
    return map;
  }, [initialTrade]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = buildPayload(form, rules);

    setBusy(true);
    setStatus("");
    try {
      const token = await getAccessToken();
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Trade save failed");
      setStatus("저장되었습니다.");
      onSaved?.(result.trade);
      if (!initialTrade) event.currentTarget.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Trade save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-md border border-line bg-panel p-4 shadow-dashboard">
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="거래소" name="exchange" defaultValue={initialTrade?.exchange ?? ""} required />
        <Field label="심볼" name="symbol" defaultValue={initialTrade?.symbol ?? ""} required />
        <Select label="방향" name="side" defaultValue={initialTrade?.side ?? "long"} options={["long", "short"]} />
        <Select label="상태" name="status" defaultValue={initialTrade?.status ?? "closed"} options={["closed", "open"]} />
        <Field label="진입 시간" name="entry_time" type="datetime-local" defaultValue={toDateTimeLocal(initialTrade?.entry_time)} required />
        <Field label="청산 시간" name="exit_time" type="datetime-local" defaultValue={toDateTimeLocal(initialTrade?.exit_time)} />
        <Field label="진입가" name="entry_price" type="number" step="any" defaultValue={stringValue(initialTrade?.entry_price)} required />
        <Field label="청산가" name="exit_price" type="number" step="any" defaultValue={stringValue(initialTrade?.exit_price)} />
        <Field label="수량" name="quantity" type="number" step="any" defaultValue={stringValue(initialTrade?.quantity)} required />
        <Field label="레버리지" name="leverage" type="number" step="any" defaultValue={stringValue(initialTrade?.leverage)} />
        <Field label="계획 손절" name="planned_stop" type="number" step="any" defaultValue={stringValue(initialTrade?.planned_stop)} />
        <Field label="계획 목표" name="planned_target" type="number" step="any" defaultValue={stringValue(initialTrade?.planned_target)} />
        <Field label="총 손익" name="gross_pnl" type="number" step="any" defaultValue={stringValue(initialTrade?.gross_pnl)} />
        <Field label="수수료" name="fee" type="number" step="any" defaultValue={stringValue(initialTrade?.fee)} />
        <Field label="펀딩" name="funding" type="number" step="any" defaultValue={stringValue(initialTrade?.funding)} />
        <Field label="순손익" name="net_pnl" type="number" step="any" defaultValue={stringValue(initialTrade?.net_pnl)} />
        <Select
          label="전략"
          name="strategy_id"
          defaultValue={initialTrade?.strategy_id ?? ""}
          options={["", ...strategies.map((strategy) => strategy.id)]}
          labels={{ "": "미지정", ...Object.fromEntries(strategies.map((strategy) => [strategy.id, strategy.name])) }}
        />
        <Select label="감정" name="emotion" defaultValue={initialTrade?.emotion ?? ""} options={["", ...emotions]} labels={{ "": "-" }} />
        <Select label="실수 유형" name="mistake_type" defaultValue={initialTrade?.mistake_type ?? ""} options={["", ...mistakeTypes]} labels={{ "": "-" }} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <TextArea label="가설" name="hypothesis" defaultValue={initialTrade?.hypothesis ?? ""} />
        <TextArea label="진입 이유" name="setup_reason" defaultValue={initialTrade?.setup_reason ?? ""} />
        <TextArea label="청산 이유" name="exit_reason" defaultValue={initialTrade?.exit_reason ?? ""} />
        <TextArea label="다시 한다면" name="retro_note" defaultValue={initialTrade?.retro_note ?? ""} />
        <TextArea label="메모" name="notes" defaultValue={initialTrade?.notes ?? ""} />
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-slate-200">규칙 체크</div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {rules.length > 0 ? rules.map((rule) => (
            <label key={rule.id} className="rounded-md border border-line bg-ink/55 p-3 text-sm">
              <span className="block font-medium text-white">{rule.name}</span>
              <select
                name={`rule_${rule.id}`}
                defaultValue={ruleStatusById.get(rule.id) ?? ""}
                className="focus-ring mt-2 w-full rounded-md border border-line bg-ink px-2 py-2 text-sm text-slate-200"
              >
                <option value="">미기록</option>
                <option value="followed">준수</option>
                <option value="violated">위반</option>
              </select>
            </label>
          )) : <p className="text-sm text-slate-400">등록된 규칙이 없습니다.</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-info px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
        >
          <Save size={17} aria-hidden />
          {submitLabel}
        </button>
        {status ? <span className="text-sm text-slate-300">{status}</span> : null}
      </div>
    </form>
  );
}

function buildPayload(form: FormData, rules: Rule[]) {
  const payload: Record<string, unknown> = {
    exchange: text(form, "exchange"),
    symbol: text(form, "symbol")?.toUpperCase(),
    side: text(form, "side"),
    status: text(form, "status"),
    entry_time: dateTime(form, "entry_time"),
    exit_time: dateTime(form, "exit_time"),
    entry_price: text(form, "entry_price"),
    exit_price: text(form, "exit_price"),
    quantity: text(form, "quantity"),
    leverage: text(form, "leverage"),
    planned_stop: text(form, "planned_stop"),
    planned_target: text(form, "planned_target"),
    gross_pnl: text(form, "gross_pnl"),
    fee: text(form, "fee"),
    funding: text(form, "funding"),
    net_pnl: text(form, "net_pnl"),
    strategy_id: text(form, "strategy_id"),
    hypothesis: text(form, "hypothesis"),
    setup_reason: text(form, "setup_reason"),
    exit_reason: text(form, "exit_reason"),
    retro_note: text(form, "retro_note"),
    notes: text(form, "notes"),
    emotion: text(form, "emotion"),
    mistake_type: text(form, "mistake_type"),
    rule_results: rules
      .map((rule) => ({
        rule_id: rule.id,
        status: text(form, `rule_${rule.id}`)
      }))
      .filter((item) => item.status === "followed" || item.status === "violated")
  };

  for (const [key, value] of Object.entries(payload)) {
    if (value === "") payload[key] = null;
  }
  return payload;
}

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function dateTime(form: FormData, key: string) {
  const value = text(form, key);
  return value ? new Date(value).toISOString() : null;
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function stringValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function Field({
  label,
  name,
  type = "text",
  step,
  defaultValue,
  required
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-300">{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        defaultValue={defaultValue}
        className="focus-ring w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200"
      />
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
  labels = {}
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-300">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="focus-ring w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200"
      >
        {options.map((option) => (
          <option key={option} value={option}>{labels[option] ?? option}</option>
        ))}
      </select>
    </label>
  );
}

function TextArea({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-300">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={3}
        className="focus-ring w-full resize-y rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200"
      />
    </label>
  );
}
