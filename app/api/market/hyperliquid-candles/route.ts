import { NextResponse, type NextRequest } from "next/server";
import { fetchHyperliquidCandles } from "@/lib/exchanges/hyperliquid";

const allowedIntervals = new Set(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "8h", "12h", "1d"]);
const maxLookbackMs = 180 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const coin = String(searchParams.get("coin") ?? "HYPE").trim().toUpperCase();
  const interval = String(searchParams.get("interval") ?? "1h").trim();
  const startTime = Number(searchParams.get("startTime"));
  const endTime = Number(searchParams.get("endTime"));

  if (!/^[A-Z0-9-]{2,20}$/.test(coin)) {
    return NextResponse.json({ error: "Valid Hyperliquid coin is required." }, { status: 400 });
  }
  if (!allowedIntervals.has(interval)) {
    return NextResponse.json({ error: "Unsupported candle interval." }, { status: 400 });
  }
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime >= endTime) {
    return NextResponse.json({ error: "Valid startTime and endTime are required." }, { status: 400 });
  }
  if (endTime - startTime > maxLookbackMs) {
    return NextResponse.json({ error: "Lookback must be 180 days or less." }, { status: 400 });
  }

  try {
    const candles = await fetchHyperliquidCandles({ coin, interval, startTime, endTime });
    return NextResponse.json({ candles });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch Hyperliquid candles.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
