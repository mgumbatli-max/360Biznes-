import { NextResponse, type NextRequest } from "next/server";
import { prismaUnscoped } from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant-context";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 dəq — bütün tenant + məhsullar üçün

/**
 * Avto-reorder cron: hər tenant üçün min_stok altına düşmüş və ya satış
 * tempinə görə tezliklə bitəcək məhsulları `satinalma_tovsiye` cədvəlinə salır.
 *
 * Tövsiyələr hər tenant başına yenilənir (silinmir — `alis_yaradildi=false`
 * olan köhnə tövsiyələr yenilərlə əvəzlənir):
 *  - cari_stok = anbarlar üzrə cəm
 *  - son_7_satish, son_30_satish — satılmış miqdar
 *  - orta_gunluk = son_30_satish / 30
 *  - bitme_gun = cari_stok / orta_gunluk
 *  - tovsiye_say = orta_gunluk × LEAD_TIME_GUN + buffer (min_stok × 2)
 *  - prioritet = kritik (≤7 gün) / xeber (≤14) / normal (>14)
 *
 * Tetik şərti (ən az biri):
 *  - cari_stok ≤ min_stok (kritik)
 *  - bitme_gun ≤ 21 (satış tempinə görə qısa zamanda bitəcək)
 *
 * Tenancy: `runWithTenant` ilə hər tenant öz konteksti içində icra olunur.
 * Schedule: gündə bir dəfə (vercel.json-da `0 3 * * *` — gecə 03:00).
 */
const LEAD_TIME_GUN = 7; // standart təchizat müddəti — sahibkar settings-də override edə bilər (gələcəkdə)
const HORIZON_GUN = 21; // bu gün sayında bitəcək məhsullar tövsiyəyə düşür

export async function GET(req: NextRequest) {
  // 🔒 Fail-CLOSED (audit #4) — CRON_SECRET yoxdursa/yanlışdırsa rədd et.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();

  // Aktiv sahibkarları çək (status="aktiv")
  const tenants = await prismaUnscoped.sahibkarlar.findMany({
    where: { status: "aktiv" },
    select: { id: true, ad: true },
  });

  let totalRecs = 0;
  let totalUpdated = 0;
  let totalRemoved = 0;
  const errors: { tenantId: string; error: string }[] = [];

  for (const tenant of tenants) {
    // Hər tenant üçün sistem istifadəçisi (audit FK üçün)
    const systemUser = await prismaUnscoped.istifadeciler.findFirst({
      where: { sahibkar_id: tenant.id, aktiv: true },
      orderBy: [{ rol_id: "asc" }],
      select: { id: true, rol_id: true, roles: { select: { ad: true } } },
    });
    if (!systemUser) continue;

    try {
      const result = await runWithTenant(
        {
          sahibkarId: tenant.id,
          istifadeciId: systemUser.id,
          rolId: systemUser.rol_id ?? 0,
          rolAd: systemUser.roles?.ad,
          icazeler: [],
        },
        () => computeForTenant(tenant.id),
      );
      totalRecs += result.created;
      totalUpdated += result.updated;
      totalRemoved += result.removed;
    } catch (e) {
      errors.push({
        tenantId: tenant.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    tenants: tenants.length,
    created: totalRecs,
    updated: totalUpdated,
    removed: totalRemoved,
    errors: errors.slice(0, 10),
    elapsed_ms: Date.now() - t0,
  });
}

/**
 * Bir sahibkar üçün tövsiyələri hesabla.
 * Raw SQL aggregate ilə bir DB roundtrip-də stok + satış statistikası alınır.
 */
async function computeForTenant(sahibkarId: string): Promise<{ created: number; updated: number; removed: number }> {
  // Hər aktiv məhsul üçün:
  //  - cari stok cəmi
  //  - son 7 / 30 günün satış miqdarı (satis_sifaris_satirlari × tarix filter)
  //  - mehsul.kritik_stok (min stok)
  //  - mehsul.alish_qiymeti (son maya - approximate)
  //  - son təchizatçı: ən son `alis_sifarisleri` ilə bağlı məhsul → kontragent
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

  // Hansı məhsullar tövsiyəyə düşür?
  type RecommendationCalc = {
    mehsul_id: string;
    cari_stok: number;
    son_7: number;
    son_30: number;
    orta_gunluk: number;
    bitme_gun: number; // 9999 = praktiki olaraq bitməz
    tovsiye_say: number;
    son_alish_qiy: number;
    techizatci_id: string | null;
    prioritet: "kritik" | "xeber" | "normal";
  };

  const recommendations: RecommendationCalc[] = [];
  for (const r of rows) {
    const ortaGunluk = r.son_30 > 0 ? r.son_30 / 30 : (r.son_7 > 0 ? r.son_7 / 7 : 0);
    const bitmeGun = ortaGunluk > 0 ? r.cari_stok / ortaGunluk : 9999;
    const lowStock = r.kritik_stok > 0 && r.cari_stok <= r.kritik_stok;
    const willRunOut = ortaGunluk > 0 && bitmeGun <= HORIZON_GUN;
    if (!lowStock && !willRunOut) continue;

    // Tövsiyə miqdarı: lead_time müddətinə uyğun + min_stok buffer
    const leadDemand = ortaGunluk * LEAD_TIME_GUN;
    const buffer = Math.max(r.kritik_stok * 2, ortaGunluk * 3);
    const tovsiyeSay = Math.max(0, leadDemand + buffer - r.cari_stok);
    if (tovsiyeSay <= 0) continue;

    const prioritet: RecommendationCalc["prioritet"] =
      bitmeGun <= 7 || (r.kritik_stok > 0 && r.cari_stok < r.kritik_stok * 0.5)
        ? "kritik"
        : bitmeGun <= 14
          ? "xeber"
          : "normal";

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

  // Mövcud tövsiyələri yenilə / sil:
  //  - alis_yaradildi=true olanları toxunma
  //  - alis_yaradildi=false olanları sil (yenisi yaranacaq)
  const removeResult = await prismaUnscoped.satinalma_tovsiye.deleteMany({
    where: {
      sahibkar_id: sahibkarId,
      alis_yaradildi: false,
    },
  });

  let created = 0;
  let updated = 0;
  if (recommendations.length > 0) {
    const createResult = await prismaUnscoped.satinalma_tovsiye.createMany({
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

  return { created, updated, removed: removeResult.count };
}
