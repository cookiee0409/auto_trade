import type { Rule, Strategy, Trade } from "@/lib/types";

export const mockStrategies: Strategy[] = [
  {
    id: "6f8744ee-7819-4f58-8d7d-8d89d50b06a1",
    name: "돌파",
    description: "고점 돌파 후 거래량 확장 확인",
    status: "active"
  },
  {
    id: "c0af9096-58a0-44a8-b40c-f7b22534f2dc",
    name: "눌림",
    description: "추세 유지 중 되돌림 구간 진입",
    status: "testing"
  },
  {
    id: "4f6901eb-2db7-4d48-bef8-5c9f3b6734f3",
    name: "레인지",
    description: "상하단 반응 기반 단기 회귀",
    status: "paused"
  }
];

export const mockRules: Rule[] = [
  {
    id: "3e1c88aa-bce1-4f84-a5e6-93d72e195cb5",
    name: "손절 준수",
    description: "계획 손절가 이탈 시 지체 없이 청산",
    is_active: true
  },
  {
    id: "c50d7814-3a71-47b5-8f9f-1e788b7bb9c7",
    name: "1회 리스크 제한",
    description: "초기 위험은 주간 허용 리스크 안에서 유지",
    is_active: true
  },
  {
    id: "9127a409-6d37-42f6-8d58-a0529e5d1bf3",
    name: "손실 직후 휴식",
    description: "손실 후 60분 내 재진입 금지",
    is_active: true
  }
];

export const mockTrades: Trade[] = [
  {
    id: "8841deea-bd2f-4575-aa30-c4f383564404",
    exchange: "Hyperliquid",
    symbol: "BTC",
    side: "long",
    status: "closed",
    entry_time: "2026-06-21T01:10:00.000Z",
    exit_time: "2026-06-21T02:05:00.000Z",
    entry_price: "64200",
    exit_price: "64880",
    quantity: "0.08",
    leverage: "3",
    notional_usd: "5136",
    planned_stop: "63720",
    planned_target: "65100",
    initial_risk: "38.4",
    r_multiple: "1.31",
    gross_pnl: "54.4",
    fee: "2.1",
    funding: "0",
    net_pnl: "52.3",
    pnl_percent: "1.018",
    strategy_id: mockStrategies[0].id,
    strategy_name: "돌파",
    hypothesis: "거래량 동반 돌파 후 단기 추세 확장",
    setup_reason: "상단 유동성 회수 후 5분봉 종가 안착",
    exit_reason: "목표 구간 근접 후 분할 청산",
    retro_note: "청산 계획은 유지, 추격 진입은 피한다.",
    emotion: "calm",
    mistake_type: "none",
    source: "manual",
    rule_results: [
      { rule_id: mockRules[0].id, rule_name: "손절 준수", status: "followed" },
      { rule_id: mockRules[1].id, rule_name: "1회 리스크 제한", status: "followed" }
    ]
  },
  {
    id: "7fd75b03-72ad-4959-b6c1-62659066d1c8",
    exchange: "Binance",
    symbol: "ETH",
    side: "short",
    status: "closed",
    entry_time: "2026-06-22T06:30:00.000Z",
    exit_time: "2026-06-22T11:45:00.000Z",
    entry_price: "3520",
    exit_price: "3588",
    quantity: "1.2",
    leverage: "4",
    notional_usd: "4224",
    planned_stop: "3560",
    planned_target: "3440",
    initial_risk: "48",
    r_multiple: "-1.78",
    gross_pnl: "-81.6",
    fee: "3.8",
    funding: "0.9",
    net_pnl: "-86.3",
    pnl_percent: "-2.043",
    strategy_id: mockStrategies[1].id,
    strategy_name: "눌림",
    hypothesis: "추세 저항 재확인 후 하락 지속",
    setup_reason: "저항선에서 반응했지만 거래량 확인 전 진입",
    exit_reason: "계획 손절을 늦게 실행",
    retro_note: "반응만 보고 들어가지 말고 종가 확인이 필요했다.",
    emotion: "frustrated",
    mistake_type: "late_stop",
    source: "manual",
    rule_results: [
      { rule_id: mockRules[0].id, rule_name: "손절 준수", status: "violated" },
      { rule_id: mockRules[1].id, rule_name: "1회 리스크 제한", status: "followed" }
    ]
  },
  {
    id: "1e3d8761-cef8-47a7-9d4d-3a8ea2b0ed98",
    exchange: "Hyperliquid",
    symbol: "SOL",
    side: "long",
    status: "closed",
    entry_time: "2026-06-22T12:18:00.000Z",
    exit_time: "2026-06-22T12:42:00.000Z",
    entry_price: "146.2",
    exit_price: "144.9",
    quantity: "32",
    leverage: "5",
    notional_usd: "4678.4",
    planned_stop: "144.8",
    initial_risk: "44.8",
    r_multiple: "-1.02",
    gross_pnl: "-41.6",
    fee: "2.7",
    funding: "0",
    net_pnl: "-44.3",
    pnl_percent: "-0.947",
    strategy_id: mockStrategies[0].id,
    strategy_name: "돌파",
    setup_reason: "손실 직후 반등 추격",
    exit_reason: "하단 재이탈",
    retro_note: "직전 손실 후 휴식 규칙을 지켜야 했다.",
    emotion: "revenge",
    mistake_type: "revenge_trade",
    source: "manual",
    rule_results: [
      { rule_id: mockRules[2].id, rule_name: "손실 직후 휴식", status: "violated" }
    ]
  },
  {
    id: "fe4142bb-0ba2-4364-9ce2-99bcb6c7c61c",
    exchange: "Bybit",
    symbol: "BTC",
    side: "short",
    status: "closed",
    entry_time: "2026-06-24T03:00:00.000Z",
    exit_time: "2026-06-24T04:15:00.000Z",
    entry_price: "65300",
    exit_price: "65020",
    quantity: "0.05",
    notional_usd: "3265",
    planned_stop: "65580",
    initial_risk: "14",
    r_multiple: "0.92",
    gross_pnl: "14",
    fee: "1.4",
    funding: "0",
    net_pnl: "12.6",
    pnl_percent: "0.386",
    strategy_id: mockStrategies[2].id,
    strategy_name: "레인지",
    setup_reason: "상단 실패 후 회귀",
    exit_reason: "중단선 도달",
    emotion: "confident",
    mistake_type: "none",
    source: "manual",
    rule_results: [
      { rule_id: mockRules[0].id, rule_name: "손절 준수", status: "followed" }
    ]
  },
  {
    id: "4028140a-864f-4ac5-a44d-bc2f8f50fc90",
    exchange: "Hyperliquid",
    symbol: "ETH",
    side: "long",
    status: "open",
    entry_time: "2026-06-26T07:20:00.000Z",
    entry_price: "3460",
    quantity: "0.8",
    leverage: "2",
    notional_usd: "2768",
    planned_stop: "3412",
    planned_target: "3580",
    strategy_id: mockStrategies[1].id,
    strategy_name: "눌림",
    setup_reason: "20EMA 지지 확인",
    emotion: "calm",
    mistake_type: "none",
    source: "manual",
    rule_results: [
      { rule_id: mockRules[1].id, rule_name: "1회 리스크 제한", status: "followed" }
    ]
  }
];
