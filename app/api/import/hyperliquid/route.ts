import { NextResponse, type NextRequest } from "next/server";
import {
  fetchHyperliquidFills,
  mergeHyperliquidFillsIntoTrades
} from "@/lib/exchanges/hyperliquid";
import { requireUser } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { supabase, user, error } = await requireUser(request);
  if (!user) return NextResponse.json({ error }, { status: 401 });

  const body = await request.json();
  const address = String(body.address ?? "");
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Valid Hyperliquid wallet address is required." }, { status: 400 });
  }

  const endTime = body.endTime ? Number(body.endTime) : Date.now();
  const startTime = body.startTime ? Number(body.startTime) : endTime - 7 * 24 * 60 * 60 * 1000;
  const fills = await fetchHyperliquidFills({ address, startTime, endTime });
  const mergedTrades = mergeHyperliquidFillsIntoTrades(fills);
  const dedupKeys = mergedTrades
    .map((trade) => trade.dedup_key)
    .filter((key): key is string => typeof key === "string" && key.length > 0);
  const existingTrades = await loadExistingTradesByDedup(supabase, user.id, dedupKeys);
  const trades = mergedTrades.map(({ fills: _fills, ...trade }) => ({
    ...trade,
    user_id: user.id,
    source: "hyperliquid"
  }));

  const { data: importRecord, error: importError } = await supabase
    .from("imports")
    .insert({
      user_id: user.id,
      source: "hyperliquid",
      status: "pending",
      imported_count: 0,
      skipped_count: 0
    })
    .select()
    .single();
  if (importError) return NextResponse.json({ error: importError.message }, { status: 400 });

  if (trades.length > 0) {
    const { error: insertError } = await supabase
      .from("trades")
      .upsert(trades, { onConflict: "user_id,dedup_key" });
    if (insertError) {
      await supabase.from("imports").update({ status: "failed", error_message: insertError.message }).eq("id", importRecord.id);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    await saveTradeFills(supabase, user.id, mergedTrades);
  }

  const updatedCount = mergedTrades.filter((trade) => {
    const existing = trade.dedup_key ? existingTrades.get(trade.dedup_key) : null;
    return existing?.status === "open" && trade.status === "closed";
  }).length;
  const duplicateCount = mergedTrades.filter((trade) => {
    const existing = trade.dedup_key ? existingTrades.get(trade.dedup_key) : null;
    return existing && !(existing.status === "open" && trade.status === "closed");
  }).length;
  const importedCount = mergedTrades.length - existingTrades.size;
  const changedCount = importedCount + updatedCount;
  const status = duplicateCount > 0 ? "partial" : "done";
  await supabase
    .from("imports")
    .update({ status, imported_count: changedCount, skipped_count: duplicateCount })
    .eq("id", importRecord.id);

  return NextResponse.json({
    import_id: importRecord.id,
    imported_count: importedCount,
    updated_count: updatedCount,
    skipped_count: duplicateCount,
    fill_count: fills.length
  });
}

async function loadExistingTradesByDedup(supabase: any, userId: string, dedupKeys: string[]) {
  const existing = new Map<string, { id: string; status: string }>();
  if (dedupKeys.length === 0) return existing;
  const { data, error } = await supabase
    .from("trades")
    .select("id,dedup_key,status")
    .eq("user_id", userId)
    .in("dedup_key", dedupKeys);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    if (row.dedup_key) existing.set(row.dedup_key, { id: row.id, status: row.status });
  }
  return existing;
}

async function saveTradeFills(supabase: any, userId: string, mergedTrades: ReturnType<typeof mergeHyperliquidFillsIntoTrades>) {
  const dedupKeys = mergedTrades
    .map((trade) => trade.dedup_key)
    .filter((key): key is string => typeof key === "string" && key.length > 0);
  if (dedupKeys.length === 0) return;

  const { data: savedTrades, error } = await supabase
    .from("trades")
    .select("id,dedup_key")
    .eq("user_id", userId)
    .in("dedup_key", dedupKeys);
  if (error) throw new Error(error.message);

  const tradeIdByDedup = new Map((savedTrades ?? []).map((trade: any) => [trade.dedup_key, trade.id]));
  const rows = mergedTrades.flatMap((trade) =>
    trade.fills.map((fill) => ({
      user_id: userId,
      trade_id: trade.dedup_key ? tradeIdByDedup.get(trade.dedup_key) ?? null : null,
      external_fill_id: fillId(fill),
      symbol: fill.coin ?? null,
      side: fill.side ?? null,
      price: fill.px ?? null,
      quantity: fill.sz ?? null,
      fee: fill.fee ?? null,
      filled_at: fill.time ? new Date(Number(fill.time)).toISOString() : null,
      raw: fill
    }))
  );
  if (rows.length === 0) return;

  const { error: fillError } = await supabase
    .from("trade_fills")
    .upsert(rows, { onConflict: "user_id,external_fill_id", ignoreDuplicates: true });
  if (fillError) throw new Error(fillError.message);
}

function fillId(fill: { tid?: number; hash?: string; oid?: number; coin?: string; side?: string; px?: string; sz?: string; time?: number }) {
  return String(fill.tid ?? fill.hash ?? fill.oid ?? `${fill.coin}-${fill.side}-${fill.px}-${fill.sz}-${fill.time}`);
}
