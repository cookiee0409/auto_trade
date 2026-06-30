"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { getAccessToken } from "@/lib/supabase/session";

const walletStorageKey = "trade.hyperliquid.wallet";

export function HyperliquidImportForm() {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAddress(window.localStorage.getItem(walletStorageKey) ?? "");
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    window.localStorage.setItem(walletStorageKey, address);

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/import/hyperliquid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ address })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Hyperliquid import failed");
      setStatus(
        `가져오기 완료: ${payload.imported_count}건 신규, ${payload.updated_count ?? 0}건 갱신, ${payload.skipped_count}건 중복, fill ${payload.fill_count}건`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Hyperliquid import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
      <input
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        className="focus-ring rounded-md border border-line bg-ink px-3 py-2 text-sm text-slate-200"
        placeholder="0x..."
        pattern="^0x[a-fA-F0-9]{40}$"
        required
      />
      <button
        className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/7 disabled:opacity-60"
        disabled={busy}
      >
        <Search size={17} aria-hidden />
        조회
      </button>
      {status ? <p className="sm:col-span-2 text-sm text-slate-300">{status}</p> : null}
    </form>
  );
}
