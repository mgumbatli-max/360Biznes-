import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number | string | null | undefined, currency = "AZN") {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("az-AZ", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatNumber(value: number | string | null | undefined, fractionDigits = 0) {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("az-AZ", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(num);
}

/**
 * Compact rəqəm formatı: 1.000 → "1K", 1.000.000 → "1M", 1.500.000 → "1.5M".
 * 1000-dən aşağı sadə formatNumber qaytarır. Hər hesablama "az-AZ" lokal-i ilə
 * uyğun komma istifadə edir (1,5M kimi).
 *
 * Use case: dashboard hero metrikalar, kart başlıqları — tam rəqəm çox geniş yer tutur.
 * Tooltipdə tam rəqəm göstərmək tövsiyə olunur (`title={formatNumber(value)}`).
 */
export function formatCompactNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs >= 1_000_000_000) {
    return sign + trimZero((abs / 1_000_000_000).toFixed(1)) + "B";
  }
  if (abs >= 1_000_000) {
    return sign + trimZero((abs / 1_000_000).toFixed(2)) + "M";
  }
  if (abs >= 1_000) {
    return sign + trimZero((abs / 1_000).toFixed(1)) + "K";
  }
  return new Intl.NumberFormat("az-AZ").format(num);
}

/** Compact pul formatı: "2.26M ₼", "12.5K ₼". */
export function formatCompactMoney(
  value: number | string | null | undefined,
  currency: "AZN" | "USD" | "EUR" = "AZN",
): string {
  const compact = formatCompactNumber(value);
  if (compact === "—") return "—";
  const symbol = currency === "AZN" ? "₼" : currency === "USD" ? "$" : "€";
  return `${compact} ${symbol}`;
}

function trimZero(s: string): string {
  // "1.50" → "1.5", "1.00" → "1"
  return s.replace(/\.?0+$/, "").replace(".", ",");
}

export function formatDate(value: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("az-AZ", opts ?? { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/**
 * Parse a "YYYY-MM-DD" string as LOCAL midnight (anchored at 12:00 noon to avoid
 * any DST/timezone shift). Using `new Date("YYYY-MM-DD")` parses as UTC midnight,
 * which becomes the PREVIOUS day in negative-UTC-offset locales — the classic
 * "user typed 14, system stored 13" off-by-one bug.
 */
export function parseLocalDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) {
    const fallback = new Date(s);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mo - 1, d, 12, 0, 0, 0);
}
