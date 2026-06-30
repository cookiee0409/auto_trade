import { cn } from "@/lib/utils";

const toneClass = {
  neutral: "border-slate-600 bg-slate-700/40 text-slate-200",
  good: "border-good/40 bg-good/10 text-good",
  bad: "border-bad/40 bg-bad/10 text-bad",
  warn: "border-warn/40 bg-warn/10 text-warn",
  info: "border-info/40 bg-info/10 text-info"
} as const;

export function Badge({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: keyof typeof toneClass;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
        toneClass[tone]
      )}
    >
      {children}
    </span>
  );
}
