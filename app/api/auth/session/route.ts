import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, AUTH_REFRESH_COOKIE_NAME } from "@/lib/supabase/cookies";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/"
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const accessToken = typeof body.access_token === "string" ? body.access_token : "";
  const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : "";
  if (!accessToken) {
    return NextResponse.json({ error: "access_token is required." }, { status: 400 });
  }

  const expiresAt = Number(body.expires_at);
  const maxAge = Number.isFinite(expiresAt)
    ? Math.max(60, Math.floor(expiresAt - Date.now() / 1000))
    : 60 * 60;

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, accessToken, {
    ...cookieOptions,
    maxAge
  });
  if (refreshToken) {
    response.cookies.set(AUTH_REFRESH_COOKIE_NAME, refreshToken, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 30
    });
  }
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...cookieOptions,
    maxAge: 0
  });
  response.cookies.set(AUTH_REFRESH_COOKIE_NAME, "", {
    ...cookieOptions,
    maxAge: 0
  });
  return response;
}
