import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { supabase, user, error } = await requireUser(request);
  if (!user) return NextResponse.json({ error }, { status: 401 });
  const { data, error: queryError } = await supabase
    .from("strategies")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ strategies: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { supabase, user, error } = await requireUser(request);
  if (!user) return NextResponse.json({ error }, { status: 401 });
  const payload = await request.json();
  const { data, error: insertError } = await supabase
    .from("strategies")
    .insert({ ...payload, user_id: user.id })
    .select()
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  return NextResponse.json({ strategy: data }, { status: 201 });
}
