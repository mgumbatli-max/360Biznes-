import "server-only";
import { Prisma, prisma } from "@/lib/db/prisma";

/**
 * Məhsul stoku üçün VAHID HƏQİQƏT MƏNBƏYİ.
 *
 * `stok` cədvəli rezident dəyəri saxlayır. Bu funksiya `anbar_hereketleri`
 * cədvəlindən hesablayır ki, drift yoxdursa təsdiq etsin.
 *
 * Drift detection və admin reconcile üçün istifadə.
 */

type TxClient = Prisma.TransactionClient | typeof prisma;

export type ProductStockBreakdown = {
  /** stok cədvəlində mövcud (cache) */
  cache_miqdar: number;
  /** anbar_hereketleri-dən hesablanmış (source-of-truth) */
  hereket_miqdar: number;
  /** rezerv (aktiv və müddəti keçməmiş bron) */
  rezerv: number;
  /** satıla bilən = cache - rezerv */
  satilabilen: number;
  /** drift = cache - hereket */
  drift: number;
};

export async function calculateProductStock(
  mehsulId: string,
  anbarId: number,
  sahibkarId: string,
  tx: TxClient = prisma,
): Promise<ProductStockBreakdown> {
  const rows = await tx.$queryRaw<
    Array<{
      cache_miqdar: number;
      hereket_miqdar: number;
      rezerv: number;
    }>
  >`
    SELECT
      COALESCE((
        SELECT miqdar FROM stok
         WHERE mehsul_id = ${mehsulId}::uuid
           AND anbar_id = ${anbarId}
           AND sahibkar_id = ${sahibkarId}::uuid
      ), 0)::float AS cache_miqdar,
      COALESCE((
        SELECT SUM(
          CASE
            -- POZİTİV (anbarın stoku artır)
            WHEN nov IN (
              'medaxil',
              'transfer_giris',
              'defekt_giris',
              'qaytarma_qebul',
              'qaytarma_sifarisi',
              'qaytarma_tez',
              'servis_iade',
              'inventar_artim'
            ) THEN miqdar
            -- NEQATIV (anbarın stoku azalır)
            WHEN nov IN (
              'mexaric',
              'transfer_cixis',
              'transfer_qismi',
              'defekt_cixis',
              'servis_mexaric',
              'servis_mexaric_stoxsuz',
              'konsiqnasiya_mexaric',
              'inventar_azalma'
            ) THEN -miqdar
            -- NEYTRAL (yalnız izləmə üçün, stoku dəyişmir)
            -- 'servis_freeze' — servisə alındı, stok eyni qalır
            ELSE 0
          END
        )
        FROM anbar_hereketleri
        WHERE mehsul_id = ${mehsulId}::uuid
          AND anbar_id = ${anbarId}
          AND sahibkar_id = ${sahibkarId}::uuid
      ), 0)::float AS hereket_miqdar,
      COALESCE((
        SELECT SUM(sayi) FROM stok_bron
         WHERE mehsul_id = ${mehsulId}::uuid
           AND anbar_id = ${anbarId}
           AND sahibkar_id = ${sahibkarId}::uuid
           AND status = 'aktiv'
           AND (bitme_tarixi IS NULL OR bitme_tarixi >= CURRENT_DATE)
      ), 0)::float AS rezerv
  `;
  const r = rows[0] ?? { cache_miqdar: 0, hereket_miqdar: 0, rezerv: 0 };
  const cache = Math.round(Number(r.cache_miqdar) * 1000) / 1000;
  const hereket = Math.round(Number(r.hereket_miqdar) * 1000) / 1000;
  const rezerv = Math.round(Number(r.rezerv) * 1000) / 1000;
  return {
    cache_miqdar: cache,
    hereket_miqdar: hereket,
    rezerv,
    satilabilen: Math.max(0, cache - rezerv),
    drift: cache - hereket,
  };
}

/**
 * Bütün məhsul/anbar cüt-lərində drift skanı.
 * Audit/reconcile üçün.
 */
export async function scanStockDrift(sahibkarId: string): Promise<{
  total_pairs: number;
  drifted_pairs: number;
  max_drift: number;
  total_drift_abs: number;
}> {
  const rows = await prisma.$queryRaw<
    Array<{
      total_pairs: bigint;
      drifted_pairs: bigint;
      max_drift: number;
      total_drift_abs: number;
    }>
  >`
    WITH ledger AS (
      SELECT mehsul_id, anbar_id,
        SUM(CASE
          WHEN nov IN (
            'medaxil','transfer_giris','defekt_giris',
            'qaytarma_qebul','qaytarma_sifarisi','qaytarma_tez',
            'servis_iade','inventar_artim'
          ) THEN miqdar
          WHEN nov IN (
            'mexaric','transfer_cixis','transfer_qismi','defekt_cixis',
            'servis_mexaric','servis_mexaric_stoxsuz','konsiqnasiya_mexaric',
            'inventar_azalma'
          ) THEN -miqdar
          ELSE 0
        END) AS hereket_miqdar
      FROM anbar_hereketleri
      WHERE sahibkar_id = ${sahibkarId}::uuid
      GROUP BY mehsul_id, anbar_id
    ),
    pairs AS (
      SELECT s.mehsul_id, s.anbar_id,
        COALESCE(s.miqdar, 0)::float AS cache,
        COALESCE(l.hereket_miqdar, 0)::float AS hereket,
        (COALESCE(s.miqdar, 0) - COALESCE(l.hereket_miqdar, 0))::float AS drift
      FROM stok s
      LEFT JOIN ledger l ON l.mehsul_id = s.mehsul_id AND l.anbar_id = s.anbar_id
      WHERE s.sahibkar_id = ${sahibkarId}::uuid
    )
    SELECT
      COUNT(*)::bigint AS total_pairs,
      COUNT(*) FILTER (WHERE ABS(drift) > 0.001)::bigint AS drifted_pairs,
      COALESCE(MAX(ABS(drift)), 0)::float AS max_drift,
      COALESCE(SUM(ABS(drift)), 0)::float AS total_drift_abs
    FROM pairs
  `;
  const r = rows[0] ?? {
    total_pairs: 0n, drifted_pairs: 0n, max_drift: 0, total_drift_abs: 0,
  };
  return {
    total_pairs: Number(r.total_pairs),
    drifted_pairs: Number(r.drifted_pairs),
    max_drift: Number(r.max_drift),
    total_drift_abs: Number(r.total_drift_abs),
  };
}
