import "server-only";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * CRM broadcast + AI cost quota.
 *
 * - Broadcast: saatlıq 5 / gündəlik 20 kampaniya / tenant
 * - AI cavab: saatlıq 50 / gündəlik 300 sorğu / istifadəçi
 *
 * Sahibkar `ayarlar` qrup="crm" ilə dəyişə bilər:
 *   broadcast_saatlik, broadcast_gunluk, ai_cavab_saatlik, ai_cavab_gunluk
 */
const DEFAULT_BROADCAST_SAATLIK = 5;
const DEFAULT_BROADCAST_GUNLUK = 20;
const DEFAULT_AI_CAVAB_SAATLIK = 50;
const DEFAULT_AI_CAVAB_GUNLUK = 300;
const MIN_LIMIT = 1;
const MAX_LIMIT = 10000;

export type QuotaResult =
  | { ok: true; remaining: { saatlik: number; gunluk: number } }
  | { ok: false; error: string; sayilanlar: { saatlik: number; gunluk: number } };

async function loadLimit(
  sahibkarId: string,
  acar: string,
  fallback: number,
): Promise<number> {
  try {
    const row = await prisma.ayarlar.findFirst({
      where: { sahibkar_id: sahibkarId, qrup: "crm", acar },
      select: { deyer: true },
    });
    if (!row?.deyer) return fallback;
    const n = Number(row.deyer);
    return Number.isFinite(n) && n > 0
      ? Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, n))
      : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Broadcast kampaniya yaratma rate limit.
 */
export async function checkBroadcastQuota(): Promise<QuotaResult> {
  const { sahibkarId } = requireTenant();
  const [saatlik, gunluk] = await Promise.all([
    loadLimit(sahibkarId, "broadcast_saatlik", DEFAULT_BROADCAST_SAATLIK),
    loadLimit(sahibkarId, "broadcast_gunluk", DEFAULT_BROADCAST_GUNLUK),
  ]);

  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const [perHour, perDay] = await Promise.all([
      prisma.broadcast_kampaniyalari.count({ where: { yaradildi: { gte: hourAgo } } }),
      prisma.broadcast_kampaniyalari.count({ where: { yaradildi: { gte: dayAgo } } }),
    ]);

    if (perHour >= saatlik) {
      return {
        ok: false,
        error: `Saatlıq broadcast limiti (${saatlik}) doldu — bir saat gözləyin.`,
        sayilanlar: { saatlik: perHour, gunluk: perDay },
      };
    }
    if (perDay >= gunluk) {
      return {
        ok: false,
        error: `Gündəlik broadcast limiti (${gunluk}) doldu — sabaha qədər gözləyin.`,
        sayilanlar: { saatlik: perHour, gunluk: perDay },
      };
    }
    return {
      ok: true,
      remaining: { saatlik: saatlik - perHour, gunluk: gunluk - perDay },
    };
  } catch (e) {
    console.warn("[checkBroadcastQuota]", e);
    return {
      ok: false,
      error: "Quota yoxlanması alınmadı, bir az sonra cəhd edin",
      sayilanlar: { saatlik: 0, gunluk: 0 },
    };
  }
}

/**
 * AI cavab təklifi rate limit (per istifadəçi).
 */
export async function checkAiCavabQuota(needed = 1): Promise<QuotaResult> {
  const { sahibkarId, istifadeciId } = requireTenant();
  const [saatlik, gunluk] = await Promise.all([
    loadLimit(sahibkarId, "ai_cavab_saatlik", DEFAULT_AI_CAVAB_SAATLIK),
    loadLimit(sahibkarId, "ai_cavab_gunluk", DEFAULT_AI_CAVAB_GUNLUK),
  ]);

  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const [perHour, perDay] = await Promise.all([
      prisma.ai_sohbet_loq.count({
        where: { istifadeci_id: istifadeciId, kanal: "crm_cavab", yaradildi: { gte: hourAgo } },
      }),
      prisma.ai_sohbet_loq.count({
        where: { istifadeci_id: istifadeciId, kanal: "crm_cavab", yaradildi: { gte: dayAgo } },
      }),
    ]);

    if (perHour + needed > saatlik) {
      return {
        ok: false,
        error: `Saatlıq AI cavab limiti (${saatlik}) doldu.`,
        sayilanlar: { saatlik: perHour, gunluk: perDay },
      };
    }
    if (perDay + needed > gunluk) {
      return {
        ok: false,
        error: `Gündəlik AI cavab limiti (${gunluk}) doldu.`,
        sayilanlar: { saatlik: perHour, gunluk: perDay },
      };
    }
    return {
      ok: true,
      remaining: { saatlik: saatlik - perHour, gunluk: gunluk - perDay },
    };
  } catch (e) {
    console.warn("[checkAiCavabQuota]", e);
    return {
      ok: false,
      error: "Quota yoxlanması alınmadı",
      sayilanlar: { saatlik: 0, gunluk: 0 },
    };
  }
}
