"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export async function getAccessToken() {
  try {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
