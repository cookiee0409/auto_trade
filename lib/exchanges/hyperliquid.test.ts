import { describe, expect, it } from "vitest";
import { mergeHyperliquidFillsIntoTrades } from "@/lib/exchanges/hyperliquid";

describe("mergeHyperliquidFillsIntoTrades", () => {
  it("merges scaled long fills into one VWAP trade", () => {
    const trades = mergeHyperliquidFillsIntoTrades([
      { tid: 1, coin: "ETH", side: "B", px: "100", sz: "1", fee: "0.01", time: 1000 },
      { tid: 2, coin: "ETH", side: "B", px: "102", sz: "1", fee: "0.01", time: 2000 },
      { tid: 3, coin: "ETH", side: "A", px: "110", sz: "2", fee: "0.02", closedPnl: "18", time: 3000 }
    ]);

    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({
      symbol: "ETH",
      side: "long",
      status: "closed",
      entry_price: "101",
      exit_price: "110",
      quantity: "2",
      gross_pnl: "18",
      net_pnl: "17.96"
    });
    expect(trades[0].external_trade_ids).toEqual(["1", "2", "3"]);
    expect(trades[0].fills).toHaveLength(3);
  });

  it("keeps an unclosed position open", () => {
    const trades = mergeHyperliquidFillsIntoTrades([
      { tid: 1, coin: "BTC", side: "A", px: "50000", sz: "0.1", fee: "1", time: 1000 }
    ]);

    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({
      symbol: "BTC",
      side: "short",
      status: "open",
      entry_price: "50000",
      exit_price: null,
      quantity: "0.1",
      net_pnl: null
    });
  });

  it("uses the same dedup key when an open position later closes", () => {
    const open = mergeHyperliquidFillsIntoTrades([
      { tid: 1, coin: "ETH", side: "B", px: "100", sz: "1", fee: "0.01", time: 1000 }
    ]);
    const closed = mergeHyperliquidFillsIntoTrades([
      { tid: 1, coin: "ETH", side: "B", px: "100", sz: "1", fee: "0.01", time: 1000 },
      { tid: 2, coin: "ETH", side: "A", px: "110", sz: "1", fee: "0.01", closedPnl: "10", time: 2000 }
    ]);

    expect(open[0].status).toBe("open");
    expect(closed[0].status).toBe("closed");
    expect(open[0].dedup_key).toBe(closed[0].dedup_key);
  });
});
