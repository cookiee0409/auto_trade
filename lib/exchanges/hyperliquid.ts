import Decimal from "decimal.js";
import { createDedupKey, deriveTradeFields } from "@/lib/trade-calculations";
import type { Trade, TradeSide } from "@/lib/types";

export interface HyperliquidFill {
  tid?: number;
  hash?: string;
  oid?: number;
  coin?: string;
  side?: "A" | "B" | string;
  px?: string;
  sz?: string;
  fee?: string;
  closedPnl?: string;
  time?: number;
  [key: string]: unknown;
}

export interface HyperliquidCandle {
  t: number;
  T?: number;
  s?: string;
  i?: string;
  o: string;
  c: string;
  h: string;
  l: string;
  v?: string;
  n?: number;
}

export interface MergedHyperliquidTrade extends Partial<Trade> {
  fills: HyperliquidFill[];
}

interface PositionState {
  symbol: string;
  side: TradeSide;
  entryTime: number;
  exitTime: number | null;
  entryQty: Decimal;
  openQty: Decimal;
  exitQty: Decimal;
  entryNotional: Decimal;
  exitNotional: Decimal;
  fee: Decimal;
  grossPnl: Decimal;
  entryExternalIds: string[];
  externalIds: string[];
  fills: HyperliquidFill[];
}

export async function fetchHyperliquidFills({
  address,
  startTime,
  endTime
}: {
  address: string;
  startTime: number;
  endTime: number;
}) {
  const response = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "userFillsByTime",
      user: address,
      startTime,
      endTime
    })
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid info request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) return [];
  return payload as HyperliquidFill[];
}

export async function fetchHyperliquidCandles({
  coin,
  interval,
  startTime,
  endTime
}: {
  coin: string;
  interval: string;
  startTime: number;
  endTime: number;
}) {
  const response = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: {
        coin,
        interval,
        startTime,
        endTime
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid candle request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) return [];
  return payload as HyperliquidCandle[];
}

export function mergeHyperliquidFillsIntoTrades(fills: HyperliquidFill[]): MergedHyperliquidTrade[] {
  const sorted = fills
    .filter((fill) => fill.coin && fill.px && fill.sz && fill.time && (fill.side === "A" || fill.side === "B"))
    .sort((a, b) => Number(a.time) - Number(b.time));

  const openBySymbol = new Map<string, PositionState>();
  const trades: MergedHyperliquidTrade[] = [];

  for (const fill of sorted) {
    const symbol = String(fill.coin);
    const fillSide = fill.side === "B" ? "buy" : "sell";
    const openSide: TradeSide = fillSide === "buy" ? "long" : "short";
    const totalQty = decimal(fill.sz);
    if (totalQty.lte(0)) continue;

    let remaining = totalQty;
    let position = openBySymbol.get(symbol) ?? null;

    if (position && isClosingFill(position.side, fillSide)) {
      const closeQty = Decimal.min(position.openQty, remaining);
      applyClose(position, fill, closeQty, totalQty);
      remaining = remaining.minus(closeQty);

      if (position.openQty.lte(0)) {
        trades.push(toTrade(position, "closed"));
        openBySymbol.delete(symbol);
        position = null;
      }
    }

    if (remaining.gt(0)) {
      position = openBySymbol.get(symbol) ?? null;
      if (!position) {
        position = createPosition(symbol, openSide, fill, remaining, totalQty);
        openBySymbol.set(symbol, position);
      } else if (position.side === openSide) {
        applyOpen(position, fill, remaining, totalQty);
      } else {
        const closeQty = Decimal.min(position.openQty, remaining);
        applyClose(position, fill, closeQty, totalQty);
        remaining = remaining.minus(closeQty);
        if (position.openQty.lte(0)) {
          trades.push(toTrade(position, "closed"));
          openBySymbol.delete(symbol);
          if (remaining.gt(0)) {
            openBySymbol.set(symbol, createPosition(symbol, openSide, fill, remaining, totalQty));
          }
        }
      }
    }
  }

  for (const position of openBySymbol.values()) {
    trades.push(toTrade(position, "open"));
  }

  return trades;
}

function createPosition(
  symbol: string,
  side: TradeSide,
  fill: HyperliquidFill,
  qty: Decimal,
  totalQty: Decimal
): PositionState {
  const price = decimal(fill.px);
  return {
    symbol,
    side,
    entryTime: Number(fill.time),
    exitTime: null,
    entryQty: qty,
    openQty: qty,
    exitQty: new Decimal(0),
    entryNotional: price.mul(qty),
    exitNotional: new Decimal(0),
    fee: proratedFee(fill, qty, totalQty),
    grossPnl: new Decimal(0),
    entryExternalIds: [fillId(fill)],
    externalIds: [fillId(fill)],
    fills: [fill]
  };
}

function applyOpen(position: PositionState, fill: HyperliquidFill, qty: Decimal, totalQty: Decimal) {
  const price = decimal(fill.px);
  position.entryQty = position.entryQty.plus(qty);
  position.openQty = position.openQty.plus(qty);
  position.entryNotional = position.entryNotional.plus(price.mul(qty));
  position.fee = position.fee.plus(proratedFee(fill, qty, totalQty));
  const id = fillId(fill);
  if (!position.entryExternalIds.includes(id)) position.entryExternalIds.push(id);
  addFill(position, fill);
}

function applyClose(position: PositionState, fill: HyperliquidFill, qty: Decimal, totalQty: Decimal) {
  const price = decimal(fill.px);
  position.openQty = position.openQty.minus(qty);
  position.exitQty = position.exitQty.plus(qty);
  position.exitNotional = position.exitNotional.plus(price.mul(qty));
  position.exitTime = Number(fill.time);
  position.fee = position.fee.plus(proratedFee(fill, qty, totalQty));
  position.grossPnl = position.grossPnl.plus(closedPnl(fill, position.side, qty, totalQty, entryVwap(position), price));
  addFill(position, fill);
}

function toTrade(position: PositionState, status: "open" | "closed"): MergedHyperliquidTrade {
  const entryPrice = entryVwap(position);
  const exitPrice = position.exitQty.gt(0) ? position.exitNotional.div(position.exitQty) : null;
  const quantity = status === "closed" ? position.exitQty : position.openQty;
  const grossPnl = status === "closed" ? position.grossPnl : null;
  const netPnl = grossPnl ? grossPnl.minus(position.fee) : null;
  const externalIds = [...new Set(position.externalIds)];
  const entryExternalIds = [...new Set(position.entryExternalIds)];

  return {
    ...deriveTradeFields({
      exchange: "Hyperliquid",
      symbol: position.symbol,
      side: position.side,
      status,
      entry_time: new Date(position.entryTime).toISOString(),
      exit_time: status === "closed" && position.exitTime ? new Date(position.exitTime).toISOString() : null,
      entry_price: entryPrice.toFixed(),
      exit_price: exitPrice ? exitPrice.toFixed() : null,
      quantity: quantity.toFixed(),
      fee: position.fee.toFixed(),
      gross_pnl: grossPnl ? grossPnl.toFixed() : null,
      net_pnl: netPnl ? netPnl.toFixed() : null,
      source: "hyperliquid",
      external_trade_ids: externalIds,
      dedup_key: createDedupKey([
        "hyperliquid-position",
        position.symbol,
        position.side,
        position.entryTime,
        ...entryExternalIds
      ])
    }),
    fills: position.fills
  };
}

function isClosingFill(positionSide: TradeSide, fillSide: "buy" | "sell") {
  return positionSide === "long" ? fillSide === "sell" : fillSide === "buy";
}

function addFill(position: PositionState, fill: HyperliquidFill) {
  const id = fillId(fill);
  if (!position.externalIds.includes(id)) position.externalIds.push(id);
  if (!position.fills.includes(fill)) position.fills.push(fill);
}

function entryVwap(position: PositionState) {
  return position.entryQty.gt(0) ? position.entryNotional.div(position.entryQty) : new Decimal(0);
}

function closedPnl(
  fill: HyperliquidFill,
  side: TradeSide,
  qty: Decimal,
  totalQty: Decimal,
  entryPrice: Decimal,
  exitPrice: Decimal
) {
  if (fill.closedPnl !== undefined && fill.closedPnl !== null && fill.closedPnl !== "") {
    return decimal(fill.closedPnl).mul(qty).div(totalQty);
  }
  const multiplier = side === "long" ? 1 : -1;
  return exitPrice.minus(entryPrice).mul(qty).mul(multiplier);
}

function proratedFee(fill: HyperliquidFill, qty: Decimal, totalQty: Decimal) {
  return decimal(fill.fee ?? 0).abs().mul(qty).div(totalQty);
}

function decimal(value: unknown) {
  try {
    return new Decimal(value as string | number);
  } catch {
    return new Decimal(0);
  }
}

function fillId(fill: HyperliquidFill) {
  return String(fill.tid ?? fill.hash ?? fill.oid ?? `${fill.coin}-${fill.side}-${fill.px}-${fill.sz}-${fill.time}`);
}
