import { NextResponse, type NextRequest } from "next/server";
import { parseTradeCsv } from "@/lib/csv-parser";
import { requireUser } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { supabase, user, error } = await requireUser(request);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
  }

  const parsed = parseTradeCsv(await file.text());
  const { data: importRecord, error: importError } = await supabase
    .from("imports")
    .insert({
      user_id: user.id,
      source: "csv",
      file_name: file.name,
      status: "pending",
      imported_count: 0,
      skipped_count: parsed.skipped_count,
      row_errors: parsed.row_errors
    })
    .select()
    .single();

  if (importError) return NextResponse.json({ error: importError.message }, { status: 400 });

  let inserted = 0;
  let duplicateCount = 0;
  let internalDuplicateCount = 0;
  if (parsed.trades.length > 0) {
    const tradesWithStrategies = await attachStrategyIds(supabase, user.id, parsed.trades);
    const deduped = deduplicateTrades(tradesWithStrategies);
    internalDuplicateCount = deduped.duplicateCount;
    const dedupKeys = tradesWithStrategies
      .map((trade) => trade.dedup_key)
      .filter((key): key is string => typeof key === "string" && key.length > 0);
    const existingDedupKeys = await loadExistingDedupKeys(supabase, user.id, dedupKeys);
    duplicateCount = deduped.trades.filter((trade) => trade.dedup_key && existingDedupKeys.has(trade.dedup_key)).length;

    const { error: insertError } = await supabase.from("trades").upsert(
      deduped.trades.map(({ strategy_name, ...trade }) => ({
        ...trade,
        user_id: user.id,
        source: "csv"
      })),
      { onConflict: "user_id,dedup_key", ignoreDuplicates: true }
    );
    if (insertError) {
      await supabase
        .from("imports")
        .update({ status: "failed", error_message: insertError.message })
        .eq("id", importRecord.id);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }
    inserted = deduped.trades.length - duplicateCount;
  }

  const skipped = parsed.skipped_count + duplicateCount + internalDuplicateCount;
  const status = skipped > 0 ? "partial" : "done";
  await supabase
    .from("imports")
    .update({ status, imported_count: inserted, skipped_count: skipped })
    .eq("id", importRecord.id);

  return NextResponse.json({
    import_id: importRecord.id,
    imported_count: inserted,
    skipped_count: skipped,
    row_errors: parsed.row_errors
  });
}

function deduplicateTrades<T extends { dedup_key?: string | null }>(trades: T[]) {
  const seen = new Set<string>();
  const unique: T[] = [];
  let duplicateCount = 0;

  for (const trade of trades) {
    if (!trade.dedup_key) {
      unique.push(trade);
      continue;
    }
    if (seen.has(trade.dedup_key)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(trade.dedup_key);
    unique.push(trade);
  }

  return { trades: unique, duplicateCount };
}

async function attachStrategyIds(supabase: any, userId: string, trades: any[]) {
  const names = [...new Set(trades.map((trade) => trade.strategy_name?.trim()).filter(Boolean))] as string[];
  if (names.length === 0) return trades;

  const existing = new Map<string, string>();
  const { data: existingRows, error: existingError } = await supabase
    .from("strategies")
    .select("id,name")
    .eq("user_id", userId)
    .in("name", names);
  if (existingError) throw new Error(existingError.message);
  for (const row of existingRows ?? []) existing.set(row.name, row.id);

  const missing = names.filter((name) => !existing.has(name));
  if (missing.length > 0) {
    const { data: insertedRows, error: insertError } = await supabase
      .from("strategies")
      .upsert(
        missing.map((name) => ({ user_id: userId, name, status: "active" })),
        { onConflict: "user_id,name" }
      )
      .select("id,name");
    if (insertError) throw new Error(insertError.message);
    for (const row of insertedRows ?? []) existing.set(row.name, row.id);
  }

  return trades.map((trade) => ({
    ...trade,
    strategy_id: trade.strategy_name ? existing.get(trade.strategy_name) ?? null : null
  }));
}

async function loadExistingDedupKeys(supabase: any, userId: string, dedupKeys: string[]) {
  const existing = new Set<string>();
  if (dedupKeys.length === 0) return existing;
  const { data, error } = await supabase
    .from("trades")
    .select("dedup_key")
    .eq("user_id", userId)
    .in("dedup_key", dedupKeys);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    if (row.dedup_key) existing.add(row.dedup_key);
  }
  return existing;
}
