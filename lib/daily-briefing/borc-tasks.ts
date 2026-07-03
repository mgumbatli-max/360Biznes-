import "server-only";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";
import { formatDate } from "@/lib/utils";

/**
 * Borc avto-tapşırıq generatoru.
 *
 * Hər gün dashboard açılanda runDailyBriefing tərəfindən çağırılır.
 * Borc 30+ gün olan müştərilər üçün avto-tapşırıq yaradır.
 *
 * Dublikat qarşılığı:
 *  - Son 7 gün ərzində eyni müştəri üçün borc tapşırığı varsa, yenisini yaratmır
 *  - `tapshiriq_obyektleri` cədvəlində kontragent əlaqəsi ilə yoxlanır
 *
 * Məsul təyini:
 *  - 1) Sahibkar tərəfindən təyin edilmiş default məsul (`ayarlar.borc_avto_mesul`)
 *  - 2) Yoxsa, müştərinin son satışını yaradan istifadəçi
 *  - 3) Yoxsa, ilk admin (rol 1) istifadəçi
 *
 * Bu funksiya tenant-context daxilində çağırılmalıdır (runDailyBriefing-dən gəlir).
 */
export async function generateBorcTasks(): Promise<{ yaradilan: number; atlanılan: number }> {
  const { sahibkarId } = requireTenant();

  try {
    // Ayarlardan oxu
    const ayar = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: "borc_avto" },
      select: { acar: true, deyer: true },
    });
    const cfg = Object.fromEntries(ayar.map((a) => [a.acar, a.deyer ?? ""]));

    const aktiv = cfg.aktiv === "1" || cfg.aktiv === "true";
    if (!aktiv) return { yaradilan: 0, atlanılan: 0 };

    const gunThreshold = Number(cfg.gun_threshold ?? "30") || 30;
    const tekrarYox = Number(cfg.tekrar_gun ?? "7") || 7;
    const defaultMesulId = cfg.mesul_id || null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - gunThreshold);
    const tekrarCutoff = new Date(today);
    tekrarCutoff.setDate(tekrarCutoff.getDate() - tekrarYox);

    // Borcu olan müştərilərin son satışını çək
    const debtorsWithLastSale = await prisma.$queryRaw<
      Array<{ kontragent_id: string; ad: string; borc: number; son_satis_tarix: Date; son_yaradan_id: string | null }>
    >`
      SELECT k.id::text AS kontragent_id,
             k.ad,
             COALESCE(k.borc, 0)::float AS borc,
             ls.tarix AS son_satis_tarix,
             ls.yaradan_id::text AS son_yaradan_id
        FROM kontragentler k
        JOIN LATERAL (
          SELECT ss.tarix, ss.yaradan_id
            FROM satis_sifarisleri ss
           WHERE ss.musteri_id = k.id
             AND ss.sahibkar_id = k.sahibkar_id
             AND ss.status NOT IN ('legv', 'qaralama', 'tesdiq_gozleyir')
           ORDER BY ss.tarix DESC
           LIMIT 1
        ) ls ON true
       WHERE k.sahibkar_id = ${sahibkarId}::uuid
         AND k.aktiv = TRUE
         AND k.borc > 0
         AND ls.tarix <= ${cutoffDate}
    `.catch(() => []);

    if (debtorsWithLastSale.length === 0) return { yaradilan: 0, atlanılan: 0 };

    // Default mesul ehtiyat — ilk admin
    const fallbackAdmin = await prisma.istifadeciler.findFirst({
      where: { sahibkar_id: sahibkarId, aktiv: true, rol_id: { in: [1, 9] } },
      select: { id: true },
    });
    const fallbackId = fallbackAdmin?.id ?? null;

    // Son 7 gün ərzində borc tapşırığı olan müştəriləri tap (dublikat qoru)
    const recentTaskIds = await prisma.$queryRaw<{ obyekt_id: string }[]>`
      SELECT DISTINCT to_.obyekt_id
        FROM tapshiriq_obyektleri to_
        JOIN tapshiriqlar t ON t.id = to_.tapshiriq_id
       WHERE to_.sahibkar_id = ${sahibkarId}::uuid
         AND to_.obyekt_nov = 'kontragent'
         AND t.tip = 'borc_xatirlatma'
         AND t.yaradildi >= ${tekrarCutoff}
    `.catch(() => []);
    const recentSet = new Set(recentTaskIds.map((r) => r.obyekt_id));

    let yaradilan = 0;
    let atlanılan = 0;

    for (const d of debtorsWithLastSale) {
      if (recentSet.has(d.kontragent_id)) {
        atlanılan++;
        continue;
      }
      const mesulId = defaultMesulId || d.son_yaradan_id || fallbackId;
      if (!mesulId) {
        atlanılan++;
        continue;
      }

      const borcFmt = d.borc.toFixed(2);
      const sonTarixFmt = formatDate(d.son_satis_tarix);
      const deadlineDate = new Date(today);
      deadlineDate.setDate(deadlineDate.getDate() + 3); // 3 günə cavab gözlənir

      try {
        const task = await prisma.tapshiriqlar.create({
          data: {
            sahibkar_id: sahibkarId,
            basliq: `🔔 Borc xatırlatması: ${d.ad}`,
            tesvir:
              `Müştəri: ${d.ad}\n` +
              `Borc məbləği: ${borcFmt} ₼\n` +
              `Son alış: ${sonTarixFmt}\n\n` +
              `Müştəri ilə əlaqə saxla, borcu xatırlat. WhatsApp və ya zəng et.`,
            prioritet: d.borc >= 1000 ? "yuksek" : "normal",
            mesul_id: mesulId,
            yaradan_id: mesulId, // sistem tərəfindən
            deadline: deadlineDate,
            xatirlatma: deadlineDate,
            tip: "borc_xatirlatma",
            kpi_enabled: true,
          },
        });

        // Müştəriyə bağla (tapshiriq_obyektleri)
        await prisma.tapshiriq_obyektleri.create({
          data: {
            sahibkar_id: sahibkarId,
            tapshiriq_id: task.id,
            obyekt_nov: "kontragent",
            obyekt_id: d.kontragent_id,
          },
        }).catch(() => {});

        yaradilan++;
      } catch {
        atlanılan++;
      }
    }

    return { yaradilan, atlanılan };
  } catch (e) {
    console.warn("[generateBorcTasks]", e);
    return { yaradilan: 0, atlanılan: 0 };
  }
}
