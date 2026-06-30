export type TrendlineAction =
  | "buy_touch"
  | "sell_break_retest"
  | "exit_target"
  | "exit_stop"
  | "exit_break_retest";

export interface TrendlinePoint {
  time: string | number | Date;
  price: number;
}

export interface MarketCandle {
  time: number;
  closeTime?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TrendlineStrategyConfig {
  pointA: TrendlinePoint;
  pointB: TrendlinePoint;
  tolerancePct: number;
  confirmationPct: number;
  stopBufferPct: number;
  rewardRisk: number;
  notionalUsd: number;
  feeRatePct?: number;
  enableLongBounce?: boolean;
  enableBreakRetestSell?: boolean;
}

export interface TrendlineSignal {
  action: TrendlineAction;
  time: number;
  price: number;
  trendPrice: number;
  reason: string;
}

export interface TrendlineTrade {
  side: "long" | "short";
  entryTime: number;
  exitTime?: number;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  stopPrice: number;
  targetPrice: number;
  pnlUsd?: number;
  pnlPct?: number;
  exitReason?: TrendlineAction;
  status: "open" | "closed";
}

export interface TrendlineBacktestResult {
  signals: TrendlineSignal[];
  trades: TrendlineTrade[];
  summary: {
    totalTrades: number;
    closedTrades: number;
    winRate: number | null;
    netPnlUsd: number;
    profitFactor: number | null;
    maxDrawdownUsd: number;
    openPosition: TrendlineTrade | null;
    latestSignal: TrendlineSignal | null;
    latestTrendPrice: number | null;
  };
}

interface PositionState {
  trade: TrendlineTrade;
  waitingForBreakRetest: boolean;
}

export function trendlinePriceAt(pointA: TrendlinePoint, pointB: TrendlinePoint, time: string | number | Date) {
  const startTime = toTimestamp(pointA.time);
  const endTime = toTimestamp(pointB.time);
  const targetTime = toTimestamp(time);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime === endTime) {
    throw new Error("Trendline points must have two different valid times.");
  }

  const slope = (pointB.price - pointA.price) / (endTime - startTime);
  return pointA.price + slope * (targetTime - startTime);
}

export function evaluateTrendlineStrategy(
  candles: MarketCandle[],
  config: TrendlineStrategyConfig
): TrendlineBacktestResult {
  const ordered = candles
    .filter(isValidCandle)
    .slice()
    .sort((a, b) => a.time - b.time);
  const normalized = normalizeConfig(config);
  const signals: TrendlineSignal[] = [];
  const trades: TrendlineTrade[] = [];
  let position: PositionState | null = null;
  let breakdownArmed = false;
  let latestTrendPrice: number | null = null;

  for (const candle of ordered) {
    const trendPrice = trendlinePriceAt(normalized.pointA, normalized.pointB, candle.time);
    latestTrendPrice = trendPrice;
    let closedPositionThisCandle = false;

    if (position) {
      const exit = evaluateExit(candle, trendPrice, position, normalized);
      if (exit) {
        position.trade.exitTime = candle.time;
        position.trade.exitPrice = exit.price;
        position.trade.exitReason = exit.action;
        position.trade.status = "closed";
        applyPnl(position.trade, normalized.feeRatePct);
        signals.push({
          action: exit.action,
          time: candle.time,
          price: exit.price,
          trendPrice,
          reason: exit.reason
        });
        position = null;
        closedPositionThisCandle = true;
      }
    }

    if (position) continue;
    if (closedPositionThisCandle) continue;

    const closeBelowTrend = candle.close < trendPrice * (1 - normalized.confirmationPct / 100);
    const wasBreakdownArmed = breakdownArmed;

    if (wasBreakdownArmed && normalized.enableBreakRetestSell) {
      const retest = touchesTrendline(candle, trendPrice, normalized.tolerancePct) &&
        candle.close <= trendPrice * (1 + normalized.confirmationPct / 100);
      if (retest) {
        const trade = openTrade("short", candle, trendPrice, normalized);
        if (trade) {
          trades.push(trade);
          position = { trade, waitingForBreakRetest: false };
        }
        signals.push({
          action: "sell_break_retest",
          time: candle.time,
          price: candle.close,
          trendPrice,
          reason: "Trendline was broken and price retested the line from below."
        });
        breakdownArmed = false;
        continue;
      }
    }

    if (closeBelowTrend) {
      breakdownArmed = true;
      continue;
    }

    if (normalized.enableLongBounce && !breakdownArmed) {
      const touched = touchesTrendline(candle, trendPrice, normalized.tolerancePct);
      const closedAbove = candle.close >= trendPrice * (1 + normalized.confirmationPct / 100);
      if (touched && closedAbove) {
        const trade = openTrade("long", candle, trendPrice, normalized);
        if (trade) {
          trades.push(trade);
          position = { trade, waitingForBreakRetest: false };
        }
        signals.push({
          action: "buy_touch",
          time: candle.time,
          price: candle.close,
          trendPrice,
          reason: "Price touched the trendline and closed back above it."
        });
      }
    }
  }

  return {
    signals,
    trades,
    summary: summarize(trades, signals, latestTrendPrice)
  };
}

export function touchesTrendline(candle: MarketCandle, trendPrice: number, tolerancePct: number) {
  const tolerance = tolerancePct / 100;
  return candle.low <= trendPrice * (1 + tolerance) && candle.high >= trendPrice * (1 - tolerance);
}

function evaluateExit(
  candle: MarketCandle,
  trendPrice: number,
  position: PositionState,
  config: Required<TrendlineStrategyConfig>
): { action: TrendlineAction; price: number; reason: string } | null {
  const { trade } = position;
  if (trade.side === "long") {
    if (candle.low <= trade.stopPrice) {
      return { action: "exit_stop", price: trade.stopPrice, reason: "Long stop was touched." };
    }
    if (candle.high >= trade.targetPrice) {
      return { action: "exit_target", price: trade.targetPrice, reason: "Long target was touched." };
    }
    const wasWaitingForBreakRetest = position.waitingForBreakRetest;
    if (wasWaitingForBreakRetest && touchesTrendline(candle, trendPrice, config.tolerancePct)) {
      return {
        action: "exit_break_retest",
        price: Math.min(candle.close, trendPrice),
        reason: "Trendline broke and price retested the line."
      };
    }
    if (candle.close < trendPrice * (1 - config.confirmationPct / 100)) {
      position.waitingForBreakRetest = true;
    }
    return null;
  }

  if (candle.high >= trade.stopPrice) {
    return { action: "exit_stop", price: trade.stopPrice, reason: "Short stop was touched." };
  }
  if (candle.low <= trade.targetPrice) {
    return { action: "exit_target", price: trade.targetPrice, reason: "Short target was touched." };
  }
  return null;
}

function openTrade(
  side: "long" | "short",
  candle: MarketCandle,
  trendPrice: number,
  config: Required<TrendlineStrategyConfig>
): TrendlineTrade | null {
  const entryPrice = candle.close;
  const quantity = config.notionalUsd > 0 ? config.notionalUsd / entryPrice : 0;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  if (side === "long") {
    const stopPrice = trendPrice * (1 - config.stopBufferPct / 100);
    const risk = entryPrice - stopPrice;
    if (risk <= 0) return null;
    return {
      side,
      entryTime: candle.time,
      entryPrice,
      quantity,
      stopPrice,
      targetPrice: entryPrice + risk * config.rewardRisk,
      status: "open"
    };
  }

  const stopPrice = trendPrice * (1 + config.stopBufferPct / 100);
  const risk = stopPrice - entryPrice;
  if (risk <= 0) return null;
  return {
    side,
    entryTime: candle.time,
    entryPrice,
    quantity,
    stopPrice,
    targetPrice: entryPrice - risk * config.rewardRisk,
    status: "open"
  };
}

function applyPnl(trade: TrendlineTrade, feeRatePct: number) {
  if (trade.exitPrice === undefined) return;
  const gross = trade.side === "long"
    ? (trade.exitPrice - trade.entryPrice) * trade.quantity
    : (trade.entryPrice - trade.exitPrice) * trade.quantity;
  const fees = (trade.entryPrice + trade.exitPrice) * trade.quantity * (feeRatePct / 100);
  trade.pnlUsd = gross - fees;
  trade.pnlPct = trade.entryPrice > 0 ? trade.pnlUsd / (trade.entryPrice * trade.quantity) * 100 : 0;
}

function summarize(
  trades: TrendlineTrade[],
  signals: TrendlineSignal[],
  latestTrendPrice: number | null
): TrendlineBacktestResult["summary"] {
  const closedTrades = trades.filter((trade) => trade.status === "closed");
  const wins = closedTrades.filter((trade) => Number(trade.pnlUsd ?? 0) > 0);
  const losses = closedTrades.filter((trade) => Number(trade.pnlUsd ?? 0) < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + Number(trade.pnlUsd ?? 0), 0);
  const grossLoss = losses.reduce((sum, trade) => sum + Math.abs(Number(trade.pnlUsd ?? 0)), 0);
  let equity = 0;
  let peak = 0;
  let maxDrawdownUsd = 0;

  for (const trade of closedTrades) {
    equity += Number(trade.pnlUsd ?? 0);
    peak = Math.max(peak, equity);
    maxDrawdownUsd = Math.min(maxDrawdownUsd, equity - peak);
  }

  return {
    totalTrades: trades.length,
    closedTrades: closedTrades.length,
    winRate: closedTrades.length > 0 ? wins.length / closedTrades.length : null,
    netPnlUsd: closedTrades.reduce((sum, trade) => sum + Number(trade.pnlUsd ?? 0), 0),
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    maxDrawdownUsd,
    openPosition: trades.find((trade) => trade.status === "open") ?? null,
    latestSignal: signals[signals.length - 1] ?? null,
    latestTrendPrice
  };
}

function normalizeConfig(config: TrendlineStrategyConfig): Required<TrendlineStrategyConfig> {
  return {
    ...config,
    tolerancePct: finiteOr(config.tolerancePct, 0.3),
    confirmationPct: finiteOr(config.confirmationPct, 0),
    stopBufferPct: finiteOr(config.stopBufferPct, 0.7),
    rewardRisk: Math.max(finiteOr(config.rewardRisk, 2), 0.1),
    notionalUsd: Math.max(finiteOr(config.notionalUsd, 1000), 0),
    feeRatePct: Math.max(finiteOr(config.feeRatePct, 0.045), 0),
    enableLongBounce: config.enableLongBounce ?? true,
    enableBreakRetestSell: config.enableBreakRetestSell ?? true
  };
}

function finiteOr(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function toTimestamp(value: string | number | Date) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

function isValidCandle(candle: MarketCandle) {
  return [candle.time, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) &&
    candle.high >= candle.low &&
    candle.high > 0 &&
    candle.low > 0;
}
