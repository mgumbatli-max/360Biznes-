import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type CategoryReport = {
  id: number;
  ad: string;
  mehsul_say: number;
  stok: number;
  satis_deyer: number;
  maya_deyer: number;
};

export async function getCategoryReport(): Promise<CategoryReport[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<
      { id: number; ad: string; mehsul_say: bigint; stok: number; satis_deyer: number; maya_deyer: number }[]
    >`
      SELECT k.id, k.ad,
             COUNT(DISTINCT m.id)::bigint AS mehsul_say,
             COALESCE(SUM(s.miqdar), 0)::float AS stok,
             COALESCE(SUM(s.miqdar * COALESCE(m.satis_qiymeti, 0)), 0)::float AS satis_deyer,
             COALESCE(SUM(s.miqdar * COALESCE(s.son_qiymet, m.alish_qiymeti, 0)), 0)::float AS maya_deyer
        FROM kateqoriyalar k
        LEFT JOIN mehsullar m ON m.kateqoriya_id = k.id
        LEFT JOIN stok s ON s.mehsul_id = m.id AND s.sahibkar_id = m.sahibkar_id
       WHERE k.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
       GROUP BY k.id, k.ad
       ORDER BY satis_deyer DESC
    `;
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      mehsul_say: Number(r.mehsul_say),
      stok: Number(r.stok),
      satis_deyer: Number(r.satis_deyer),
      maya_deyer: Number(r.maya_deyer),
    }));
  });
}

export type AgingReport = {
  son_30: number;
  yaslanmis_30_60: number;
  yaslanmis_60_90: number;
  yaslanmis_90: number;
  olu_maya: number;
};

export async function getAgingReport(): Promise<AgingReport> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<
      { son_30: bigint; y30_60: bigint; y60_90: bigint; y90: bigint; olu_maya: number }[]
    >`
      WITH mh AS (
        SELECT m.id,
               EXTRACT(EPOCH FROM (NOW() - COALESCE(m.son_satis_de, m.yaradildi))) / 86400 AS gun,
               COALESCE(SUM(s.miqdar * COALESCE(s.son_qiymet, m.alish_qiymeti, 0)), 0) AS maya
          FROM mehsullar m
          LEFT JOIN stok s ON s.mehsul_id = m.id AND s.sahibkar_id = m.sahibkar_id
         WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
         GROUP BY m.id, m.son_satis_de, m.yaradildi
        HAVING COALESCE(SUM(s.miqdar), 0) > 0
      )
      SELECT COUNT(*) FILTER (WHERE gun <= 30) AS son_30,
             COUNT(*) FILTER (WHERE gun > 30 AND gun <= 60) AS y30_60,
             COUNT(*) FILTER (WHERE gun > 60 AND gun <= 90) AS y60_90,
             COUNT(*) FILTER (WHERE gun > 90) AS y90,
             COALESCE(SUM(maya) FILTER (WHERE gun > 90), 0)::float AS olu_maya
        FROM mh
    `;
    const r = rows[0];
    return {
      son_30: Number(r?.son_30 ?? 0),
      yaslanmis_30_60: Number(r?.y30_60 ?? 0),
      yaslanmis_60_90: Number(r?.y60_90 ?? 0),
      yaslanmis_90: Number(r?.y90 ?? 0),
      olu_maya: Number(r?.olu_maya ?? 0),
    };
  });
}

export type ProblemKind =
  | "stokda" | "stoksuz" | "az_stok" | "kritik"
  | "satilmayan_60" | "olu_stok"
  | "sekilsiz" | "barkodsuz" | "mayasiz" | "qiymetsiz";

export type ProblemRow = {
  id: string;
  ad: string;
  kod: string | null;
  barkod: string | null;
  marka: string | null;
  stok: number;
  satis_qiymeti: number | null;
  dondurulan_maya: number;
  kritik_stok: number | null;
  min_stok: number | null;
  son_satis: Date | null;
  gun_evvel: number | null;
  sekil_url: string | null;
};

export type ProblemFilter = {
  q?: string;
  kateqId?: number;
  markaId?: number;
  sirala?: "ad" | "stok_az" | "stok_cox" | "maya_cox" | "";
};

export async function getProblemReport(tip: ProblemKind, filter: ProblemFilter = {}): Promise<ProblemRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    let typeFilter = "";
    switch (tip) {
      case "stokda":         typeFilter = "COALESCE(stok_sum.miqdar, 0) > 0"; break;
      case "stoksuz":        typeFilter = "COALESCE(stok_sum.miqdar, 0) <= 0"; break;
      case "az_stok":        typeFilter = "m.kritik_stok IS NOT NULL AND m.kritik_stok > 0 AND COALESCE(stok_sum.miqdar,0) > 0 AND COALESCE(stok_sum.miqdar,0) <= m.kritik_stok"; break;
      case "kritik":         typeFilter = "m.kritik_stok IS NOT NULL AND COALESCE(stok_sum.miqdar,0) > 0 AND COALESCE(stok_sum.miqdar,0) <= m.kritik_stok"; break;
      case "satilmayan_60":  typeFilter = "COALESCE(stok_sum.miqdar,0) > 0 AND (m.son_satis_de IS NULL OR m.son_satis_de < NOW() - INTERVAL '60 days')"; break;
      case "olu_stok":       typeFilter = "COALESCE(stok_sum.miqdar,0) > 0 AND (m.son_satis_de IS NULL OR m.son_satis_de < NOW() - INTERVAL '90 days')"; break;
      case "sekilsiz":       typeFilter = "m.sekil_url IS NULL OR m.sekil_url = ''"; break;
      case "barkodsuz":      typeFilter = "m.barkod IS NULL AND NOT EXISTS (SELECT 1 FROM mehsul_barkodlar WHERE mehsul_id = m.id)"; break;
      case "mayasiz":        typeFilter = "(m.alish_qiymeti IS NULL OR m.alish_qiymeti = 0)"; break;
      case "qiymetsiz":      typeFilter = "(m.satis_qiymeti IS NULL OR m.satis_qiymeti = 0)"; break;
    }

    // Build extra WHERE pieces with parameter bindings
    const params: unknown[] = [sahibkarId];
    const extra: string[] = [];
    if (filter.q && filter.q.trim()) {
      params.push(`%${filter.q.trim()}%`);
      const i = params.length;
      extra.push(`(m.ad ILIKE $${i} OR m.kod ILIKE $${i} OR m.barkod ILIKE $${i} OR br.ad ILIKE $${i} OR k.ad ILIKE $${i})`);
    }
    if (filter.kateqId) {
      params.push(filter.kateqId);
      extra.push(`m.kateqoriya_id = $${params.length}`);
    }
    if (filter.markaId) {
      params.push(filter.markaId);
      extra.push(`m.marka_id = $${params.length}`);
    }

    let orderBy = "dondurulan_maya DESC NULLS LAST, m.ad";
    switch (filter.sirala) {
      case "ad":       orderBy = "m.ad ASC"; break;
      case "stok_az":  orderBy = "stok ASC NULLS LAST, m.ad"; break;
      case "stok_cox": orderBy = "stok DESC NULLS LAST, m.ad"; break;
      case "maya_cox": orderBy = "dondurulan_maya DESC NULLS LAST, m.ad"; break;
    }

    const extraSql = extra.length ? " AND " + extra.join(" AND ") : "";

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        ad: string;
        kod: string | null;
        barkod: string | null;
        marka: string | null;
        stok: number;
        satis_qiymeti: number | null;
        dondurulan_maya: number;
        kritik_stok: number | null;
        min_stok: number | null;
        son_satis: Date | null;
        gun_evvel: number | null;
        sekil_url: string | null;
      }>
    >(
      `SELECT m.id::text, m.ad, m.kod, m.barkod, br.ad AS marka,
              COALESCE(stok_sum.miqdar, 0)::float AS stok,
              m.satis_qiymeti::float AS satis_qiymeti,
              COALESCE(stok_sum.miqdar, 0) * COALESCE(m.alish_qiymeti, 0)::float AS dondurulan_maya,
              m.kritik_stok::float AS kritik_stok,
              m.min_stok::float AS min_stok,
              m.son_satis_de AS son_satis,
              CASE WHEN m.son_satis_de IS NOT NULL
                   THEN EXTRACT(EPOCH FROM (NOW() - m.son_satis_de))::int / 86400 END AS gun_evvel,
              m.sekil_url
         FROM mehsullar m
         LEFT JOIN markalar br ON br.id = m.marka_id
         LEFT JOIN kateqoriyalar k ON k.id = m.kateqoriya_id
         LEFT JOIN LATERAL (
           SELECT SUM(miqdar) AS miqdar FROM stok WHERE mehsul_id = m.id
         ) stok_sum ON TRUE
        WHERE m.sahibkar_id = $1::uuid AND m.aktiv = TRUE AND (${typeFilter})${extraSql}
        ORDER BY ${orderBy}
        LIMIT 1000`,
      ...params
    );

    return rows.map((r) => ({
      ...r,
      stok: Number(r.stok),
      satis_qiymeti: r.satis_qiymeti ? Number(r.satis_qiymeti) : null,
      dondurulan_maya: Number(r.dondurulan_maya),
      kritik_stok: r.kritik_stok ? Number(r.kritik_stok) : null,
      min_stok: r.min_stok ? Number(r.min_stok) : null,
      gun_evvel: r.gun_evvel != null ? Number(r.gun_evvel) : null,
    }));
  });
}
