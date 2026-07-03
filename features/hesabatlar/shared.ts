import "server-only";
import { formatDate } from "@/lib/utils";

export type DateRange = { from: Date; to: Date };

export function thisMonthRange(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

export function lastMonthRange(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
  };
}

export function parseDateRange(sp: { from?: string; to?: string; preset?: string }): DateRange {
  if (sp.preset === "bu-ay" || !sp.from && !sp.to && !sp.preset) {
    return thisMonthRange();
  }
  if (sp.preset === "kecen-ay") return lastMonthRange();
  if (sp.preset === "bu-il") {
    const y = new Date().getFullYear();
    return { from: new Date(y, 0, 1), to: new Date(y, 11, 31, 23, 59, 59) };
  }
  if (sp.preset === "kecen-il") {
    const y = new Date().getFullYear() - 1;
    return { from: new Date(y, 0, 1), to: new Date(y, 11, 31, 23, 59, 59) };
  }
  if (sp.preset === "bu-hefte") {
    const now = new Date();
    const dow = now.getDay(); // 0=Sun..6=Sat
    const offset = dow === 0 ? 6 : dow - 1; // Monday-based
    const from = new Date(now);
    from.setDate(now.getDate() - offset);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
  if (sp.preset === "bu-rub") {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3);
    const from = new Date(now.getFullYear(), q * 3, 1);
    const to = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
    return { from, to };
  }
  if (sp.preset === "son-30") {
    const now = new Date();
    const from = new Date();
    from.setDate(now.getDate() - 29);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
  if (sp.preset === "son-7") {
    const now = new Date();
    const from = new Date();
    from.setDate(now.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
  const from = sp.from ? new Date(sp.from + "T00:00:00") : thisMonthRange().from;
  const to = sp.to ? new Date(sp.to + "T23:59:59") : thisMonthRange().to;
  return { from, to };
}

export function formatDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function rangeLabel(r: DateRange): string {
  return `${formatDate(r.from, { day: "numeric", month: "long", year: "numeric" })} — ${formatDate(r.to, { day: "numeric", month: "long", year: "numeric" })}`;
}

/** Returns the immediately-preceding range of equal length. */
export function previousPeriod(r: DateRange): DateRange {
  const ms = r.to.getTime() - r.from.getTime();
  const to = new Date(r.from.getTime() - 1);
  const from = new Date(to.getTime() - ms);
  return { from, to };
}

/** Returns the same range shifted exactly one year back (year-over-year). */
export function yoyPeriod(r: DateRange): DateRange {
  const from = new Date(r.from);
  const to = new Date(r.to);
  from.setFullYear(from.getFullYear() - 1);
  to.setFullYear(to.getFullYear() - 1);
  return { from, to };
}

/** Difference in days inclusive (min 1). */
export function rangeDays(r: DateRange): number {
  return Math.max(1, Math.round((r.to.getTime() - r.from.getTime()) / 86400000) + 1);
}

export function deltaPct(cur: number, prev: number): number {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return ((cur - prev) / Math.abs(prev)) * 100;
}
