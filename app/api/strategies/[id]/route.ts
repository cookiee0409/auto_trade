import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user, error } = await requireUser(request);
  if (!user) return NextResponse.json({ error }, { status: 401 });
  const payload = await request.json();
  const { data, error: updateError } = await supabase
    .from("strategies")
    .update(payload)
    .eq("user_id", user.id)
    .eq("id", params.id)
    .select()
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  return NextResponse.json({ strategy: data });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user, error } = await requireUser(request);
  if (!user) return NextResponse.json({ error }, { status: 401 });
  const { error: deleteError } = await supabase
    .from("strategies")
    .delete()
    .eq("user_id", user.id)
    .eq("id", params.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
