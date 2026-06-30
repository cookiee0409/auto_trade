import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/server";

const tables = [
  "trade_fills",
  "screenshots",
  "trade_rules",
  "trades",
  "ai_reviews",
  "imports",
  "strategies",
  "rules"
];

export async function DELETE(request: NextRequest) {
  const { supabase, user, error } = await requireUser(request);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  for (const table of tables) {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq("user_id", user.id);
    if (deleteError) return NextResponse.json({ error: deleteError.message, table }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
