import { describe, expect, it } from "vitest";
import { calculateGroupedMetrics, calculateTradeMetrics } from "@/lib/trade-metrics";
import type { Trade } from "@/lib/types";

function trade(id: string, net_pnl: string, extra: Partial<Trade> = {}): Trade {
  return {
    id,
    exchange: "Test",
    symbol: "BTC",
    side: "long",
    status: "closed",
    entry_time: `2026-06-2${id}T00:00:00.000Z`,
    exit_time: `2026-06-2${id}T01:00:00.000Z`,
    entry_price: "100",
    quantity: "1",
    fee: "1",
    funding: "0.5",
    net_pnl,
    ...extra
  };
}

describe("calculateTradeMetrics", () => {
  it("returns guarded empty metrics", () => {
    const metrics = calculateTradeMetrics([]);
    expect(metrics.total_trades).toBe(0);
    expect(metrics.win_rate).toBeNull();
    expect(metrics.profit_factor).toBeNull();
    expect(metrics.net_pnl).toBe(0);
  });

  it("excludes breakeven trades from win rate", () => {
    const metrics = calculateTradeMetrics([
      trade("1", "10"),
      trade("2", "-5"),
      trade("3", "0")
    ]);
    expect(metrics.wins).toBe(1);
    expect(metrics.losses).toBe(1);
    expect(metrics.breakeven).toBe(1);
    expect(metrics.win_rate).toBe(0.5);
  });

  it("returns null profit factor when there is no gross loss", () => {
    const metrics = calculateTradeMetrics([trade("1", "10"), trade("2", "0")]);
    expect(metrics.profit_factor).toBeNull();
    expect(metrics.average_loss).toBe(0);
  });

  it("calculates max consecutive losses and PnL drawdown", () => {
    const metrics = calculateTradeMetrics([
      trade("1", "100"),
      trade("2", "-30"),
      trade("3", "-20"),
      trade("4", "10"),
      trade("5", "-80")
    ]);
    expect(metrics.max_consecutive_losses).toBe(2);
    expect(metrics.max_drawdown).toBe(-120);
  });

  it("groups metrics with the same formulas", () => {
    const groups = calculateGroupedMetrics(
      [
        trade("1", "10", { symbol: "BTC" }),
        trade("2", "-5", { symbol: "ETH" }),
        trade("3", "5", { symbol: "BTC" })
      ],
      (item) => item.symbol
    );
    const btc = groups.find((group) => group.key === "BTC");
    expect(btc?.total_trades).toBe(2);
    expect(btc?.net_pnl).toBe(15);
  });
});
