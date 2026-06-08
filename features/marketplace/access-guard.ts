import "server-only";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Marketplace & Webhook modulu üçün icaze + cache helper-ləri.
 *
 * İcazə kodları (scripts/migrations/2026-06-02-marketplace-permissions.sql):
 *   - marketplace.oxu      — marketplace siyahısı + sosial post oxu
 *   - marketplace.idare    — marketplace/sosial hesab yarat/redaktə/sil
 *   - marketplace.sync     — sync tetiklemek (bu əməliyyat pul/quota tələb edir)
 *   - webhook.idare        — webhook endpoint yarat/redaktə/sil
 *   - webhook.test         — webhook test sorğu göndər (SSRF-safe)
 *   - social.publish       — sosial post avtomatik dərc et
 *
 * Sahibkar/admin/owner/direktor avtomatik keçir.
 */
export type MarketplacePerm =
  | "marketplace.oxu"
  | "marketplace.idare"
  | "marketplace.sync"
  | "webhook.idare"
  | "webhook.test"
  | "social.publish";

export function isMarketplacePrivileged(rolAd: string | undefined | null): boolean {
  const r = (rolAd ?? "").toLowerCase();
  return r.includes("sahibkar") || r.includes("admin") || r.includes("owner") || r.includes("direktor");
}

export async function requireMarketplaceActionPerm(perm: MarketplacePerm | MarketplacePerm[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isMarketplacePrivileged(rolAd)) return { ok: true };
  const icazeler = await getRequestPermissions();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (perms.some((p) => icazeler.includes(p))) return { ok: true };
  return { ok: false, error: `Bu əməliyyat üçün «${perms.join("» / «")}» icazələrindən biri lazımdır` };
}

export function bustMarketplaceCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`dashboard:${sahibkarId}`, "max");
    revalidateTag(`nezaret:${sahibkarId}`, "max");
    revalidateTag(`marketplace:${sahibkarId}`, "max");
  } catch {
    // tenant yox — TTL tutacaq
  }
}

/**
 * Sync rate limit — saatlıq 1 toplu sync / tenant.
 * audit_log-da `emeliyyat = "sync"` qeydlərini sayır.
 */
export async function checkSyncRateLimit(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const count = await prisma.audit_log.count({
      where: { emeliyyat: "sync", resurs_nov: "marketplace_bulk", yaradildi: { gte: hourAgo } },
    });
    if (count >= 1) {
      return { ok: false, error: "Saatlıq toplu sync limiti (1) doldu — bir saat gözləyin" };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[checkSyncRateLimit]", e);
    return { ok: true }; // fail-open
  }
}

/**
 * PII-i webhook payload-dan redact et (telefon, email).
 */
export function redactWebhookPayload<T>(payload: T): T {
  if (!payload || typeof payload !== "object") return payload;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = JSON.parse(JSON.stringify(payload));
  const PII_FIELDS = ["telefon", "phone", "email", "fin_kod", "bank_hesab", "iban", "kart_kod"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(node: any) {
    if (!node || typeof node !== "object") return;
    for (const key of Object.keys(node)) {
      if (PII_FIELDS.includes(key.toLowerCase()) && typeof node[key] === "string") {
        const v = node[key] as string;
        node[key] = v.length > 4 ? `****${v.slice(-4)}` : "****";
      } else if (typeof node[key] === "object") {
        walk(node[key]);
      }
    }
  }
  walk(obj);
  return obj as T;
}
