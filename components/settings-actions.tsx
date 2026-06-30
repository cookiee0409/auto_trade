"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { getAccessToken } from "@/lib/supabase/session";

export function ResetDataAction() {
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function resetData() {
    if (confirm !== "RESET") {
      setStatus("RESET을 입력해야 초기화할 수 있습니다.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/settings/reset", {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Reset failed");
      setStatus("데이터를 초기화했습니다.");
      setConfirm("");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-line bg-panel p-4 shadow-dashboard">
      <h2 className="text-base font-semibold text-white">데이터 초기화</h2>
      <p className="mt-2 text-sm text-slate-400">현재 로그인한 사용자의 거래, 규칙, 전략, 가져오기 기록, AI 리포트를 삭제합니다.</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder="RESET"
          className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void resetData()}
          className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-bad/40 px-4 py-2 text-sm font-semibold text-bad hover:bg-bad/10 disabled:opacity-60"
        >
          <Trash2 size={17} aria-hidden />
          초기화
        </button>
      </div>
      {status ? <p className="mt-3 text-sm text-slate-300">{status}</p> : null}
    </div>
  );
}
