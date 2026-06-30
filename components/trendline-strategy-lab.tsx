"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Crosshair,
  Loader2,
  Play,
  ShieldCheck,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Badge } from "@/components/badge";
import {
  evaluateTrendlineStrategy,
  trendlinePriceAt,
  type MarketCandle,
  type TrendlineBacktestResult,
  type TrendlineSignal,
  type TrendlineTrade
} from "@/lib/trendline-strategy";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

type ApiCandle = {
  t: number;
  T?: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v?: string;
};

interface FormState {
  coin: string;
  interval: string;
  startTime: string;
  endTime: string;
  pointATime: string;
  pointAPrice: string;
  pointBTime: string;
  pointBPrice: string;
  tolerancePct: string;
  confirmationPct: string;
  stopBufferPct: string;
  rewardRisk: string;
  notionalUsd: string;
  feeRatePct: string;
  enableLongBounce: boolean;
  enableBreakRetestSell: boolean;
}

const initialForm: FormState = {
  coin: "HYPE",
  interval: "1h",
  startTime: "2026-05-14T00:00",
  endTime: "2026-06-30T14:00",
  pointATime: "2026-05-14T02:00",
  pointAPrice: "42.361",
  pointBTime: "2026-07-20T04:00",
  pointBPrice: "67.785",
  tolerancePct: "0.35",
  confirmationPct: "0.05",
  stopBufferPct: "0.8",
  rewardRisk: "2",
  notionalUsd: "1000",
  feeRatePct: "0.045",
  enableLongBounce: true,
  enableBreakRetestSell: true
};

const inputClass = "focus-ring w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-100";
const labelClass = "space-y-1 text-xs font-medium text-slate-400";

export function TrendlineStrategyLab() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [result, setResult] = useState<TrendlineBacktestResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const chartData = useMemo(() => buildChartData(candles, result, form), [candles, result, form]);
  const latestCandle = candles[candles.length - 1] ?? null;
  const openPosition = result?.summary.openPosition ?? null;

  async function runBacktest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const startTime = toTimestamp(form.startTime);
      const endTime = toTimestamp(form.endTime);
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime >= endTime) {
        throw new Error("조회 기간을 확인해 주세요.");
      }

      const params = new URLSearchParams({
        coin: form.coin.trim().toUpperCase(),
        interval: form.interval,
        startTime: String(startTime),
        endTime: String(endTime)
      });
      const response = await fetch(`/api/market/hyperliquid-candles?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "캔들 조회에 실패했습니다.");

      const normalizedCandles = normalizeCandles(payload.candles ?? []);
      const nextResult = evaluateTrendlineStrategy(normalizedCandles, toConfig(form));
      setCandles(normalizedCandles);
      setResult(nextResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "전략 계산에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Trendline</h1>
          <p className="mt-1 text-sm text-slate-400">수동 추세선 기준의 매수·매도 시그널과 백테스트입니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">Hyperliquid candles</Badge>
          <Badge tone="warn">Live orders locked</Badge>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form onSubmit={runBacktest} className="space-y-4 rounded-md border border-line bg-panel p-4 shadow-dashboard">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Setup</h2>
              <p className="mt-1 text-xs text-slate-400">두 점과 리스크 값을 입력합니다.</p>
            </div>
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-md bg-info px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} aria-hidden />}
              Run
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Symbol
              <input value={form.coin} onChange={(event) => update("coin", event.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Interval
              <select value={form.interval} onChange={(event) => update("interval", event.target.value)} className={inputClass}>
                {["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"].map((interval) => (
                  <option key={interval} value={interval}>{interval}</option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              From
              <input type="datetime-local" value={form.startTime} onChange={(event) => update("startTime", event.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              To
              <input type="datetime-local" value={form.endTime} onChange={(event) => update("endTime", event.target.value)} className={inputClass} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Point A time
              <input type="datetime-local" value={form.pointATime} onChange={(event) => update("pointATime", event.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Point A price
              <input type="number" step="0.0001" value={form.pointAPrice} onChange={(event) => update("pointAPrice", event.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Point B time
              <input type="datetime-local" value={form.pointBTime} onChange={(event) => update("pointBTime", event.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Point B price
              <input type="number" step="0.0001" value={form.pointBPrice} onChange={(event) => update("pointBPrice", event.target.value)} className={inputClass} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label="Touch %" value={form.tolerancePct} onChange={(value) => update("tolerancePct", value)} />
            <NumberField label="Confirm %" value={form.confirmationPct} onChange={(value) => update("confirmationPct", value)} />
            <NumberField label="Stop buffer %" value={form.stopBufferPct} onChange={(value) => update("stopBufferPct", value)} />
            <NumberField label="Reward/Risk" value={form.rewardRisk} onChange={(value) => update("rewardRisk", value)} />
            <NumberField label="Notional USD" value={form.notionalUsd} onChange={(value) => update("notionalUsd", value)} />
            <NumberField label="Fee %" value={form.feeRatePct} onChange={(value) => update("feeRatePct", value)} />
          </div>

          <div className="grid gap-2 text-sm text-slate-300">
            <label className="flex items-center gap-2 rounded-md border border-line bg-ink/50 px-3 py-2">
              <input
                type="checkbox"
                checked={form.enableLongBounce}
                onChange={(event) => update("enableLongBounce", event.target.checked)}
              />
              <TrendingUp size={16} aria-hidden />
              지지 터치 매수
            </label>
            <label className="flex items-center gap-2 rounded-md border border-line bg-ink/50 px-3 py-2">
              <input
                type="checkbox"
                checked={form.enableBreakRetestSell}
                onChange={(event) => update("enableBreakRetestSell", event.target.checked)}
              />
              <TrendingDown size={16} aria-hidden />
              이탈 후 되돌림 매도/숏
            </label>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
              {error}
            </div>
          ) : null}
        </form>

        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Candles" value={candles.length ? String(candles.length) : "-"} icon={<Activity size={16} aria-hidden />} />
            <Stat label="Trend now" value={formatNumber(result?.summary.latestTrendPrice ?? null, 4)} icon={<Crosshair size={16} aria-hidden />} />
            <Stat label="Last close" value={formatNumber(latestCandle?.close ?? null, 4)} icon={<Activity size={16} aria-hidden />} />
            <Stat label="Net PnL" value={formatCurrency(result?.summary.netPnlUsd ?? null)} tone={(result?.summary.netPnlUsd ?? 0) >= 0 ? "good" : "bad"} />
            <Stat label="Trades" value={result ? `${result.summary.closedTrades} / ${result.summary.totalTrades}` : "-"} />
            <Stat label="Win rate" value={formatPercent(result?.summary.winRate ?? null)} />
            <Stat label="Profit factor" value={formatNumber(result?.summary.profitFactor ?? null)} />
            <Stat label="Max DD" value={formatCurrency(result?.summary.maxDrawdownUsd ?? null)} tone="warn" />
          </section>

          <section className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-white">Price vs Trendline</h2>
              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-info" /> close</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> trend</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-good" /> buy</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-bad" /> sell/exit</span>
              </div>
            </div>
            <div className="h-[360px] w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer>
                  <ComposedChart data={chartData} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                    <CartesianGrid stroke="#263248" strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} minTickGap={36} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} width={58} domain={["dataMin - 2", "dataMax + 2"]} />
                    <Tooltip
                      contentStyle={{
                        background: "#111827",
                        border: "1px solid #263248",
                        borderRadius: 6,
                        color: "#e5eefc"
                      }}
                      formatter={(value: unknown, name: string) => [formatNumber(Number(value), 4), name]}
                    />
                    <Line type="monotone" dataKey="close" stroke="#38bdf8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="trend" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Scatter dataKey="buy" fill="#22c55e" />
                    <Scatter dataKey="sell" fill="#fb7185" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed border-line bg-ink/60 text-sm text-slate-500">
                  No run yet
                </div>
              )}
            </div>
          </section>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <SignalsTable signals={result?.signals ?? []} />
        <ExecutionPanel latestSignal={result?.summary.latestSignal ?? null} openPosition={openPosition} />
      </section>

      <TradesTable trades={result?.trades ?? []} />
    </div>
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={labelClass}>
      {label}
      <input type="number" step="0.0001" value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} />
    </label>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = "neutral"
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn";
}) {
  const toneClass = {
    neutral: "text-white",
    good: "text-good",
    bad: "text-bad",
    warn: "text-warn"
  }[tone];

  return (
    <div className="rounded-md border border-line bg-panel p-3 shadow-dashboard">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function SignalsTable({ signals }: { signals: TrendlineSignal[] }) {
  const latestSignals = signals.slice(-12).reverse();
  return (
    <section className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Signals</h2>
        <Badge tone="info">{signals.length} total</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Price</th>
              <th className="py-2 pr-3">Trend</th>
              <th className="py-2 pr-3">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {latestSignals.length > 0 ? latestSignals.map((signal) => (
              <tr key={`${signal.time}-${signal.action}`} className="text-slate-300">
                <td className="py-2 pr-3 text-slate-400">{formatTime(signal.time)}</td>
                <td className="py-2 pr-3"><Badge tone={signal.action.includes("buy") || signal.action.includes("target") ? "good" : "warn"}>{signal.action}</Badge></td>
                <td className="py-2 pr-3">{formatNumber(signal.price, 4)}</td>
                <td className="py-2 pr-3">{formatNumber(signal.trendPrice, 4)}</td>
                <td className="py-2 pr-3 text-slate-400">{signal.reason}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">No signals</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TradesTable({ trades }: { trades: TrendlineTrade[] }) {
  const visibleTrades = trades.slice(-20).reverse();
  return (
    <section className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Backtest Trades</h2>
        <Badge tone="neutral">{trades.length} trades</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">Side</th>
              <th className="py-2 pr-3">Entry</th>
              <th className="py-2 pr-3">Exit</th>
              <th className="py-2 pr-3">Entry px</th>
              <th className="py-2 pr-3">Exit px</th>
              <th className="py-2 pr-3">Stop</th>
              <th className="py-2 pr-3">Target</th>
              <th className="py-2 pr-3">PnL</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visibleTrades.length > 0 ? visibleTrades.map((trade) => (
              <tr key={`${trade.entryTime}-${trade.side}`} className="text-slate-300">
                <td className="py-2 pr-3"><Badge tone={trade.side === "long" ? "good" : "bad"}>{trade.side}</Badge></td>
                <td className="py-2 pr-3 text-slate-400">{formatTime(trade.entryTime)}</td>
                <td className="py-2 pr-3 text-slate-400">{trade.exitTime ? formatTime(trade.exitTime) : "-"}</td>
                <td className="py-2 pr-3">{formatNumber(trade.entryPrice, 4)}</td>
                <td className="py-2 pr-3">{formatNumber(trade.exitPrice ?? null, 4)}</td>
                <td className="py-2 pr-3">{formatNumber(trade.stopPrice, 4)}</td>
                <td className="py-2 pr-3">{formatNumber(trade.targetPrice, 4)}</td>
                <td className={`py-2 pr-3 font-medium ${Number(trade.pnlUsd ?? 0) >= 0 ? "text-good" : "text-bad"}`}>
                  {trade.pnlUsd === undefined ? "-" : formatCurrency(trade.pnlUsd)}
                </td>
                <td className="py-2 pr-3"><Badge tone={trade.status === "open" ? "info" : "neutral"}>{trade.exitReason ?? trade.status}</Badge></td>
              </tr>
            )) : (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500">No trades</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ExecutionPanel({
  latestSignal,
  openPosition
}: {
  latestSignal: TrendlineSignal | null;
  openPosition: TrendlineTrade | null;
}) {
  return (
    <section className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Execution Guard</h2>
        <ShieldCheck size={18} className="text-good" aria-hidden />
      </div>
      <div className="mt-4 space-y-3 text-sm">
        <div className="rounded-md border border-line bg-ink/55 p-3">
          <div className="text-xs text-slate-400">Latest signal</div>
          <div className="mt-1 font-semibold text-white">{latestSignal ? latestSignal.action : "-"}</div>
          <div className="mt-1 text-slate-400">{latestSignal ? `${formatTime(latestSignal.time)} · ${formatNumber(latestSignal.price, 4)}` : "No signal"}</div>
        </div>
        <div className="rounded-md border border-line bg-ink/55 p-3">
          <div className="text-xs text-slate-400">Open plan</div>
          {openPosition ? (
            <div className="mt-1 space-y-1 text-slate-300">
              <div className="font-semibold text-white">{openPosition.side.toUpperCase()} {formatNumber(openPosition.entryPrice, 4)}</div>
              <div>Stop {formatNumber(openPosition.stopPrice, 4)}</div>
              <div>Target {formatNumber(openPosition.targetPrice, 4)}</div>
            </div>
          ) : (
            <div className="mt-1 text-slate-400">No open position</div>
          )}
        </div>
        <div className="rounded-md border border-warn/40 bg-warn/10 p-3 text-warn">
          실주문은 서버 전용 주문 서명기와 별도 승인 플래그가 붙기 전까지 비활성입니다.
        </div>
      </div>
    </section>
  );
}

function normalizeCandles(candles: ApiCandle[]): MarketCandle[] {
  return candles.map((candle) => ({
    time: Number(candle.t),
    closeTime: candle.T ? Number(candle.T) : undefined,
    open: Number(candle.o),
    high: Number(candle.h),
    low: Number(candle.l),
    close: Number(candle.c),
    volume: candle.v ? Number(candle.v) : undefined
  })).filter((candle) =>
    [candle.time, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
  );
}

function toConfig(form: FormState) {
  return {
    pointA: {
      time: toTimestamp(form.pointATime),
      price: Number(form.pointAPrice)
    },
    pointB: {
      time: toTimestamp(form.pointBTime),
      price: Number(form.pointBPrice)
    },
    tolerancePct: Number(form.tolerancePct),
    confirmationPct: Number(form.confirmationPct),
    stopBufferPct: Number(form.stopBufferPct),
    rewardRisk: Number(form.rewardRisk),
    notionalUsd: Number(form.notionalUsd),
    feeRatePct: Number(form.feeRatePct),
    enableLongBounce: form.enableLongBounce,
    enableBreakRetestSell: form.enableBreakRetestSell
  };
}

function buildChartData(
  candles: MarketCandle[],
  result: TrendlineBacktestResult | null,
  form: FormState
) {
  const signalByTime = new Map<number, TrendlineSignal[]>();
  for (const signal of result?.signals ?? []) {
    const signals = signalByTime.get(signal.time) ?? [];
    signals.push(signal);
    signalByTime.set(signal.time, signals);
  }

  return candles.map((candle) => {
    let trend = null;
    try {
      trend = trendlinePriceAt(
        { time: toTimestamp(form.pointATime), price: Number(form.pointAPrice) },
        { time: toTimestamp(form.pointBTime), price: Number(form.pointBPrice) },
        candle.time
      );
    } catch {
      trend = null;
    }
    const signals = signalByTime.get(candle.time) ?? [];
    const buySignal = signals.find((signal) => signal.action === "buy_touch");
    const sellSignal = signals.find((signal) => signal.action !== "buy_touch");
    return {
      name: formatShortTime(candle.time),
      close: round(candle.close),
      trend: trend === null ? null : round(trend),
      buy: buySignal ? round(buySignal.price) : undefined,
      sell: sellSignal ? round(sellSignal.price) : undefined
    };
  });
}

function toTimestamp(value: string) {
  return new Date(value).getTime();
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function formatShortTime(value: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

function round(value: number) {
  return Number(value.toFixed(4));
}
