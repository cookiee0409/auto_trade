import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/supabase/cookies";

export { AUTH_COOKIE_NAME, AUTH_REFRESH_COOKIE_NAME } from "@/lib/supabase/cookies";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured.");
  }
  return { url, key };
}

function createSupabaseClientWithToken(token: string | null) {
  const { url, key } = getSupabaseEnv();
  return createClient(url, key, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function getAccessTokenFromRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }
  return request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export function createRouteSupabaseClient(request: NextRequest) {
  return createSupabaseClientWithToken(getAccessTokenFromRequest(request));
}

export function createServerSupabaseClient() {
  return createSupabaseClientWithToken(cookies().get(AUTH_COOKIE_NAME)?.value ?? null);
}

export async function requireUser(request: NextRequest) {
  const supabase = createRouteSupabaseClient(request);
  if (!getAccessTokenFromRequest(request)) {
    return { supabase, user: null, error: "Unauthorized" };
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { supabase, user: null, error: error?.message ?? "Unauthorized" };
  }
  return { supabase, user: data.user, error: null };
}

export async function requireServerUser() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { supabase, user: null, error: error?.message ?? "Unauthorized" };
  }
  return { supabase, user: data.user, error: null };
}
