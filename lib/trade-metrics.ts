import Decimal from "decimal.js";
import type { GroupedTradeMetrics, NumericInput, Trade, TradeMetrics } from "@/lib/types";

const EPSILON = new Decimal("0.000000001");

function decimal(value: NumericInput, fallback = 0) {
  if (value === null || value === undefined || value === "") return new Decimal(fallback);
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(fallback);
  }
}

function maybeDecimal(value: NumericInput) {
  if (value === null || value === undefined || value === "") return null;
  try {
    return new Decimal(value);
  } catch {
    return null;
  }
}

function toNumber(value: Decimal) {
  return Number(value.toFixed(8));
}

function emptyMetrics(): TradeMetrics {
  return {
    total_trades: 0,
    wins: 0,
    losses: 0,
    breakeven: 0,
    decisive: 0,
    win_rate: null,
    loss_rate: null,
    average_win: 0,
    average_loss: 0,
    win_loss_ratio: null,
    gross_profit: 0,
    gross_loss: 0,
    profit_factor: null,
    expectancy: null,
    r_expectancy: null,
    total_fees: 0,
    total_funding: 0,
    net_pnl: 0,
    max_consecutive_losses: 0,
    max_drawdown: 0
  };
}

function getAnalysisTrades(trades: Trade[]) {
  return trades.filter((trade) => trade.status === "closed" && maybeDecimal(trade.net_pnl));
}

export function calculateTradeMetrics(trades: Trade[]): TradeMetrics {
  const closed = getAnalysisTrades(trades);
  if (closed.length === 0) return emptyMetrics();

  const pnls = closed.map((trade) => decimal(trade.net_pnl));
  const winners = pnls.filter((pnl) => pnl.gt(EPSILON));
  const losers = pnls.filter((pnl) => pnl.lt(EPSILON.negated()));
  const breakeven = pnls.length - winners.length - losers.length;
  const decisive = winners.length + losers.length;

  const grossProfit = winners.reduce((sum, pnl) => sum.plus(pnl), new Decimal(0));
  const grossLoss = losers.reduce((sum, pnl) => sum.plus(pnl.abs()), new Decimal(0));
  const netPnl = pnls.reduce((sum, pnl) => sum.plus(pnl), new Decimal(0));
  const totalFees = closed.reduce((sum, trade) => sum.plus(decimal(trade.fee)), new Decimal(0));
  const totalFunding = closed.reduce(
    (sum, trade) => sum.plus(decimal(trade.funding)),
    new Decimal(0)
  );

  const averageWin =
    winners.length > 0 ? grossProfit.div(winners.length) : new Decimal(0);
  const averageLoss =
    losers.length > 0 ? grossLoss.div(losers.length) : new Decimal(0);
  const winRate = decisive > 0 ? winners.length / decisive : null;
  const lossRate = decisive > 0 ? losers.length / decisive : null;
  const expectancy =
    winRate === null || lossRate === null
      ? null
      : averageWin.mul(winRate).minus(averageLoss.mul(lossRate));

  const rMultiples = closed
    .filter((trade) => {
      const risk = maybeDecimal(trade.initial_risk);
      return risk !== null && risk.gt(0) && maybeDecimal(trade.r_multiple) !== null;
    })
    .map((trade) => decimal(trade.r_multiple));
  const rExpectancy =
    rMultiples.length > 0
      ? rMultiples.reduce((sum, value) => sum.plus(value), new Decimal(0)).div(rMultiples.length)
      : null;

  return {
    total_trades: closed.length,
    wins: winners.length,
    losses: losers.length,
    breakeven,
    decisive,
    win_rate: winRate,
    loss_rate: lossRate,
    average_win: toNumber(averageWin),
    average_loss: toNumber(averageLoss),
    win_loss_ratio: averageLoss.eq(0) ? null : toNumber(averageWin.div(averageLoss)),
    gross_profit: toNumber(grossProfit),
    gross_loss: toNumber(grossLoss),
    profit_factor: grossLoss.eq(0) ? null : toNumber(grossProfit.div(grossLoss)),
    expectancy: expectancy === null ? null : toNumber(expectancy),
    r_expectancy: rExpectancy === null ? null : toNumber(rExpectancy),
    total_fees: toNumber(totalFees),
    total_funding: toNumber(totalFunding),
    net_pnl: toNumber(netPnl),
    max_consecutive_losses: calculateMaxConsecutiveLosses(closed),
    max_drawdown: calculateMaxDrawdown(closed)
  };
}

export function calculateGroupedMetrics(
  trades: Trade[],
  getKey: (trade: Trade) => string | null | undefined,
  getLabel: (key: string) => string = (key) => key
): GroupedTradeMetrics[] {
  const groups = new Map<string, Trade[]>();
  for (const trade of trades) {
    const key = getKey(trade) ?? "unassigned";
    const bucket = groups.get(key) ?? [];
    bucket.push(trade);
    groups.set(key, bucket);
  }

  return [...groups.entries()]
    .map(([key, groupTrades]) => ({
      key,
      label: getLabel(key),
      ...calculateTradeMetrics(groupTrades)
    }))
    .sort((a, b) => b.net_pnl - a.net_pnl);
}

export function buildEquityCurve(trades: Trade[]) {
  const sorted = getAnalysisTrades(trades).sort(
    (a, b) =>
      new Date(a.exit_time ?? a.entry_time).getTime() -
      new Date(b.exit_time ?? b.entry_time).getTime()
  );

  let equity = new Decimal(0);
  return sorted.map((trade) => {
    equity = equity.plus(decimal(trade.net_pnl));
    return {
      trade_id: trade.id,
      time: trade.exit_time ?? trade.entry_time,
      equity: toNumber(equity)
    };
  });
}

function calculateMaxConsecutiveLosses(trades: Trade[]) {
  const sorted = [...trades].sort(
    (a, b) =>
      new Date(a.exit_time ?? a.entry_time).getTime() -
      new Date(b.exit_time ?? b.entry_time).getTime()
  );
  let current = 0;
  let max = 0;

  for (const trade of sorted) {
    const pnl = decimal(trade.net_pnl);
    if (pnl.lt(EPSILON.negated())) {
      current += 1;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }

  return max;
}

function calculateMaxDrawdown(trades: Trade[]) {
  const sorted = [...trades].sort(
    (a, b) =>
      new Date(a.exit_time ?? a.entry_time).getTime() -
      new Date(b.exit_time ?? b.entry_time).getTime()
  );
  let equity = new Decimal(0);
  let peak = new Decimal(0);
  let maxDrawdown = new Decimal(0);

  for (const trade of sorted) {
    equity = equity.plus(decimal(trade.net_pnl));
    if (equity.gt(peak)) peak = equity;
    const drawdown = equity.minus(peak);
    if (drawdown.lt(maxDrawdown)) maxDrawdown = drawdown;
  }

  return toNumber(maxDrawdown);
}
