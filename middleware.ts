import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, AUTH_REFRESH_COOKIE_NAME } from "@/lib/supabase/cookies";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/"
};

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
  const refreshToken = request.cookies.get(AUTH_REFRESH_COOKIE_NAME)?.value ?? null;

  if (!refreshToken || !shouldRefresh(accessToken)) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  const refreshed = await refreshSupabaseSession(url, key, refreshToken);

  if (!refreshed?.access_token) {
    const response = NextResponse.next();
    response.cookies.set(AUTH_COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
    response.cookies.set(AUTH_REFRESH_COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "cookie",
    buildCookieHeader(request.headers.get("cookie") ?? "", {
      [AUTH_COOKIE_NAME]: refreshed.access_token,
      [AUTH_REFRESH_COOKIE_NAME]: refreshed.refresh_token ?? refreshToken
    })
  );
  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  response.cookies.set(AUTH_COOKIE_NAME, refreshed.access_token, {
    ...cookieOptions,
    maxAge: refreshed.expires_in ?? 60 * 60
  });
  if (refreshed.refresh_token) {
    response.cookies.set(AUTH_REFRESH_COOKIE_NAME, refreshed.refresh_token, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 30
    });
  }
  return response;
}

async function refreshSupabaseSession(url: string, key: string, refreshToken: string) {
  try {
    const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!response.ok) return null;
    return await response.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
  } catch {
    return null;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sample-trades.csv|api/auth/session).*)"
  ]
};

function shouldRefresh(token: string | null) {
  if (!token) return true;
  const expiresAt = getJwtExpiry(token);
  if (!expiresAt) return true;
  return expiresAt - Math.floor(Date.now() / 1000) < 120;
}

function getJwtExpiry(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded));
    return typeof parsed.exp === "number" ? parsed.exp : null;
  } catch {
    return null;
  }
}

function buildCookieHeader(current: string, updates: Record<string, string>) {
  const cookies = new Map<string, string>();
  for (const part of current.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) continue;
    cookies.set(rawKey, rest.join("="));
  }
  for (const [key, value] of Object.entries(updates)) {
    cookies.set(key, value);
  }
  return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}
