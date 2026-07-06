import "server-only";
import { unstable_cache } from "next/cache";
import { prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Məhsul siyahısının yuxarısında göstərilən "Problemli məhsullar" kartları
 * üçün toplu statistika. Bütün sayğaclar tek round-trip-də çəkilir.
 */

export type ProductProblemStats = {
  stokda_var: number;
  stoksuz: number;
  az_qalib: number;        // < kritik_stok amma > 0
  kritik: number;          // kritik_stok aşılıb
  rezervde: number;        // bron > 0
  sekilsiz: number;
  qiymetsiz: number;
  barkodsuz: number;
  kateqoriyasiz: number;
  dublikat_barkod: number;
  yatmis_90: number;       // 90 gündən satılmamış
  toplam_aktiv: number;
};

export async function getProductProblemStats(): Promise<ProductProblemStats> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    // QA-perf: 12-metrik məhsul-problem aqreqatı (CTE-lər) hər səhifə yükündə işləyirdi → cache 60s.
    const rows = await unstable_cache(() => prismaUnscoped.$queryRaw<
      Array<{
        stokda_var: bigint;
        stoksuz: bigint;
        az_qalib: bigint;
        kritik: bigint;
        rezervde: bigint;
        sekilsiz: bigint;
        qiymetsiz: bigint;
        barkodsuz: bigint;
        kateqoriyasiz: bigint;
        dublikat_barkod: bigint;
        yatmis_90: bigint;
        toplam_aktiv: bigint;
      }>
    >`
      WITH stoklar AS (
        SELECT s.mehsul_id,
               COALESCE(SUM(s.miqdar), 0)::numeric AS toplam
        FROM stok s
        WHERE s.sahibkar_id = ${sahibkarId}::uuid
        GROUP BY s.mehsul_id
      ),
      bronlar AS (
        SELECT sb.mehsul_id, COALESCE(SUM(sb.sayi), 0)::numeric AS toplam
        FROM stok_bron sb
        WHERE sb.sahibkar_id = ${sahibkarId}::uuid
          AND sb.status = 'aktiv'
          AND (sb.bitme_tarixi IS NULL OR sb.bitme_tarixi >= CURRENT_DATE)
        GROUP BY sb.mehsul_id
      ),
      duplicate_barkod AS (
        SELECT m.id
        FROM mehsullar m
        WHERE m.sahibkar_id = ${sahibkarId}::uuid
          AND m.aktiv = TRUE
          AND m.deleted_at IS NULL
          AND m.barkod IS NOT NULL AND m.barkod <> ''
          AND EXISTS (
            SELECT 1 FROM mehsullar m2
            WHERE m2.sahibkar_id = m.sahibkar_id
              AND m2.id <> m.id
              AND m2.barkod = m.barkod
              AND m2.aktiv = TRUE
              AND m2.deleted_at IS NULL
          )
      )
      SELECT
        COUNT(*) FILTER (WHERE COALESCE(stk.toplam, 0) > 0)::bigint                       AS stokda_var,
        COUNT(*) FILTER (WHERE COALESCE(stk.toplam, 0) <= 0)::bigint                      AS stoksuz,
        COUNT(*) FILTER (WHERE m.kritik_stok IS NOT NULL AND m.kritik_stok > 0
                             AND COALESCE(stk.toplam, 0) > 0
                             AND COALESCE(stk.toplam, 0) <= m.kritik_stok)::bigint        AS az_qalib,
        COUNT(*) FILTER (WHERE m.kritik_stok IS NOT NULL
                             AND COALESCE(stk.toplam, 0) <= m.kritik_stok)::bigint        AS kritik,
        COUNT(*) FILTER (WHERE COALESCE(br.toplam, 0) > 0)::bigint                        AS rezervde,
        COUNT(*) FILTER (WHERE m.sekil_url IS NULL OR m.sekil_url = '')::bigint           AS sekilsiz,
        COUNT(*) FILTER (WHERE COALESCE(m.satis_qiymeti, 0) = 0)::bigint                  AS qiymetsiz,
        COUNT(*) FILTER (WHERE (m.barkod IS NULL OR m.barkod = '')
                          AND NOT EXISTS (SELECT 1 FROM mehsul_barkodlar WHERE mehsul_id = m.id))::bigint  AS barkodsuz,
        COUNT(*) FILTER (WHERE m.kateqoriya_id IS NULL)::bigint                           AS kateqoriyasiz,
        COUNT(*) FILTER (WHERE m.id IN (SELECT id FROM duplicate_barkod))::bigint         AS dublikat_barkod,
        COUNT(*) FILTER (WHERE COALESCE(stk.toplam, 0) > 0
                            AND (m.son_satis_de IS NULL OR m.son_satis_de < NOW() - INTERVAL '90 days'))::bigint AS yatmis_90,
        COUNT(*)::bigint                                                                  AS toplam_aktiv
      FROM mehsullar m
      LEFT JOIN stoklar stk ON stk.mehsul_id = m.id
      LEFT JOIN bronlar  br  ON br.mehsul_id  = m.id
      WHERE m.sahibkar_id = ${sahibkarId}::uuid
        AND m.aktiv = TRUE
        AND m.deleted_at IS NULL
    `,
      ["product-problem-stats", sahibkarId],
      { revalidate: 60, tags: [`stok:${sahibkarId}`] },
    )();
    const r = rows[0];
    if (!r) {
      return {
        stokda_var: 0, stoksuz: 0, az_qalib: 0, kritik: 0, rezervde: 0,
        sekilsiz: 0, qiymetsiz: 0, barkodsuz: 0, kateqoriyasiz: 0,
        dublikat_barkod: 0, yatmis_90: 0, toplam_aktiv: 0,
      };
    }
    return {
      stokda_var: Number(r.stokda_var),
      stoksuz: Number(r.stoksuz),
      az_qalib: Number(r.az_qalib),
      kritik: Number(r.kritik),
      rezervde: Number(r.rezervde),
      sekilsiz: Number(r.sekilsiz),
      qiymetsiz: Number(r.qiymetsiz),
      barkodsuz: Number(r.barkodsuz),
      kateqoriyasiz: Number(r.kateqoriyasiz),
      dublikat_barkod: Number(r.dublikat_barkod),
      yatmis_90: Number(r.yatmis_90),
      toplam_aktiv: Number(r.toplam_aktiv),
    };
  });
}
