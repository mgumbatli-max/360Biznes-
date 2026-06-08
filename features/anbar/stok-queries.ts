import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type StokRow = {
  stok_id: number;
  mehsul_id: string;
  ad: string;
  kod: string | null;
  barkod: string | null;
  anbar_id: number;
  anbar_ad: string;
  miqdar: number;
  rezerv: number;
  movcud: number;
  min_stok: number | null;
  kritik_stok: number | null;
  max_stok: number | null;
  son_qiymet: number;
  alish_qiymeti: number;
  satis_qiymeti: number;
  cem_deyer: number;
  vahid: string | null;
  status: "yox" | "az" | "ok";
  sekil_url: string | null;
  aciqlamaq: string | null;
  qisaca_tesvir: string | null;
  kateqoriya_ad: string | null;
  kateqoriya_ust_ad: string | null;
  marka_ad: string | null;
  model: string | null;
  rang: string | null;
  istehsalci: string | null;
  valyuta: string;
  edv_status: string | null;
  zemanet_ay: number;
  etiketsiz: boolean;
  yaradildi: Date | null;
  son_hereket_de: Date | null;
  son_ay_hereket_say: number;
  servis_sayi: number;
  aktiv: boolean;
};

export type StokFilter = {
  search?: string;
  anbar_id?: number;
  status?: "az" | "ok";
  mehsul_id?: string;
};

export async function getStokKpis() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [vals, az, yox, cemiAktiv] = await Promise.all([
      prisma.$queryRaw<{ nov: bigint; miqdar: number; deyer: number }[]>`
        SELECT
          COUNT(DISTINCT s.mehsul_id) FILTER (WHERE s.miqdar > 0)::bigint AS nov,
          COALESCE(SUM(s.miqdar), 0)::float AS miqdar,
          COALESCE(SUM(s.miqdar * COALESCE(s.son_qiymet, m.alish_qiymeti, 0)), 0)::float AS deyer
          FROM stok s
          JOIN mehsullar m ON m.id = s.mehsul_id
         WHERE s.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
      `,
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(DISTINCT m.id)::bigint AS c
          FROM mehsullar m
          JOIN stok s ON s.mehsul_id = m.id
         WHERE m.sahibkar_id = ${sahibkarId}::uuid
           AND m.aktiv = TRUE
           AND m.kritik_stok IS NOT NULL
           AND m.kritik_stok > 0
           AND s.miqdar > 0
           AND s.miqdar <= m.kritik_stok
      `,
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*)::bigint AS c
          FROM mehsullar m
         WHERE m.sahibkar_id = ${sahibkarId}::uuid
           AND m.aktiv = TRUE
           AND COALESCE((SELECT SUM(miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) <= 0
      `,
      prisma.mehsullar.count({ where: { aktiv: true } }),
    ]);
    const v = vals[0] ?? { nov: 0n, miqdar: 0, deyer: 0 };
    const yoxCount = Number(yox[0]?.c ?? 0);
    const azCount = Number(az[0]?.c ?? 0);
    const total = Number(cemiAktiv);
    const normal = Math.max(0, total - yoxCount - azCount);
    return {
      nov: Number(v.nov),
      miqdar: Number(v.miqdar),
      deyer: Number(v.deyer),
      az: azCount,
      yox: yoxCount,
      saglamlik: total > 0 ? (normal / total) * 100 : 0,
    };
  });
}

export async function getStokRows(filter: StokFilter): Promise<StokRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const search = filter.search?.trim();
    const anbarId = filter.anbar_id;

    const rows = await prisma.$queryRaw<
      Array<{
        stok_id: number;
        mehsul_id: string;
        ad: string;
        kod: string | null;
        barkod: string | null;
        anbar_id: number;
        anbar_ad: string;
        miqdar: number;
        rezerv: number;
        min_stok: number | null;
        kritik_stok: number | null;
        max_stok: number | null;
        son_qiymet: number;
        alish_qiymeti: number;
        satis_qiymeti: number;
        vahid: string | null;
        sekil_url: string | null;
        aciqlamaq: string | null;
        qisaca_tesvir: string | null;
        kateqoriya_ad: string | null;
        kateqoriya_ust_ad: string | null;
        marka_ad: string | null;
        model: string | null;
        rang: string | null;
        istehsalci: string | null;
        valyuta: string | null;
        edv_status: string | null;
        zemanet_ay: number | null;
        etiketsiz: boolean | null;
        yaradildi: Date | null;
        son_hereket_de: Date | null;
        son_ay_hereket_say: number;
        servis_sayi: number;
        aktiv: boolean;
      }>
    >`
      SELECT s.id AS stok_id, m.id::text AS mehsul_id, m.ad, m.kod, m.barkod,
             a.id AS anbar_id, a.ad AS anbar_ad,
             COALESCE(s.miqdar, 0)::float AS miqdar,
             COALESCE((
               SELECT SUM(sb.sayi) FROM stok_bron sb
                WHERE sb.mehsul_id = m.id AND sb.anbar_id = a.id
                  AND sb.status = 'aktiv'
                  -- Bitmə tarixi keçmiş bron-lar avtomatik exclude
                  AND (sb.bitme_tarixi IS NULL OR sb.bitme_tarixi >= CURRENT_DATE)
             ), 0)::float AS rezerv,
             m.min_stok::float AS min_stok,
             m.kritik_stok::float AS kritik_stok,
             m.max_stok::float AS max_stok,
             COALESCE(s.son_qiymet, m.alish_qiymeti, 0)::float AS son_qiymet,
             COALESCE(m.alish_qiymeti, 0)::float AS alish_qiymeti,
             COALESCE(m.satis_qiymeti, 0)::float AS satis_qiymeti,
             ov.qisa_ad AS vahid,
             m.sekil_url,
             m.aciqlamaq,
             m.qisaca_tesvir,
             k.ad AS kateqoriya_ad,
             kp.ad AS kateqoriya_ust_ad,
             br.ad AS marka_ad,
             m.model,
             m.rang,
             m.istehsalci,
             m.valyuta,
             m.edv_status,
             m.zemanet_ay::int AS zemanet_ay,
             m.etiketsiz,
             m.yaradildi,
             lh.son_de AS son_hereket_de,
             COALESCE(lh.son_ay_say, 0)::int AS son_ay_hereket_say,
             COALESCE(sc.cnt, 0)::int AS servis_sayi,
             m.aktiv
        FROM stok s
        JOIN mehsullar m ON m.id = s.mehsul_id
        JOIN anbarlar a ON a.id = s.anbar_id
        LEFT JOIN olcu_vahidleri ov ON ov.id = m.olcu_id
        LEFT JOIN kateqoriyalar k ON k.id = m.kateqoriya_id
        LEFT JOIN kateqoriyalar kp ON kp.id = k.ust_id
        LEFT JOIN markalar br ON br.id = m.marka_id
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS cnt FROM servis_qeydleri sq
           WHERE sq.mehsul_id = m.id
        ) sc ON TRUE
        LEFT JOIN LATERAL (
          SELECT MAX(ah.yaradildi) AS son_de,
                 COUNT(*) FILTER (WHERE ah.yaradildi >= NOW() - INTERVAL '30 days') AS son_ay_say
            FROM anbar_hereketleri ah
           WHERE ah.mehsul_id = m.id AND ah.anbar_id = a.id
        ) lh ON TRUE
       WHERE s.sahibkar_id = ${sahibkarId}::uuid
         AND m.aktiv = TRUE
         AND (${anbarId ?? null}::int IS NULL OR s.anbar_id = ${anbarId ?? null}::int)
         AND (${filter.mehsul_id ?? null}::text IS NULL OR m.id::text = ${filter.mehsul_id ?? null}::text)
         AND (${search ?? null}::text IS NULL
              OR m.ad ILIKE '%' || ${search ?? ""} || '%'
              OR m.kod ILIKE '%' || ${search ?? ""} || '%'
              OR m.barkod ILIKE '%' || ${search ?? ""} || '%'
              OR m.model ILIKE '%' || ${search ?? ""} || '%'
              OR EXISTS (SELECT 1 FROM markalar br WHERE br.id = m.marka_id AND br.ad ILIKE '%' || ${search ?? ""} || '%')
              OR EXISTS (SELECT 1 FROM kateqoriyalar k2 WHERE k2.id = m.kateqoriya_id AND k2.ad ILIKE '%' || ${search ?? ""} || '%')
              OR EXISTS (SELECT 1 FROM mehsul_barkodlar mb WHERE mb.mehsul_id = m.id AND mb.barkod ILIKE '%' || ${search ?? ""} || '%'))
       ORDER BY m.ad
       LIMIT 500
    `;

    return rows.map((r) => {
      const min = r.kritik_stok ?? r.min_stok ?? null;
      let status: "yox" | "az" | "ok" = "ok";
      if (!r.miqdar || r.miqdar <= 0) status = "yox";
      else if (min && r.miqdar <= min) status = "az";

      if (filter.status === "az" && status !== "az") return null;
      if (filter.status === "ok" && status !== "ok") return null;

      const rezerv = Number(r.rezerv ?? 0);
      const movcud = Math.max(0, r.miqdar - rezerv);

      return {
        stok_id: r.stok_id,
        mehsul_id: r.mehsul_id,
        ad: r.ad,
        kod: r.kod,
        barkod: r.barkod,
        anbar_id: r.anbar_id,
        anbar_ad: r.anbar_ad,
        miqdar: r.miqdar,
        rezerv,
        movcud,
        min_stok: min,
        kritik_stok: r.kritik_stok ?? null,
        max_stok: r.max_stok ?? null,
        son_qiymet: r.son_qiymet,
        alish_qiymeti: Number(r.alish_qiymeti ?? 0),
        satis_qiymeti: Number(r.satis_qiymeti ?? 0),
        cem_deyer: r.miqdar * r.son_qiymet,
        vahid: r.vahid,
        status,
        sekil_url: r.sekil_url ?? null,
        aciqlamaq: r.aciqlamaq ?? null,
        qisaca_tesvir: r.qisaca_tesvir ?? null,
        kateqoriya_ad: r.kateqoriya_ad ?? null,
        kateqoriya_ust_ad: r.kateqoriya_ust_ad ?? null,
        marka_ad: r.marka_ad ?? null,
        model: r.model ?? null,
        rang: r.rang ?? null,
        istehsalci: r.istehsalci ?? null,
        valyuta: r.valyuta ?? "AZN",
        edv_status: r.edv_status ?? null,
        zemanet_ay: Number(r.zemanet_ay ?? 0),
        etiketsiz: !!r.etiketsiz,
        yaradildi: r.yaradildi ?? null,
        son_hereket_de: r.son_hereket_de ?? null,
        son_ay_hereket_say: Number(r.son_ay_hereket_say ?? 0),
        servis_sayi: Number(r.servis_sayi ?? 0),
        aktiv: !!r.aktiv,
      };
    }).filter(Boolean) as StokRow[];
  });
}

export type RecentMovement = {
  id: string;
  tarix: Date | null;
  nov: string;
  mehsul_id: string | null;
  mehsul_ad: string;
  mehsul_kod: string | null;
  mehsul_barkod: string | null;
  anbar_ad: string;
  miqdar: number;
  qiymet: number | null;
  qeyd: string | null;
  edilen_ad: string | null;
};

export async function getRecentMovements(limit = 12): Promise<RecentMovement[]> {
  return withTenant(async () => {
    const rows = await prisma.anbar_hereketleri.findMany({
      orderBy: { yaradildi: "desc" },
      take: limit,
      include: {
        mehsullar: { select: { id: true, ad: true, kod: true, barkod: true } },
        anbarlar: { select: { ad: true } },
        istifadeciler: { select: { ad_soyad: true } },
      },
    });
    return rows.map((m) => ({
      id: m.id,
      tarix: m.yaradildi,
      nov: m.nov,
      mehsul_id: m.mehsullar?.id ?? null,
      mehsul_ad: m.mehsullar?.ad ?? "—",
      mehsul_kod: m.mehsullar?.kod ?? null,
      mehsul_barkod: m.mehsullar?.barkod ?? null,
      anbar_ad: m.anbarlar?.ad ?? "—",
      miqdar: Number(m.miqdar),
      qiymet: m.qiymet ? Number(m.qiymet) : null,
      qeyd: m.qeyd,
      edilen_ad: m.istifadeciler?.ad_soyad ?? null,
    }));
  });
}
