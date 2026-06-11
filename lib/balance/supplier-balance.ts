import "server-only";
import { Prisma, prisma } from "@/lib/db/prisma";

/**
 * Təchizatçı borcu (kontragentler.borc) üçün VAHID HƏQİQƏT MƏNBƏYİ.
 *
 * Müştəri balansının (`customer-balance.ts`) analoqudur.
 *
 * MƏNTİQ:
 *   borc = SUM (aktiv nisyə alışların qalığı: umumi_mebleg - odenilmis)
 *
 *  Burada YALNIZ aktiv alışlar nəzərə alınır:
 *   - `status NOT IN ('legv', 'tesdiq_gozleyir')` — təsdiq gözləyən alış
 *     təsdiqlənənə qədər borca düşmür (təsdiqdən sonra status `gozlemede`-yə
 *     keçir və qalığa əlavə olunur).
 *   - `deleted_at IS NULL`
 *   - Servis qeydləri də `kontragentler.borc`-u artıra bilər
 *     (məs. ehtiyat hissə satın alarkən), lakin onlar üçün ayrıca model lazımdır.
 *     İndilik yalnız alış sənədindən hesablanır.
 */

export type SupplierBalanceBreakdown = {
  /** Təchizatçıya bizim ümumi açıq borcumuz (AZN, müsbət) */
  borc: number;
  /** Aktiv alışların orijinal məbləği */
  alis_cemi: number;
  /** Aktiv alışlara ödənilmiş cəmi */
  odenilmis_cemi: number;
  /** Aktiv açıq alış sayı (qalıq > 0) */
  acik_alis_sayi: number;
};

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function calculateSupplierBalance(
  supplierId: string,
  tx: TxClient = prisma,
): Promise<SupplierBalanceBreakdown> {
  const rows = await tx.$queryRaw<
    Array<{
      alis_cemi: number;
      odenilmis_cemi: number;
      acik_alis_sayi: bigint;
    }>
  >`
    SELECT
      COALESCE(SUM(a.umumi_mebleg), 0)::float       AS alis_cemi,
      COALESCE(SUM(a.odenilmis), 0)::float          AS odenilmis_cemi,
      COUNT(*) FILTER (
        WHERE a.umumi_mebleg > COALESCE(a.odenilmis, 0) + 0.001
      )::bigint                                     AS acik_alis_sayi
    FROM alis_sifarisleri a
    WHERE a.techiazatci_id = ${supplierId}::uuid
      AND a.deleted_at IS NULL
      AND a.status NOT IN ('legv', 'tesdiq_gozleyir')
  `;

  const r = rows[0] ?? { alis_cemi: 0, odenilmis_cemi: 0, acik_alis_sayi: 0n };
  const alisCemi = Number(r.alis_cemi ?? 0);
  const odenilmis = Number(r.odenilmis_cemi ?? 0);
  const acik = Number(r.acik_alis_sayi ?? 0);

  const xalisBorc = Math.max(0, alisCemi - odenilmis);

  return {
    borc: Math.round(xalisBorc * 100) / 100,
    alis_cemi: Math.round(alisCemi * 100) / 100,
    odenilmis_cemi: Math.round(odenilmis * 100) / 100,
    acik_alis_sayi: acik,
  };
}

export async function recalculateSupplierBalance(
  supplierId: string,
  tx: TxClient = prisma,
): Promise<{ ok: true; balance: SupplierBalanceBreakdown; drift: number } | { ok: false; error: string }> {
  if (!supplierId) return { ok: false, error: "supplierId boşdur" };

  try {
    const before = await tx.kontragentler.findUnique({
      where: { id: supplierId },
      select: { borc: true },
    });
    if (!before) return { ok: false, error: "Təchizatçı tapılmadı" };

    const balance = await calculateSupplierBalance(supplierId, tx);
    const prevBorc = Number(before.borc ?? 0);
    const drift = balance.borc - prevBorc;

    await tx.kontragentler.update({
      where: { id: supplierId },
      data: {
        borc: new Prisma.Decimal(balance.borc.toFixed(2)),
        yenilendi: new Date(),
      },
    });

    return { ok: true, balance, drift };
  } catch (e) {
    console.error("[recalculateSupplierBalance]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Hesablama alınmadı" };
  }
}
