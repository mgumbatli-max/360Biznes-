import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type AktivlikSetri = {
  istifadeci_id: string;
  ad_soyad: string;
  vezife: string | null;
  rol_ad: string | null;
  // Aktivlik metrikləri
  toplam_emeliyyat: number;
  yarat: number;
  yenile: number;
  sil: number;
  // Anomaliyalar (0-100 risk skoru)
  gece_aktivlik_say: number;     // 22:00-08:00 arası
  asta_gun_aktivlik_say: number; // Şənbə/Bazar
  son_24s_emeliyyat: number;
  son_giris: Date | null;
  // Hesablanmış anomaliya skoru (0-100, yüksək = şübhəli)
  risk_skoru: number;
  risk_sebebler: string[];
};

/**
 * Müəyyən gün aralığı üçün hər əməkdaş üzrə aktivlik və anomaliya hesabatı.
 *
 * Anomaliyalar:
 *  - Gecə (22:00-08:00) aktivliyi → +30 risk
 *  - Asta gün (Şənbə/Bazar) aktivliyi → +20 risk
 *  - Son 24 saat ərzində çox əməliyyat (50+) → +25 risk
 *  - Çox silmə əməliyyatı (>5 son 7 gündə) → +25 risk
 */
export async function getAktivlikDashboard(days = 7): Promise<AktivlikSetri[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const since = new Date();
    since.setDate(since.getDate() - days);
    const last24 = new Date();
    last24.setHours(last24.getHours() - 24);

    // Aktiv əməkdaşlar
    const employees = await prisma.istifadeciler.findMany({
      where: { sahibkar_id: sahibkarId, aktiv: true, sisteme_daxil_olur: true },
      select: {
        id: true,
        ad_soyad: true,
        vezife: true,
        son_giris: true,
        roles: { select: { ad: true } },
      },
      take: 200,
    });

    if (employees.length === 0) return [];

    // Audit log statistikası — paralel
    const empIds = employees.map((e) => e.id);
    const [allActions, last24Actions, hourBreakdown, dayBreakdown] = await Promise.all([
      // Bütün dövr — yarat/yenilə/sil
      prisma.audit_log.groupBy({
        by: ["istifadeci_id", "emeliyyat"],
        where: {
          sahibkar_id: sahibkarId,
          istifadeci_id: { in: empIds },
          yaradildi: { gte: since },
        },
        _count: { _all: true },
      }),
      // Son 24 saat
      prisma.audit_log.groupBy({
        by: ["istifadeci_id"],
        where: {
          sahibkar_id: sahibkarId,
          istifadeci_id: { in: empIds },
          yaradildi: { gte: last24 },
        },
        _count: { _all: true },
      }),
      // Saat dəyişkənliyi — gecə aktivliyi
      prisma.$queryRaw<{ istifadeci_id: string; cnt: bigint }[]>`
        SELECT istifadeci_id::text, COUNT(*)::bigint AS cnt
          FROM audit_log
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND istifadeci_id = ANY(${empIds}::uuid[])
           AND yaradildi >= ${since}
           AND (EXTRACT(HOUR FROM yaradildi) >= 22 OR EXTRACT(HOUR FROM yaradildi) < 8)
         GROUP BY istifadeci_id
      `.catch(() => []),
      // Asta gün aktivliyi
      prisma.$queryRaw<{ istifadeci_id: string; cnt: bigint }[]>`
        SELECT istifadeci_id::text, COUNT(*)::bigint AS cnt
          FROM audit_log
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND istifadeci_id = ANY(${empIds}::uuid[])
           AND yaradildi >= ${since}
           AND EXTRACT(DOW FROM yaradildi) IN (0, 6)
         GROUP BY istifadeci_id
      `.catch(() => []),
    ]);

    // Mapla
    type ActionMap = { yarat: number; yenile: number; sil: number; toplam: number };
    const actionMap = new Map<string, ActionMap>();
    for (const a of allActions) {
      if (!a.istifadeci_id) continue;
      const cur = actionMap.get(a.istifadeci_id) ?? { yarat: 0, yenile: 0, sil: 0, toplam: 0 };
      const count = a._count._all;
      const eml = (a.emeliyyat ?? "").toLowerCase();
      cur.toplam += count;
      if (eml.includes("yarad") || eml === "create") cur.yarat += count;
      else if (eml.includes("yenile") || eml === "update") cur.yenile += count;
      else if (eml.includes("sil") || eml === "delete") cur.sil += count;
      actionMap.set(a.istifadeci_id, cur);
    }
    const last24Map = new Map(last24Actions.map((a) => [a.istifadeci_id ?? "", a._count._all]));
    const geceMap = new Map<string, number>(hourBreakdown.map((h) => [h.istifadeci_id, Number(h.cnt)]));
    const astaMap = new Map<string, number>(dayBreakdown.map((d) => [d.istifadeci_id, Number(d.cnt)]));

    // Hər əməkdaş üçün risk hesabla
    const rows: AktivlikSetri[] = employees.map((e) => {
      const a = actionMap.get(e.id) ?? { yarat: 0, yenile: 0, sil: 0, toplam: 0 };
      const last24Cnt = last24Map.get(e.id) ?? 0;
      const geceCnt = geceMap.get(e.id) ?? 0;
      const astaCnt = astaMap.get(e.id) ?? 0;

      let risk = 0;
      const sebebler: string[] = [];

      if (geceCnt > 0) {
        risk += Math.min(30, geceCnt * 3);
        sebebler.push(`${geceCnt} gecə əməliyyatı (22:00-08:00)`);
      }
      if (astaCnt > 0) {
        risk += Math.min(20, astaCnt * 2);
        sebebler.push(`${astaCnt} həftəsonu əməliyyatı`);
      }
      if (last24Cnt > 50) {
        risk += 25;
        sebebler.push(`Son 24s-də ${last24Cnt} əməliyyat — yüksək tempə`);
      }
      if (a.sil > 5) {
        risk += 25;
        sebebler.push(`${a.sil} silmə əməliyyatı — yoxla`);
      }

      return {
        istifadeci_id: e.id,
        ad_soyad: e.ad_soyad,
        vezife: e.vezife,
        rol_ad: e.roles?.ad ?? null,
        toplam_emeliyyat: a.toplam,
        yarat: a.yarat,
        yenile: a.yenile,
        sil: a.sil,
        gece_aktivlik_say: geceCnt,
        asta_gun_aktivlik_say: astaCnt,
        son_24s_emeliyyat: last24Cnt,
        son_giris: e.son_giris,
        risk_skoru: Math.min(100, risk),
        risk_sebebler: sebebler,
      };
    });

    rows.sort((a, b) => b.risk_skoru - a.risk_skoru || b.toplam_emeliyyat - a.toplam_emeliyyat);
    return rows;
  });
}
