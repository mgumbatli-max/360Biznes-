import "server-only";
import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { getTenant } from "@/lib/db/tenant-context";
import { safeAuditLog } from "./safe-log";
import { parseUserAgent } from "@/lib/auth/device-fingerprint";

/**
 * Yüksək səviyyəli audit helper. Yalnız operasiyanı və resursu yaz —
 * sahibkar_id, istifadeci_id, IP və user-agent avtomatik tenant context-dən
 * və request header-dən çəkilir.
 *
 * Çağırış nümunələri:
 *   await audit("yarat", "mehsul", productId, { yeni_data: input });
 *   await audit("sil", "mehsul", productId, { evvelki_data: snapshot });
 *   await audit("yenile", "qiymet", productId, { evvelki_data: { qiymet: old }, yeni_data: { qiymet: new } });
 *
 * Tenant context yoxdursa səssizcə yazmır (cron, public endpoint).
 * safeAuditLog audit_log_outbox fallback ilə dəstəklənir.
 */
export type AuditOp =
  | "yarat"
  | "yenile"
  | "sil"
  | "berpa"
  | "tesdiq"
  | "redd"
  | "imzala"
  | "legv"
  | "import"
  | "export"
  | "giris"
  | "cixis"
  | "uğursuz_giris"
  | "icaze_dəyişdir"
  | "ayar_dəyiş"
  | "kod_təyin"
  | "kod_yoxla";

// Audit log payload — sahə dəyərləri JSON-serializable olmalıdır.
// Prisma `InputJsonValue` çox ciddidir; biz daxildə json-safe-ə çevirəcəyik.
type JsonLikeValue =
  | string | number | boolean | null
  | JsonLikeValue[]
  | { [k: string]: JsonLikeValue | undefined };
type JsonLike = Record<string, unknown> | unknown[] | null | undefined;
type Extras = {
  evvelki_data?: JsonLike;
  yeni_data?: JsonLike;
  sebeb?: string;
  status?: "ugur" | "ugursuz" | "qismen";
};

/** Dekoratorları (Decimal, Date, BigInt) JSON-safe-ə çevir. */
function toJsonSafe(v: unknown): JsonLikeValue {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return v.toISOString();
  // Prisma Decimal
  if (typeof v === "object" && v && "toString" in v && (v as { constructor?: { name?: string } }).constructor?.name === "Decimal") {
    const s = (v as { toString(): string }).toString();
    const n = Number(s);
    return Number.isFinite(n) ? n : s;
  }
  if (Array.isArray(v)) return v.map(toJsonSafe);
  if (typeof v === "object") {
    const out: Record<string, JsonLikeValue> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val === undefined) continue;
      out[k] = toJsonSafe(val);
    }
    return out;
  }
  return null;
}

async function clientHints(): Promise<{ ip: string | null; ua: string | null }> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    const ip = (xff?.split(",")[0]?.trim()) || h.get("x-real-ip") || null;
    const ua = h.get("user-agent") || null;
    return { ip, ua };
  } catch {
    return { ip: null, ua: null };
  }
}

export async function audit(
  op: AuditOp | string,
  resourceType: string,
  resourceId: string | number | null,
  extras: Extras = {},
): Promise<void> {
  const ctx = getTenant();
  if (!ctx) return; // No tenant — system/cron path; audit is opt-in via explicit safeAuditLog
  const { ip, ua } = await clientHints();
  // UA-dan cihaz/os/brauzer çıxar — audit_log-da cihaz izlənməsi hər yazılışda olsun.
  // Bu sayədə Aktiv cihazlar paneli istifadəçinin hər əməliyyatından "aktiv"
  // olduğunu görür, yalnız login zamanı yox.
  const device = parseUserAgent(ua);
  const ev = extras.evvelki_data !== undefined ? toJsonSafe(extras.evvelki_data) : undefined;
  const yn = extras.yeni_data !== undefined ? toJsonSafe(extras.yeni_data) : undefined;
  await safeAuditLog({
    sahibkar_id: ctx.sahibkarId,
    istifadeci_id: ctx.istifadeciId,
    emeliyyat: op,
    resurs_nov: resourceType,
    resurs_id: resourceId !== null ? String(resourceId) : null,
    evvelki_data: ev as Prisma.InputJsonValue | undefined,
    yeni_data: yn as Prisma.InputJsonValue | undefined,
    sebeb: extras.sebeb ?? undefined,
    cihaz: device.cihaz !== "naməlum" ? device.cihaz.slice(0, 20) : undefined,
    os: device.os?.slice(0, 60) ?? undefined,
    brauzer: device.brauzer?.slice(0, 60) ?? undefined,
    status: extras.status ?? "ugur",
    ip_adres: ip ?? undefined,
    user_agent: ua ?? undefined,
  });
}

/**
 * Diff iki obyekti müqayisə edərək yalnız dəyişən sahələri qaytarır —
 * audit log payload-larını kiçik saxlamaq üçün.
 */
export function diffObjects<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T | null | undefined,
): { before: Partial<T>; after: Partial<T> } | null {
  if (!before && !after) return null;
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  const keys = new Set<string>([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  for (const k of keys) {
    const bv = before ? (before as Record<string, unknown>)[k] : undefined;
    const av = after ? (after as Record<string, unknown>)[k] : undefined;
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      (b as Record<string, unknown>)[k] = bv;
      (a as Record<string, unknown>)[k] = av;
    }
  }
  if (Object.keys(b).length === 0 && Object.keys(a).length === 0) return null;
  return { before: b, after: a };
}
