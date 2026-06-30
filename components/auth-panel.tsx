"use client";

import { useEffect, useMemo, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

async function syncServerSession(session: Session | null) {
  if (!session?.access_token) {
    await fetch("/api/auth/session", { method: "DELETE" });
    return;
  }

  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at
    })
  });
}

export function AuthPanel() {
  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setMessage("Supabase env missing");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null);
      void syncServerSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      void syncServerSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  async function signIn(mode: "login" | "signup") {
    if (!supabase) return;
    setBusy(true);
    setMessage("");

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setMessage(result.error.message);
    } else {
      await syncServerSession(result.data.session);
      setMessage(mode === "login" ? "Logged in" : "Check email");
      window.location.reload();
    }
    setBusy(false);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    await syncServerSession(null);
    setUserEmail(null);
    setMessage("Logged out");
    window.location.reload();
  }

  if (userEmail) {
    return (
      <div className="mt-4 rounded-md border border-line bg-panel/70 p-3">
        <div className="truncate text-xs text-slate-300">{userEmail}</div>
        <button
          type="button"
          onClick={signOut}
          className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/7"
        >
          <LogOut size={15} aria-hidden />
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-line bg-panel/70 p-3">
      <div className="space-y-2">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email"
          type="email"
          className="focus-ring w-full rounded-md border border-line bg-ink px-2 py-2 text-xs text-slate-200"
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="password"
          type="password"
          className="focus-ring w-full rounded-md border border-line bg-ink px-2 py-2 text-xs text-slate-200"
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy || !supabase}
          onClick={() => signIn("login")}
          className="focus-ring inline-flex items-center justify-center gap-1 rounded-md bg-info px-2 py-2 text-xs font-semibold text-ink disabled:opacity-50"
        >
          <LogIn size={14} aria-hidden />
          로그인
        </button>
        <button
          type="button"
          disabled={busy || !supabase}
          onClick={() => signIn("signup")}
          className="focus-ring rounded-md border border-line px-2 py-2 text-xs font-semibold text-slate-200 hover:bg-white/7 disabled:opacity-50"
        >
          가입
        </button>
      </div>
      {message ? <div className="mt-2 truncate text-xs text-slate-400">{message}</div> : null}
    </div>
  );
}
