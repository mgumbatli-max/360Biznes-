import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * DETERMINISTIK az-AZ rəqəm formatı — minlik ayırıcı boşluq, onluq vergül.
 * KRİTİK: `Intl.NumberFormat("az-AZ")` Node (server) və brauzer (client) ICU
 * datasına görə FƏRQLİ nəticə verirdi (server "AZN 100.00", client "100,00 ₼")
 * → hydration mismatch → React server HTML-i atıb yenidən render edirdi (flash +
 * yavaşlıq + console error). Manual format hər iki tərəfdə eynidir.
 */
function azGroup(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const CURRENCY_SYMBOL: Record<string, string> = {
  AZN: "₼", USD: "$", EUR: "€", RUB: "₽", TRY: "₺", GBP: "£",
};

export function formatMoney(value: number | string | null | undefined, currency = "AZN") {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const neg = num < 0;
  const [intPart, dec] = Math.abs(num).toFixed(2).split(".");
  return `${neg ? "-" : ""}${azGroup(intPart)},${dec} ${sym}`;
}

export function formatNumber(value: number | string | null | undefined, fractionDigits = 0) {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  const neg = num < 0;
  const [intPart, dec] = Math.abs(num).toFixed(fractionDigits).split(".");
  return `${neg ? "-" : ""}${azGroup(intPart)}${dec ? "," + dec : ""}`;
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
  return formatNumber(num); // deterministik (Intl mismatch-dən qaçınmaq üçün)
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
 * Azerbaijani-locale relative time (e.g. "indicə", "5 dəq əvvəl", "2 saat əvvəl").
 * 1 günü keçəndə tarixə dəyişir.
 */
export function formatRelativeTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  if (diff < 0) return formatDate(date, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
  const sec = Math.floor(diff / 1000);
  if (sec < 30) return "indicə";
  if (sec < 60) return `${sec} san əvvəl`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dəq əvvəl`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat əvvəl`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "dünən";
  if (day < 7) return `${day} gün əvvəl`;
  return formatDate(date, { day: "numeric", month: "short" });
}

/**
 * 2 sözdən baş hərfləri çıxarır — avatar fallback üçün.
 *   "Məhəmməd Hümbətli" → "MH"
 *   "Apple Store"       → "AS"
 *   "Mehsul"            → "ME"
 */
export function initialsFromName(name: string | null | undefined, max = 2): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, max).toUpperCase();
  return words.slice(0, max).map((w) => w[0]).join("").toUpperCase();
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
