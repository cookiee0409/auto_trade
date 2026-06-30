const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfKstDay(date = new Date()) {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  const utcMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  );
  return new Date(utcMidnight - KST_OFFSET_MS);
}

export function getRecentKstWindow(days = 7, now = new Date()) {
  const end = startOfKstDay(now);
  const start = new Date(end.getTime() - days * DAY_MS);
  return { start, end };
}

export function formatKstIso(date: Date) {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mi = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+09:00`;
}

export function parseDateAssumeKst(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hasOffset = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const date = new Date(hasOffset ? normalized : `${normalized}+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function minutesBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  return (endMs - startMs) / 60000;
}
