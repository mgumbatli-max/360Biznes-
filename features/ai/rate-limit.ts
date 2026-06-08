import "server-only";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * AI istifadəsi üçün sadə rate-limit + günlük quota.
 *
 * `ai_sohbet_loq` cədvəlində son saatın və günün rekord sayını sayır.
 * Vercel serverless-də in-memory Map etibarlı deyil, ona görə DB-əsaslı.
 *
 * Default limitlər:
 *   - Saatlıq: 30 mesaj / istifadəçi
 *   - Gündəlik: 200 mesaj / istifadəçi (orta token istifadəsi nəzərə alınıb)
 *
 * Sahibkar `ayarlar` qrup="ai", acar="saatlik_limit" / "gunluk_limit" ilə
 * limitləri dəyişə bilər.
 */
export type RateLimitResult =
  | { ok: true; saatlik: number; gunluk: number }
  | { ok: false; error: string; saatlik: number; gunluk: number };

const DEFAULT_SAATLIK = 30;
const DEFAULT_GUNLUK = 200;
const MIN_LIMIT = 5;
const MAX_LIMIT = 5000;

async function loadLimits(sahibkarId: string): Promise<{ saatlik: number; gunluk: number }> {
  try {
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: "ai", acar: { in: ["saatlik_limit", "gunluk_limit"] } },
      select: { acar: true, deyer: true },
    });
    const map = new Map(rows.map((r) => [r.acar, r.deyer]));
    const sParsed = Number(map.get("saatlik_limit"));
    const gParsed = Number(map.get("gunluk_limit"));
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

export async function checkAiRateLimit(): Promise<RateLimitResult> {
  const { sahibkarId, istifadeciId } = requireTenant();
  const { saatlik, gunluk } = await loadLimits(sahibkarId);

  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const [perHour, perDay] = await Promise.all([
      prisma.ai_sohbet_loq.count({
        where: { istifadeci_id: istifadeciId, yaradildi: { gte: hourAgo } },
      }),
      prisma.ai_sohbet_loq.count({
        where: { istifadeci_id: istifadeciId, yaradildi: { gte: dayAgo } },
      }),
    ]);

    if (perHour >= saatlik) {
      return {
        ok: false,
        error: `Saatlıq AI sorğu limitiniz (${saatlik}) doldu. Bir saat gözləyin və ya sahibkardan limiti artırmasını xahiş edin.`,
        saatlik: perHour,
        gunluk: perDay,
      };
    }
    if (perDay >= gunluk) {
      return {
        ok: false,
        error: `Gündəlik AI sorğu limitiniz (${gunluk}) doldu. Sabaha qədər gözləyin.`,
        saatlik: perHour,
        gunluk: perDay,
      };
    }
    return { ok: true, saatlik: perHour, gunluk: perDay };
  } catch (e) {
    // DB xətasında rate-limit bypass etmirik — fail-safe deny
    console.warn("[checkAiRateLimit] DB error", e);
    return { ok: false, error: "Rate limit yoxlanması alınmadı, bir az sonra cəhd edin", saatlik: 0, gunluk: 0 };
  }
}
