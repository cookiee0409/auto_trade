import { NextResponse, type NextRequest } from "next/server";
import { reviewsToCsv, tradesToCsv } from "@/lib/export";
import { requireUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "json";
  const kind = searchParams.get("kind") ?? "trades";
  const { supabase, user, error } = await requireUser(request);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  if (kind === "reviews") {
    const { data, error: queryError } = await supabase
      .from("ai_reviews")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
    const reviews = data ?? [];

    if (format === "csv") {
      return new Response(reviewsToCsv(reviews), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=ai-reviews.csv"
        }
      });
    }

    return NextResponse.json({ reviews });
  }

  const { data, error: queryError } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", user.id)
    .order("entry_time", { ascending: false });

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  const trades = data ?? [];

  if (format === "csv") {
    return new Response(tradesToCsv(trades), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=trades.csv"
      }
    });
  }

  return NextResponse.json({ trades });
}
