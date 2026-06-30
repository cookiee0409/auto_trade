"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { getAccessToken } from "@/lib/supabase/session";

export function TradeReviewButton({
  tradeId,
  entryTime
}: {
  tradeId: string;
  entryTime: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function runReview() {
    setBusy(true);
    setStatus("");
    const start = new Date(entryTime);
    const end = new Date(start.getTime() + 60 * 1000);

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/ai/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          period_start: start.toISOString(),
          period_end: end.toISOString(),
          scope_type: "trade",
          scope_value: tradeId
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "AI review failed");
      setStatus(payload.skipped ? "이미 생성된 단일 거래 복기를 불러왔습니다." : "단일 거래 복기를 생성했습니다.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI review failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void runReview()}
        className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-info px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
      >
        <BrainCircuit size={17} aria-hidden />
        이 거래만 AI 복기
      </button>
      {status ? <p className="mt-2 text-sm text-slate-300">{status}</p> : null}
    </div>
  );
}
