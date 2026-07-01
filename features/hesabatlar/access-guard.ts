import "server-only";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Hesabatlar modulu üçün icaze + cache helper-ləri.
 *
 * Per-page permission map — hansı raport hansı icazəni tələb edir:
 *   - /hesabatlar             → hesabat.view (master)
 *   - /hesabatlar/satis       → hesabat.view
 *   - /hesabatlar/mehsul      → hesabat.view
 *   - /hesabatlar/maliyye     → maliye.view (P&L, OPEX)
 *   - /hesabatlar/marja       → maliye.view (maya görünür)
 *   - /hesabatlar/pul         → maliye.view (cashflow)
 *   - /hesabatlar/musteri     → musteri.oxu
 *   - /hesabatlar/emekdas     → isci.view / maas.view
 *   - /hesabatlar/idxal       → satinalma.view / anbar.view
 *   - /hesabatlar/marketplace → marketplace.oxu
 *   - /hesabatlar/stok        → anbar.view
 *   - /hesabatlar/servis      → servis.view
 *   - /hesabatlar/ai          → ai.istifade
 *
 * Sahibkar/admin/owner/direktor avtomatik keçir.
 */
export type HesabatPerm =
  | "hesabat.view"
  | "maliye.view"
  | "musteri.oxu"
  | "isci.view"
  | "maas.view"
  | "anbar.view"
  | "satinalma.view"
  | "marketplace.oxu"
  | "servis.view"
  | "ai.istifade"
  | "hesabat.idare"; // saved template, schedule email, share

export function isHesabatPrivileged(rolAd: string | undefined | null): boolean {
  const r = (rolAd ?? "").toLowerCase();
  return r.includes("sahibkar") || r.includes("admin") || r.includes("owner") || r.includes("direktor");
}

/**
 * Page-səviyyəli icaze yoxlaması — yoxsa redirect.
 */
export async function requireHesabatPagePerm(perm: HesabatPerm | HesabatPerm[]): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/giris");
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isHesabatPrivileged(rolAd)) return;
  const icazeler = await getRequestPermissions();
  const perms = Array.isArray(perm) ? perm : [perm];
  // 🔒 (audit #1 kritik) hesabat.view ARTIQ master DEYİL — yalnız tələb olunan
  // spesifik icazə(lər) yoxlanır. Əvvəl `|| hesabat.view` bütün həssas səhifələri
  // (maliyyə P&L, müştəri PII, əməkdaş maaşı) tək hesabat.view ilə açırdı. İndi
  // /maliyye maliye.view, /musteri musteri.oxu, /emekdas isci.view/maas.view tələb edir.
  // (Səhifə hesabat.view tələb edirsə, o onsuz da perms-dədir.) Sahibkar/admin yuxarıda bypass edir.
  const ok = perms.some((p) => icazeler.includes(p));
  if (!ok) {
    const kod = encodeURIComponent(perms.join(","));
    redirect(`/icaze-yox?kod=${kod}&from=hesabatlar`);
  }
}

/**
 * Server action səviyyəli icaze yoxlaması.
 */
export async function requireHesabatActionPerm(perm: HesabatPerm | HesabatPerm[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (isHesabatPrivileged(rolAd)) return { ok: true };
  const icazeler = await getRequestPermissions();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (perms.some((p) => icazeler.includes(p))) return { ok: true };
  return { ok: false, error: `Bu əməliyyat üçün «${perms.join("» / «")}» icazələrindən biri lazımdır` };
}

export function bustHesabatCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`hesabat:${sahibkarId}`, "max");
    revalidateTag(`dashboard:${sahibkarId}`, "max");
  } catch {
    // tenant context yox — TTL tutacaq
  }
}

/**
 * AI insights üçün quota (per tenant).
 */
const DEFAULT_AI_SAATLIK = 60;
const DEFAULT_AI_GUNLUK = 400;

export async function checkAiReportQuota(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    // Sahibkar konfiqurasiya etmişdirsə oxu
    const cfg = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: "hesabat", acar: { in: ["ai_saatlik", "ai_gunluk"] } },
      select: { acar: true, deyer: true },
    });
    const cfgMap = new Map(cfg.map((r) => [r.acar, Number(r.deyer)]));
    const saatlik = Number.isFinite(cfgMap.get("ai_saatlik")) && (cfgMap.get("ai_saatlik") ?? 0) > 0
      ? Math.min(1000, Math.max(1, cfgMap.get("ai_saatlik")!))
      : DEFAULT_AI_SAATLIK;
    const gunluk = Number.isFinite(cfgMap.get("ai_gunluk")) && (cfgMap.get("ai_gunluk") ?? 0) > 0
      ? Math.min(10000, Math.max(1, cfgMap.get("ai_gunluk")!))
      : DEFAULT_AI_GUNLUK;

    const [perHour, perDay] = await Promise.all([
      prisma.ai_sohbet_loq.count({
        where: { kanal: "hesabat_ai", yaradildi: { gte: hourAgo } },
      }),
      prisma.ai_sohbet_loq.count({
        where: { kanal: "hesabat_ai", yaradildi: { gte: dayAgo } },
      }),
    ]);

    if (perHour >= saatlik) {
      return { ok: false, error: `Saatlıq hesabat AI limiti (${saatlik}) doldu` };
    }
    if (perDay >= gunluk) {
      return { ok: false, error: `Gündəlik hesabat AI limiti (${gunluk}) doldu` };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[checkAiReportQuota]", e);
    return { ok: true }; // fail-open
  }
}

/**
 * Saved template / schedule / favorites üçün ortaq id-key generator.
 */
export function reportTemplateKey(istifadeciId: string, name: string): string {
  return `${istifadeciId}:${name.toLowerCase().replace(/\s+/g, "_").slice(0, 50)}`;
}
