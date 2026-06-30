"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { Trade } from "@/lib/types";
import { buildEquityCurve } from "@/lib/trade-metrics";

export function EquityChart({ trades }: { trades: Trade[] }) {
  const data = buildEquityCurve(trades).map((point, index) => ({
    name: `${index + 1}`,
    equity: Number(point.equity.toFixed(2))
  }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
          <CartesianGrid stroke="#263248" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} width={58} />
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid #263248",
              borderRadius: 6,
              color: "#e5eefc"
            }}
          />
          <Line
            type="monotone"
            dataKey="equity"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
