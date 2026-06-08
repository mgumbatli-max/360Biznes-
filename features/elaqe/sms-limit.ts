import "server-only";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * SMS göndərmə üçün sadə rate-limit + günlük quota.
 *
 * `contact_communications` cədvəlində kanal="sms" və istiqamet="cixan" olan
 * son saat/gün rekord sayını istifadəçi səviyyəsində sayır.
 *
 * Default limitlər:
 *   - Saatlıq: 100 SMS / istifadəçi
 *   - Gündəlik: 500 SMS / istifadəçi
 *
 * `ayarlar` qrup="elaqe", acar="sms_saatlik" / "sms_gunluk" ilə dəyişilə bilər.
 */
export type SmsLimitResult =
  | { ok: true; remaining: { saatlik: number; gunluk: number } }
  | { ok: false; error: string; sayilanlar: { saatlik: number; gunluk: number } };

const DEFAULT_SAATLIK = 100;
const DEFAULT_GUNLUK = 500;
const MIN_LIMIT = 5;
const MAX_LIMIT = 10000;

async function loadSmsLimits(sahibkarId: string): Promise<{ saatlik: number; gunluk: number }> {
  try {
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: "elaqe", acar: { in: ["sms_saatlik", "sms_gunluk"] } },
      select: { acar: true, deyer: true },
    });
    const map = new Map(rows.map((r) => [r.acar, r.deyer]));
    const sParsed = Number(map.get("sms_saatlik"));
    const gParsed = Number(map.get("sms_gunluk"));
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

export async function checkSmsRateLimit(needed = 1): Promise<SmsLimitResult> {
  const { sahibkarId, istifadeciId } = requireTenant();
  const { saatlik, gunluk } = await loadSmsLimits(sahibkarId);

  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const [perHour, perDay] = await Promise.all([
      prisma.contact_communications.count({
        where: {
          istifadeci_id: istifadeciId,
          kanal: "sms",
          istiqamet: "cixan",
          yaradildi: { gte: hourAgo },
        },
      }),
      prisma.contact_communications.count({
        where: {
          istifadeci_id: istifadeciId,
          kanal: "sms",
          istiqamet: "cixan",
          yaradildi: { gte: dayAgo },
        },
      }),
    ]);

    if (perHour + needed > saatlik) {
      return {
        ok: false,
        error: `Saatlıq SMS limitiniz (${saatlik}) doldu — qalan ${Math.max(0, saatlik - perHour)}.`,
        sayilanlar: { saatlik: perHour, gunluk: perDay },
      };
    }
    if (perDay + needed > gunluk) {
      return {
        ok: false,
        error: `Gündəlik SMS limitiniz (${gunluk}) doldu — qalan ${Math.max(0, gunluk - perDay)}.`,
        sayilanlar: { saatlik: perHour, gunluk: perDay },
      };
    }
    return {
      ok: true,
      remaining: { saatlik: Math.max(0, saatlik - perHour), gunluk: Math.max(0, gunluk - perDay) },
    };
  } catch (e) {
    console.warn("[checkSmsRateLimit] DB error", e);
    return {
      ok: false,
      error: "SMS limit yoxlanması alınmadı, bir az sonra cəhd edin",
      sayilanlar: { saatlik: 0, gunluk: 0 },
    };
  }
}
