import { createDedupKey, deriveTradeFields } from "@/lib/trade-calculations";
import { emotions, mistakeTypes, tradeSides, tradeStatuses, type Trade } from "@/lib/types";
import { parseDateAssumeKst } from "@/lib/time";

export interface CsvRowError {
  row: number;
  reason: string;
}

export interface ParsedCsvTrade extends Partial<Trade> {
  strategy_name?: string | null;
}

export interface CsvParseResult {
  trades: ParsedCsvTrade[];
  imported_count: number;
  skipped_count: number;
  row_errors: CsvRowError[];
}

const standardColumns = [
  "exchange",
  "symbol",
  "side",
  "status",
  "entry_time",
  "exit_time",
  "entry_price",
  "exit_price",
  "quantity",
  "leverage",
  "planned_stop",
  "planned_target",
  "gross_pnl",
  "fee",
  "funding",
  "net_pnl",
  "strategy",
  "setup_reason",
  "exit_reason",
  "emotion",
  "mistake_type",
  "notes"
] as const;

const numericColumns = [
  "entry_price",
  "exit_price",
  "quantity",
  "leverage",
  "planned_stop",
  "planned_target",
  "gross_pnl",
  "fee",
  "funding",
  "net_pnl"
] as const;

export function parseTradeCsv(csv: string): CsvParseResult {
  const rows = parseCsvRows(csv);
  const row_errors: CsvRowError[] = [];
  if (rows.length === 0) {
    return {
      trades: [],
      imported_count: 0,
      skipped_count: 0,
      row_errors: [{ row: 0, reason: "CSV가 비어 있습니다." }]
    };
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const trades: ParsedCsvTrade[] = [];

  rows.slice(1).forEach((values, index) => {
    const rowNumber = index + 2;
    if (values.every((value) => value.trim() === "")) return;
    const row = Object.fromEntries(headers.map((header, columnIndex) => [header, values[columnIndex] ?? ""]));
    const errors = validateRow(row);
    if (errors.length > 0) {
      row_errors.push({ row: rowNumber, reason: errors.join("; ") });
      return;
    }

    const entryTime = parseDateAssumeKst(row.entry_time);
    const exitTime = row.exit_time ? parseDateAssumeKst(row.exit_time) : null;
    const status =
      (row.status as Trade["status"]) ||
      (exitTime || row.exit_price ? "closed" : "open");

    const base: ParsedCsvTrade = {
      exchange: row.exchange.trim(),
      symbol: row.symbol.trim().toUpperCase(),
      side: row.side.trim().toLowerCase() as Trade["side"],
      status,
      entry_time: entryTime?.toISOString(),
      exit_time: exitTime?.toISOString() ?? null,
      source: "csv",
      strategy_name: row.strategy?.trim() || null,
      setup_reason: row.setup_reason || null,
      exit_reason: row.exit_reason || null,
      emotion: row.emotion ? (row.emotion as Trade["emotion"]) : null,
      mistake_type: row.mistake_type ? (row.mistake_type as Trade["mistake_type"]) : null,
      notes: row.notes || null
    };

    for (const column of numericColumns) {
      const value = row[column]?.trim();
      if (value !== undefined && value !== "") {
        (base as Record<string, string>)[column] = value;
      }
    }

    if (!base.net_pnl && status === "closed") {
      const calculated = calculateNetPnl(base);
      if (calculated === null) {
        row_errors.push({
          row: rowNumber,
          reason: "closed 거래이지만 net_pnl 계산에 필요한 값이 부족합니다."
        });
      } else {
        base.net_pnl = calculated;
      }
    }

    const derived = deriveTradeFields(base);
    derived.dedup_key = createDedupKey([
      derived.exchange,
      derived.symbol,
      derived.side,
      derived.entry_time,
      derived.exit_time,
      derived.entry_price,
      derived.exit_price,
      derived.quantity,
      derived.net_pnl
    ]);
    trades.push(derived);
  });

  return {
    trades,
    imported_count: trades.length,
    skipped_count: row_errors.length,
    row_errors
  };
}

export function getStandardCsvHeader() {
  return standardColumns.join(",");
}

function validateRow(row: Record<string, string>) {
  const errors: string[] = [];
  for (const required of ["exchange", "symbol", "side", "entry_time", "entry_price"]) {
    if (!row[required]?.trim()) errors.push(`${required} 필수`);
  }
  if (row.side && !tradeSides.includes(row.side.trim().toLowerCase() as Trade["side"])) {
    errors.push("side는 long 또는 short");
  }
  if (row.status && !tradeStatuses.includes(row.status.trim().toLowerCase() as Trade["status"])) {
    errors.push("status는 open 또는 closed");
  }
  if (row.entry_time && !parseDateAssumeKst(row.entry_time)) {
    errors.push("entry_time 파싱 실패");
  }
  if (row.exit_time && !parseDateAssumeKst(row.exit_time)) {
    errors.push("exit_time 파싱 실패");
  }
  if (row.emotion && !emotions.includes(row.emotion as (typeof emotions)[number])) {
    errors.push("emotion 허용값 아님");
  }
  if (row.mistake_type && !mistakeTypes.includes(row.mistake_type as (typeof mistakeTypes)[number])) {
    errors.push("mistake_type 허용값 아님");
  }
  for (const column of numericColumns) {
    if (row[column]?.trim() && Number.isNaN(Number(row[column]))) {
      errors.push(`${column} 숫자 아님`);
    }
  }
  return errors;
}

function calculateNetPnl(row: Partial<Trade>) {
  const entry = Number(row.entry_price);
  const exit = Number(row.exit_price);
  const quantity = Number(row.quantity);
  if (!Number.isFinite(entry) || !Number.isFinite(exit) || !Number.isFinite(quantity)) {
    return null;
  }
  const sideMultiplier = row.side === "short" ? -1 : 1;
  const gross = (exit - entry) * quantity * sideMultiplier;
  const fee = Number(row.fee ?? 0);
  const funding = Number(row.funding ?? 0);
  return String(gross - fee + funding);
}

function parseCsvRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }
    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}
