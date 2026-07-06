"use server";

import { revalidatePath } from "next/cache";
import { prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant, runWithTenant } from "@/lib/db/tenant-context";

/**
 * Manuel olaraq tövsiyələri yenidən hesabla — sahibkar gözləmədən cron axşamı.
 * Eyni məntiqi cron endpoint istifadə edir (compute-reorder-recommendations).
 */

type Result =
  | { ok: true; created: number; removed: number }
  | { ok: false; error: string };

const LEAD_TIME_GUN = 7;
const HORIZON_GUN = 21;

export async function recomputeReorderRecommendations(): Promise<Result> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      // Cari tenant kontekstində eyni hesablamanı edirik — cron endpoint
      // bütün tenant-lar üzərində dövr edir, bu yalnız cari tenant üçündür.
      const result = await computeForCurrentTenant(sahibkarId);
      revalidatePath("/anbar/satinalma/tovsiye");
      return { ok: true, created: result.created, removed: result.removed };
    } catch (e) {
      console.error("[recomputeReorderRecommendations]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Hesablama alınmadı" };
    }
  });
}

async function computeForCurrentTenant(sahibkarId: string): Promise<{ created: number; removed: number }> {
  const rows = await prismaUnscoped.$queryRaw<Array<{
    mehsul_id: string;
    cari_stok: number;
    kritik_stok: number;
    alish_qiymeti: number;
    son_7: number;
    son_30: number;
    son_techizatci: string | null;
  }>>`
    WITH stok_cem AS (
      SELECT mehsul_id, COALESCE(SUM(miqdar), 0)::float AS cari
        FROM stok
       WHERE sahibkar_id = ${sahibkarId}::uuid
       GROUP BY mehsul_id
    ),
    satis_7 AS (
      SELECT sls.mehsul_id, SUM(sls.miqdar)::float AS qty
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
       WHERE sls.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix >= CURRENT_DATE - INTERVAL '7 days'
         AND COALESCE(ss.status, '') NOT IN ('legv', 'qaytarilib')
       GROUP BY sls.mehsul_id
    ),
    satis_30 AS (
      SELECT sls.mehsul_id, SUM(sls.miqdar)::float AS qty
        FROM satis_sifaris_satirlari sls
        JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
       WHERE sls.sahibkar_id = ${sahibkarId}::uuid
         AND ss.tarix >= CURRENT_DATE - INTERVAL '30 days'
         AND COALESCE(ss.status, '') NOT IN ('legv', 'qaytarilib')
       GROUP BY sls.mehsul_id
    ),
    son_alis AS (
      SELECT DISTINCT ON (alss.mehsul_id)
             alss.mehsul_id,
             als.techiazatci_id::text AS techizatci_id
        FROM alis_sifaris_satirlari alss
        JOIN alis_sifarisleri als ON als.id = alss.sifaris_id
       WHERE alss.sahibkar_id = ${sahibkarId}::uuid
         AND als.techiazatci_id IS NOT NULL
       ORDER BY alss.mehsul_id, als.tarix DESC NULLS LAST
    )
    SELECT
      m.id::text AS mehsul_id,
      COALESCE(s.cari, 0) AS cari_stok,
      COALESCE(m.kritik_stok, 0)::float AS kritik_stok,
      COALESCE(m.alish_qiymeti, 0)::float AS alish_qiymeti,
      COALESCE(s7.qty, 0) AS son_7,
      COALESCE(s30.qty, 0) AS son_30,
      sa.techizatci_id AS son_techizatci
    FROM mehsullar m
    LEFT JOIN stok_cem  s   ON s.mehsul_id  = m.id
    LEFT JOIN satis_7   s7  ON s7.mehsul_id = m.id
    LEFT JOIN satis_30  s30 ON s30.mehsul_id = m.id
    LEFT JOIN son_alis  sa  ON sa.mehsul_id = m.id
    WHERE m.sahibkar_id = ${sahibkarId}::uuid
      AND m.aktiv = TRUE
  `;

  type RecCalc = {
    mehsul_id: string;
    cari_stok: number;
    son_7: number;
    son_30: number;
    orta_gunluk: number;
    bitme_gun: number;
    tovsiye_say: number;
    son_alish_qiy: number;
    techizatci_id: string | null;
    prioritet: "kritik" | "xeber" | "normal";
  };

  const recommendations: RecCalc[] = [];
  for (const r of rows) {
    const ortaGunluk = r.son_30 > 0 ? r.son_30 / 30 : (r.son_7 > 0 ? r.son_7 / 7 : 0);
    const bitmeGun = ortaGunluk > 0 ? r.cari_stok / ortaGunluk : 9999;
    const lowStock = r.kritik_stok > 0 && r.cari_stok <= r.kritik_stok;
    const willRunOut = ortaGunluk > 0 && bitmeGun <= HORIZON_GUN;
    if (!lowStock && !willRunOut) continue;
    const leadDemand = ortaGunluk * LEAD_TIME_GUN;
    const buffer = Math.max(r.kritik_stok * 2, ortaGunluk * 3);
    const tovsiyeSay = Math.max(0, leadDemand + buffer - r.cari_stok);
    if (tovsiyeSay <= 0) continue;
    const prioritet: RecCalc["prioritet"] =
      bitmeGun <= 7 || (r.kritik_stok > 0 && r.cari_stok < r.kritik_stok * 0.5)
        ? "kritik"
        : bitmeGun <= 14 ? "xeber" : "normal";
    recommendations.push({
      mehsul_id: r.mehsul_id,
      cari_stok: r.cari_stok,
      son_7: r.son_7,
      son_30: r.son_30,
      orta_gunluk: Math.round(ortaGunluk * 100) / 100,
      bitme_gun: Math.round(bitmeGun),
      tovsiye_say: Math.ceil(tovsiyeSay),
      son_alish_qiy: r.alish_qiymeti,
      techizatci_id: r.son_techizatci,
      prioritet,
    });
  }

  // QA-audit: cron ilə eyni — advisory xact-lock + delete+create ATOMİK (skipDuplicates unique-constraint
  // olmadan effektsizdir; paralel recompute ikili tövsiyə yaradırdı).
  let created = 0;
  let removed = 0;
  await prismaUnscoped.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sahibkarId + ":reorder"}))`;
    const removeResult = await tx.satinalma_tovsiye.deleteMany({ where: { sahibkar_id: sahibkarId, alis_yaradildi: false } });
    removed = removeResult.count;
    if (recommendations.length > 0) {
      const createResult = await tx.satinalma_tovsiye.createMany({
        data: recommendations.map((r) => ({
          sahibkar_id: sahibkarId,
          mehsul_id: r.mehsul_id,
          cari_stok: r.cari_stok,
          son_7_satish: r.son_7,
          son_30_satish: r.son_30,
          orta_gunluk: r.orta_gunluk,
          bitme_gun: r.bitme_gun,
          tovsiye_say: r.tovsiye_say,
          son_alish_qiy: r.son_alish_qiy,
          techizatci_id: r.techizatci_id,
          prioritet: r.prioritet,
          durum: "yeni",
          alis_yaradildi: false,
          hesablandi: new Date(),
        })),
        skipDuplicates: true,
      });
      created = createResult.count;
    }
  });

  // QA-roadmap #5: kritik reorder məhsulları üçün proaktiv xülasə alert (cron ilə eyni məntiq).
  const { upsertReorderAlert } = await import("./reorder-alert");
  await upsertReorderAlert(sahibkarId, recommendations.filter((r) => r.prioritet === "kritik").map((r) => r.mehsul_id));

  return { created, removed };
}
