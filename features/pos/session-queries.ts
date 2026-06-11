import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getStealthState } from "@/lib/stealth/server";

export type ActiveKassa = {
  id: string;
  ad: string;
  acan_id: string | null;
  acan_ad: string | null;
  acilis_tarixi: Date;
  acilis_qaligi: number;
  filial_id: number | null;
  filial_ad: string | null;
  emeliyyatlar_say: number;
  cari_negd: number;
  cari_kart: number;
  cari_bank: number;
  cari_borc: number;
  cemi_satis: number;
};

/** Returns the current user's active (open) kassa, or null if none. */
export async function getActiveKassa(): Promise<ActiveKassa | null> {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    const kassa = await prisma.kassalar.findFirst({
      where: { status: "acig", acan_id: istifadeciId },
      orderBy: { acilis_tarixi: "desc" },
      include: {
        istifadeciler_kassalar_acan_idToistifadeciler: { select: { ad_soyad: true } },
        filiallar: { select: { ad: true } },
      },
    });
    if (!kassa) return null;

    // Aggregate cash flow since session opened
    const agg = await prisma.kassa_emeliyyatlari.groupBy({
      by: ["odenis_nov"],
      where: {
        kassa_id: kassa.id,
        emeliyyat_nov: "satis",
        tarix: { gte: kassa.acilis_tarixi },
      },
      _sum: { mebleg: true },
      _count: { _all: true },
    });

    const byPayment: Record<string, { sum: number; count: number }> = {};
    for (const row of agg) {
      byPayment[row.odenis_nov] = {
        sum: Number(row._sum.mebleg ?? 0),
        count: row._count._all,
      };
    }
    const totalSales = Object.values(byPayment).reduce((s, v) => s + v.count, 0);
    const totalAmount = Object.values(byPayment).reduce((s, v) => s + v.sum, 0);

    // QA-orta: nisyə satışlar kassa_emeliyyatlari sətri yaratmır (sale-action §8) —
    // sessiya "Borc" cəmi birbaşa satis_sifarisleri-dən hesablanır.
    // Qeyd: `tarix` DATE tipidir; sessiya pəncərəsi üçün `yaradildi` (timestamp) işlədilir.
    const nisyeAgg = await prisma.satis_sifarisleri.aggregate({
      where: {
        kassa_id: kassa.id,
        odenis_nov: "nisye",
        status: { not: "legv" },
        yaradildi: { gte: kassa.acilis_tarixi },
      },
      _sum: { son_mebleg: true },
    });

    const stealth = await getStealthState();
    const s = stealth.aktiv ? stealth.scale : 1;

    return {
      id: kassa.id,
      ad: kassa.ad,
      acan_id: kassa.acan_id,
      acan_ad: kassa.istifadeciler_kassalar_acan_idToistifadeciler?.ad_soyad ?? null,
      acilis_tarixi: kassa.acilis_tarixi,
      acilis_qaligi: Number(kassa.acilis_qaligi ?? 0) * s,
      filial_id: kassa.filial_id,
      filial_ad: kassa.filiallar?.ad ?? null,
      emeliyyatlar_say: totalSales,
      cari_negd: (byPayment.negd?.sum ?? 0) * s,
      cari_kart: (byPayment.kart?.sum ?? 0) * s,
      // QA-orta: kassa yazılışında bank-köçürmə enum-u "kecirme"dir ("bank" heç vaxt yazılmır)
      cari_bank: (byPayment.kecirme?.sum ?? 0) * s,
      // QA-orta: nisyə üçün kassa sətri yaranmır — nisyə satışların cəmi göstərilir
      cari_borc: Number(nisyeAgg._sum.son_mebleg ?? 0) * s,
      cemi_satis: totalAmount * s,
    };
  });
}

export type FilialOption = { id: number; ad: string };

export async function getFilialOptions(): Promise<FilialOption[]> {
  return withTenant(async () => {
    const rows = await prisma.filiallar.findMany({
      where: { aktiv: true },
      orderBy: { ad: "asc" },
      select: { id: true, ad: true },
    });
    return rows;
  });
}
