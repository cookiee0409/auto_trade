import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import type { Trade } from "@/lib/types";

function toDecimal(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  try {
    return new Decimal(value as string | number);
  } catch {
    return null;
  }
}

function toStringOrNull(value: Decimal | null) {
  return value === null ? null : value.toFixed();
}

export function deriveTradeFields<T extends Partial<Trade>>(trade: T): T {
  const entryPrice = toDecimal(trade.entry_price);
  const exitPrice = toDecimal(trade.exit_price);
  const quantity = toDecimal(trade.quantity);
  const plannedStop = toDecimal(trade.planned_stop);
  const netPnl = toDecimal(trade.net_pnl);

  const notional =
    toDecimal(trade.notional_usd) ?? (entryPrice && quantity ? entryPrice.mul(quantity) : null);
  const initialRisk =
    toDecimal(trade.initial_risk) ??
    (entryPrice && plannedStop && quantity
      ? entryPrice.minus(plannedStop).abs().mul(quantity)
      : null);
  const rMultiple =
    toDecimal(trade.r_multiple) ??
    (netPnl && initialRisk && initialRisk.gt(0) ? netPnl.div(initialRisk) : null);
  const pnlPercent =
    toDecimal(trade.pnl_percent) ??
    (netPnl && notional && notional.gt(0) ? netPnl.div(notional).mul(100) : null);

  return {
    ...trade,
    notional_usd: toStringOrNull(notional),
    initial_risk: toStringOrNull(initialRisk),
    r_multiple: toStringOrNull(rMultiple),
    pnl_percent: toStringOrNull(pnlPercent),
    status:
      trade.status ??
      (trade.exit_time || trade.exit_price !== null && trade.exit_price !== undefined
        ? "closed"
        : "open")
  };
}

export function createDedupKey(parts: Array<string | number | null | undefined>) {
  return createHash("sha256")
    .update(parts.map((part) => String(part ?? "")).join("|"))
    .digest("hex");
}
