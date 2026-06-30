"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { getAccessToken } from "@/lib/supabase/session";

export function ScreenshotUpload({ tradeId }: { tradeId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setStatus("");

    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/trades/${tradeId}/screenshots`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: data
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Screenshot upload failed");
      setStatus("업로드되었습니다.");
      form.reset();
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Screenshot upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2">
      <input
        name="file"
        type="file"
        accept="image/*"
        required
        className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-info/15 file:px-3 file:py-1.5 file:text-info"
      />
      <input
        name="caption"
        placeholder="캡션"
        className="focus-ring w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200"
      />
      <button
        disabled={busy}
        className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/7 disabled:opacity-60"
      >
        <Upload size={16} aria-hidden />
        스크린샷 업로드
      </button>
      {status ? <p className="text-sm text-slate-300">{status}</p> : null}
    </form>
  );
}
