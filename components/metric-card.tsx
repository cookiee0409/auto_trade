import { cn } from "@/lib/utils";

type Tone = "neutral" | "good" | "bad" | "warn" | "info";

const toneClass: Record<Tone, string> = {
  neutral: "border-line bg-panel",
  good: "border-good/30 bg-good/8",
  bad: "border-bad/30 bg-bad/8",
  warn: "border-warn/30 bg-warn/8",
  info: "border-info/30 bg-info/8"
};

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
}) {
  return (
    <section className={cn("rounded-md border p-4 shadow-dashboard", toneClass[tone])}>
      <div className="text-xs font-medium uppercase tracking-normal text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {detail ? <div className="mt-1 text-xs text-slate-400">{detail}</div> : null}
    </section>
  );
}
