import { describe, expect, it } from "vitest";
import {
  evaluateTrendlineStrategy,
  trendlinePriceAt,
  type MarketCandle
} from "@/lib/trendline-strategy";

function candle(time: number, open: number, high: number, low: number, close: number): MarketCandle {
  return { time, open, high, low, close };
}

describe("trendline strategy", () => {
  it("interpolates and extrapolates trendline prices", () => {
    const pointA = { time: 0, price: 100 };
    const pointB = { time: 1000, price: 110 };

    expect(trendlinePriceAt(pointA, pointB, 500)).toBe(105);
    expect(trendlinePriceAt(pointA, pointB, 1500)).toBe(115);
  });

  it("opens a long on a support touch and exits at the target", () => {
    const result = evaluateTrendlineStrategy(
      [
        candle(0, 101, 102, 99.8, 100.5),
        candle(1000, 100.5, 104, 100.2, 103)
      ],
      {
        pointA: { time: 0, price: 100 },
        pointB: { time: 1000, price: 100 },
        tolerancePct: 0.3,
        confirmationPct: 0,
        stopBufferPct: 1,
        rewardRisk: 2,
        notionalUsd: 1000,
        feeRatePct: 0,
        enableLongBounce: true,
        enableBreakRetestSell: false
      }
    );

    expect(result.signals.map((signal) => signal.action)).toEqual(["buy_touch", "exit_target"]);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].status).toBe("closed");
    expect(result.trades[0].pnlUsd).toBeGreaterThan(0);
  });

  it("arms a breakdown first, then sells the retest from below", () => {
    const result = evaluateTrendlineStrategy(
      [
        candle(0, 101, 101.5, 98, 99),
        candle(1000, 98.8, 100.1, 98.4, 99.5),
        candle(2000, 99.5, 100.4, 96, 97)
      ],
      {
        pointA: { time: 0, price: 100 },
        pointB: { time: 2000, price: 100 },
        tolerancePct: 0.2,
        confirmationPct: 0,
        stopBufferPct: 1,
        rewardRisk: 2,
        notionalUsd: 1000,
        feeRatePct: 0,
        enableLongBounce: false,
        enableBreakRetestSell: true
      }
    );

    expect(result.signals[0].action).toBe("sell_break_retest");
    expect(result.trades[0].side).toBe("short");
    expect(result.trades[0].status).toBe("closed");
    expect(result.trades[0].exitReason).toBe("exit_target");
  });
});
