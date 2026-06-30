import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user, error } = await requireUser(request);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("id")
    .eq("user_id", user.id)
    .eq("id", params.id)
    .maybeSingle();
  if (tradeError) return NextResponse.json({ error: tradeError.message }, { status: 500 });
  if (!trade) return NextResponse.json({ error: "Trade not found." }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  const caption = formData.get("caption");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Screenshot file is required." }, { status: 400 });
  }

  const storagePath = `${user.id}/${params.id}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("trade-screenshots")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false
    });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data, error: insertError } = await supabase
    .from("screenshots")
    .insert({
      user_id: user.id,
      trade_id: params.id,
      storage_path: storagePath,
      caption: typeof caption === "string" && caption.trim() ? caption.trim() : null
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  return NextResponse.json({ screenshot: data }, { status: 201 });
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}
