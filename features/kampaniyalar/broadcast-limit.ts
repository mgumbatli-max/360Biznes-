import "server-only";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Kampaniya broadcast (Telegram / SMS) üçün rate limit.
 *
 * `audit_log` cədvəlində `emeliyyat = "broadcast"` qeydlərini sayır.
 * Çox tez-tez broadcast spam riskini azaldır.
 *
 * Default limitlər (sahibkar `ayarlar` qrup="kampaniya" ilə dəyişə bilər):
 *   - Saatlıq: 10 broadcast / tenant
 *   - Gündəlik: 50 broadcast / tenant
 */
export type BroadcastLimitResult =
  | { ok: true; remaining: { saatlik: number; gunluk: number } }
  | { ok: false; error: string; sayilanlar: { saatlik: number; gunluk: number } };

const DEFAULT_SAATLIK = 10;
const DEFAULT_GUNLUK = 50;
const MIN_LIMIT = 1;
const MAX_LIMIT = 1000;

async function loadLimits(sahibkarId: string): Promise<{ saatlik: number; gunluk: number }> {
  try {
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: "kampaniya", acar: { in: ["broadcast_saatlik", "broadcast_gunluk"] } },
      select: { acar: true, deyer: true },
    });
    const map = new Map(rows.map((r) => [r.acar, r.deyer]));
    const sParsed = Number(map.get("broadcast_saatlik"));
    const gParsed = Number(map.get("broadcast_gunluk"));
    const saatlik = Number.isFinite(sParsed) && sParsed > 0
      ? Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, sParsed))
      : DEFAULT_SAATLIK;
    const gunluk = Number.isFinite(gParsed) && gParsed > 0
      ? Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, gParsed))
      : DEFAULT_GUNLUK;
    return { saatlik, gunluk };
  } catch {
    return { saatlik: DEFAULT_SAATLIK, gunluk: DEFAULT_GUNLUK };
  }
}

export async function checkBroadcastRateLimit(): Promise<BroadcastLimitResult> {
  const { sahibkarId } = requireTenant();
  const { saatlik, gunluk } = await loadLimits(sahibkarId);

  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const [perHour, perDay] = await Promise.all([
      prisma.audit_log.count({
        where: { emeliyyat: "broadcast", yaradildi: { gte: hourAgo } },
      }),
      prisma.audit_log.count({
        where: { emeliyyat: "broadcast", yaradildi: { gte: dayAgo } },
      }),
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
    console.warn("[checkBroadcastRateLimit] DB error", e);
    return {
      ok: false,
      error: "Rate limit yoxlanması alınmadı, bir az sonra cəhd edin",
      sayilanlar: { saatlik: 0, gunluk: 0 },
    };
  }
}
