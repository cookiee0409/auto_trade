"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { getAccessToken } from "@/lib/supabase/session";

export function CsvUpload() {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setStatus("");

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/import/csv", {
        method: "POST",
        body: data,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "CSV import failed");
      }
      setStatus(`가져오기 완료: ${payload.imported_count}건 저장, ${payload.skipped_count}건 제외`);
      form.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "CSV import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-md border border-line bg-panel p-4">
      <label className="block text-sm font-medium text-slate-200" htmlFor="csv-file">
        CSV 파일
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id="csv-file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="min-w-0 flex-1 rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-info/15 file:px-3 file:py-1.5 file:text-info"
        />
        <button
          type="submit"
          disabled={busy}
          className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-info px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload size={17} aria-hidden />
          업로드
        </button>
      </div>
      {status ? <p className="mt-3 text-sm text-slate-300">{status}</p> : null}
    </form>
  );
}
