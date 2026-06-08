import "server-only";
import { Prisma, prisma } from "@/lib/db/prisma";

/**
 * Müştəri borcu üçün VAHID HƏQİQƏT MƏNBƏYİ (Single Source of Truth).
 *
 * Bütün modullar (debitor siyahısı, müştəri detalı, dashboard, customer 360,
 * borcdan ödəniş modalı, ticarət hesabatı) BURADAN istifadə etməlidir.
 *
 * `kontragentler.alacaq` field-i artıq əsas mənbə DEYİL — yalnız performans
 * üçün cache. Hər mutate-dan sonra `recalculateCustomerBalance()` çağırılır.
 *
 * MƏNTİQ:
 *   alacaq = SUM (nisyə aktiv satışların qalığı)
 *          + SUM (servis qeydlərində ödənilməmiş qalıq)
 *          - avans ödənişlər (gələcəkdə qaimələrə bağlanmamış kassaya gəlmiş pul)
 *
 *  Burada YALNIZ aktiv satışlar nəzərə alınır:
 *   - `status != 'legv'`
 *   - `qaralama != true`
 *   - `odenis_nov IN ('nisye', 'borc')` (köhnə 'borc' enum dəyəri də saxlanılır)
 *
 *  Servis qeydləri üçün:
 *   - `deleted_at IS NULL`
 *   - `status != 'legv'`
 *   - qalıq = GREATEST(temir_xerci - musteriden_alinan, 0)
 */

export type CustomerBalanceBreakdown = {
  /** Müştərinin bizə qalan ümumi borcu (AZN, müsbət ədəd) */
  alacaq: number;
  /** Aktiv nisyə satışların orijinal məbləği */
  satis_cemi: number;
  /** Aktiv satışlara ödənilmiş cəmi */
  odenilmis_cemi: number;
  /** Avans (müştəridən gələn, hələ qaiməyə bağlanmamış pul — gələcəkdə) */
  avans: number;
  /** Aktiv açıq qaimə sayı */
  acik_qaime_sayi: number;
};

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Müştəri borc balansını HESABLA — satış cədvəlindən real-time aggregate.
 *
 * Heç bir yan təsir yox — yalnız hesablayır. DB-də `kontragentler.alacaq`
 * field-i ilə fərqli ola bilər (drift göstərici).
 */
export async function calculateCustomerBalance(
  customerId: string,
  tx: TxClient = prisma,
): Promise<CustomerBalanceBreakdown> {
  const rows = await tx.$queryRaw<
    Array<{
      satis_cemi: number;
      odenilmis_cemi: number;
      acik_qaime_sayi: bigint;
    }>
  >`
    SELECT
      COALESCE(SUM(s.son_mebleg), 0)::float        AS satis_cemi,
      COALESCE(SUM(s.odenilmis), 0)::float          AS odenilmis_cemi,
      COUNT(*) FILTER (
        WHERE s.son_mebleg > COALESCE(s.odenilmis, 0) + 0.001
      )::bigint                                     AS acik_qaime_sayi
    FROM satis_sifarisleri s
    WHERE s.musteri_id = ${customerId}::uuid
      AND s.deleted_at IS NULL
      AND s.status NOT IN ('legv', 'qaytarilib')
      AND (s.qaralama IS NULL OR s.qaralama = FALSE)
      AND s.odenis_nov IN ('nisye', 'borc')
  `;

  const servisRows = await tx.$queryRaw<
    Array<{ servis_borc: number; acik_servis_sayi: bigint }>
  >`
    SELECT
      COALESCE(SUM(GREATEST(COALESCE(temir_xerci, 0) - COALESCE(musteriden_alinan, 0), 0)), 0)::float AS servis_borc,
      COUNT(*) FILTER (
        WHERE COALESCE(temir_xerci, 0) > COALESCE(musteriden_alinan, 0) + 0.001
      )::bigint AS acik_servis_sayi
    FROM servis_qeydleri
    WHERE musteri_id = ${customerId}::uuid
      AND deleted_at IS NULL
      AND status NOT IN ('redd_edildi')
  `;

  const r = rows[0] ?? { satis_cemi: 0, odenilmis_cemi: 0, acik_qaime_sayi: 0n };
  const sr = servisRows[0] ?? { servis_borc: 0, acik_servis_sayi: 0n };
  const satisCemi = Number(r.satis_cemi ?? 0);
  const odenilmis = Number(r.odenilmis_cemi ?? 0);
  const servisBorc = Number(sr.servis_borc ?? 0);
  // İndilik avans ayrı saxlanmır — gələcəkdə `musteri_avans` cədvəli əlavə oluna bilər.
  const avans = 0;
  const acik = Number(r.acik_qaime_sayi ?? 0) + Number(sr.acik_servis_sayi ?? 0);

  // Müsbət dəyər = müştərinin bizə borcu. Mənfi olarsa (ödənilmiş > satış) → avans.
  const xalisBorc = Math.max(0, satisCemi - odenilmis + servisBorc - avans);

  return {
    alacaq: Math.round(xalisBorc * 100) / 100,
    satis_cemi: Math.round(satisCemi * 100) / 100,
    odenilmis_cemi: Math.round(odenilmis * 100) / 100,
    avans,
    acik_qaime_sayi: acik,
  };
}

/**
 * Müştəri balansını yenidən hesabla VƏ `kontragentler.alacaq` field-inə yaz.
 *
 * Bütün satış/ödəniş/qaytarma/silmə əməliyyatlarından sonra çağırılmalıdır.
 * Transaksiya daxilində istifadə etmək tövsiyə olunur (atomic).
 *
 * Qaytarır: yeni hesablanmış balans + əvvəlki ilə fərq (drift).
 */
export async function recalculateCustomerBalance(
  customerId: string,
  tx: TxClient = prisma,
): Promise<{ ok: true; balance: CustomerBalanceBreakdown; drift: number } | { ok: false; error: string }> {
  if (!customerId) return { ok: false, error: "customerId boşdur" };

  try {
    const before = await tx.kontragentler.findUnique({
      where: { id: customerId },
      select: { sahibkar_id: true, alacaq: true },
    });
    if (!before) return { ok: false, error: "Müştəri tapılmadı" };

    const balance = await calculateCustomerBalance(customerId, tx);
    const prevAlacaq = Number(before.alacaq ?? 0);
    const drift = balance.alacaq - prevAlacaq;

    await tx.kontragentler.update({
      where: { id: customerId },
      data: {
        alacaq: new Prisma.Decimal(balance.alacaq.toFixed(2)),
        yenilendi: new Date(),
      },
    });

    return { ok: true, balance, drift };
  } catch (e) {
    console.error("[recalculateCustomerBalance]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Hesablama alınmadı" };
  }
}

/**
 * Toplu recalc — sahibkar daxilindəki bütün müştərilərin balansını yenidən hesabla.
 *
 * Admin və ya gecə cron-u üçün. Performansı qorumaq üçün batches-də işləyir.
 */
export async function recalculateAllCustomerBalances(
  sahibkarId: string,
): Promise<{ ok: true; updated: number; drift_total: number; max_drift: number } | { ok: false; error: string }> {
  try {
    // Müştərilərin balansını birdəfəlik raw SQL ilə yenilə — N+1 problemini önləmək üçün.
    const result = await prisma.$queryRaw<
      Array<{ updated: bigint; drift_total: number; max_drift: number }>
    >`
      WITH satis_agg AS (
        SELECT
          k.id AS kontragent_id,
          COALESCE(SUM(s.son_mebleg - COALESCE(s.odenilmis, 0)) FILTER (
            WHERE s.deleted_at IS NULL
              AND s.status NOT IN ('legv', 'qaytarilib')
              AND (s.qaralama IS NULL OR s.qaralama = FALSE)
              AND s.odenis_nov IN ('nisye', 'borc')
          ), 0)::numeric AS satis_qaliq
        FROM kontragentler k
        LEFT JOIN satis_sifarisleri s ON s.musteri_id = k.id
        WHERE k.sahibkar_id = ${sahibkarId}::uuid
          AND k.nov IN ('musteri', 'her_ikisi')
        GROUP BY k.id
      ),
      servis_agg AS (
        SELECT
          k.id AS kontragent_id,
          COALESCE(SUM(GREATEST(COALESCE(sv.temir_xerci, 0) - COALESCE(sv.musteriden_alinan, 0), 0)) FILTER (
            WHERE sv.deleted_at IS NULL
              AND sv.status NOT IN ('redd_edildi')
          ), 0)::numeric AS servis_qaliq
        FROM kontragentler k
        LEFT JOIN servis_qeydleri sv ON sv.musteri_id = k.id
        WHERE k.sahibkar_id = ${sahibkarId}::uuid
          AND k.nov IN ('musteri', 'her_ikisi')
        GROUP BY k.id
      ),
      calculated AS (
        SELECT
          k.id,
          COALESCE(k.alacaq, 0)::numeric AS old_alacaq,
          GREATEST(0, COALESCE(sa.satis_qaliq, 0) + COALESCE(sv.servis_qaliq, 0)) AS new_alacaq
        FROM kontragentler k
        LEFT JOIN satis_agg sa ON sa.kontragent_id = k.id
        LEFT JOIN servis_agg sv ON sv.kontragent_id = k.id
        WHERE k.sahibkar_id = ${sahibkarId}::uuid
          AND k.nov IN ('musteri', 'her_ikisi')
      ),
      updated AS (
        UPDATE kontragentler k
        SET alacaq = ROUND(c.new_alacaq, 2), yenilendi = NOW()
        FROM calculated c
        WHERE k.id = c.id
          AND ABS(c.new_alacaq - c.old_alacaq) > 0.001
        RETURNING k.id, (c.new_alacaq - c.old_alacaq) AS drift
      )
      SELECT
        COUNT(*)::bigint AS updated,
        COALESCE(SUM(ABS(drift)), 0)::float AS drift_total,
        COALESCE(MAX(ABS(drift)), 0)::float AS max_drift
      FROM updated
    `;

    const r = result[0] ?? { updated: 0n, drift_total: 0, max_drift: 0 };
    return {
      ok: true,
      updated: Number(r.updated),
      drift_total: Number(r.drift_total),
      max_drift: Number(r.max_drift),
    };
  } catch (e) {
    console.error("[recalculateAllCustomerBalances]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Toplu hesablama alınmadı" };
  }
}
