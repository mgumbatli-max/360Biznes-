import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type KassaRow = {
  id: string;
  ad: string;
  status: string;
  kassa_aparati: string | null;
  acan_ad: string | null;
  baglayan_ad: string | null;
  filial_ad: string | null;
  sahibkar_id: string;
  acilis_tarixi: Date;
  baglanis_tarixi: Date | null;
  acilis_qaligi: number;
  hesablanan_qaliq: number | null;
  baglanis_qaligi: number | null;
  fark: number | null;
  qeyd: string | null;
  yaradildi: Date | null;
  yenilendi: Date | null;
  son_emeliyyat_de: Date | null;
  son_emeliyyat_mebleg: number;
  bugun_dovriyye: number;
  medaxil_cem: number;
  mexaric_cem: number;
  balans: number;
};

export async function getKassalar(): Promise<KassaRow[]> {
  return withTenant(async () => {
    const rows = await prisma.kassalar.findMany({
      orderBy: { acilis_tarixi: "desc" },
      take: 100,
      include: {
        istifadeciler_kassalar_acan_idToistifadeciler: { select: { ad_soyad: true } },
        istifadeciler_kassalar_baglayan_idToistifadeciler: { select: { ad_soyad: true } },
        filiallar: { select: { ad: true } },
      },
    });
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [lastOps, dailyOps, totalsByKassa] = await Promise.all([
      prisma.kassa_emeliyyatlari.findMany({
        where: { kassa_id: { in: ids } },
        orderBy: { tarix: "desc" },
        distinct: ["kassa_id"],
        select: { kassa_id: true, tarix: true, mebleg: true, emeliyyat_nov: true },
      }),
      prisma.kassa_emeliyyatlari.groupBy({
        by: ["kassa_id"],
        where: { kassa_id: { in: ids }, tarix: { gte: today } },
        _sum: { mebleg: true },
      }),
      prisma.kassa_emeliyyatlari.groupBy({
        by: ["kassa_id", "emeliyyat_nov"],
        where: { kassa_id: { in: ids } },
        _sum: { mebleg: true },
      }),
    ]);

    const lastMap = new Map<string, { tarix: Date | null; mebleg: number }>();
    for (const op of lastOps) {
      lastMap.set(op.kassa_id, { tarix: op.tarix, mebleg: Number(op.mebleg ?? 0) });
    }
    const dailyMap = new Map<string, number>();
    for (const d of dailyOps) {
      dailyMap.set(d.kassa_id, Number(d._sum.mebleg ?? 0));
    }
    const medaxilMap = new Map<string, number>();
    const mexaricMap = new Map<string, number>();
    for (const t of totalsByKassa) {
      const val = Number(t._sum.mebleg ?? 0);
      if (t.emeliyyat_nov === "mexaric" || t.emeliyyat_nov === "xerc") {
        mexaricMap.set(t.kassa_id, (mexaricMap.get(t.kassa_id) ?? 0) + val);
      } else {
        medaxilMap.set(t.kassa_id, (medaxilMap.get(t.kassa_id) ?? 0) + val);
      }
    }

    return rows.map((k) => {
      const acilis = Number(k.acilis_qaligi ?? 0);
      const medaxil = medaxilMap.get(k.id) ?? 0;
      const mexaric = mexaricMap.get(k.id) ?? 0;
      const balans = acilis + medaxil - mexaric;
      const last = lastMap.get(k.id);
      return {
        id: k.id,
        ad: k.ad,
        status: k.status ?? "acig",
        kassa_aparati: k.kassa_aparati ?? null,
        acan_ad: k.istifadeciler_kassalar_acan_idToistifadeciler?.ad_soyad ?? null,
        baglayan_ad: k.istifadeciler_kassalar_baglayan_idToistifadeciler?.ad_soyad ?? null,
        filial_ad: k.filiallar?.ad ?? null,
        sahibkar_id: k.sahibkar_id,
        acilis_tarixi: k.acilis_tarixi,
        baglanis_tarixi: k.baglanis_tarixi,
        acilis_qaligi: acilis,
        hesablanan_qaliq: k.hesablanan_qaliq ? Number(k.hesablanan_qaliq) : null,
        baglanis_qaligi: k.baglanis_qaligi ? Number(k.baglanis_qaligi) : null,
        fark: k.fark ? Number(k.fark) : null,
        qeyd: k.qeyd ?? null,
        yaradildi: k.yaradildi ?? null,
        yenilendi: k.yenilendi ?? null,
        son_emeliyyat_de: last?.tarix ?? null,
        son_emeliyyat_mebleg: last?.mebleg ?? 0,
        bugun_dovriyye: dailyMap.get(k.id) ?? 0,
        medaxil_cem: medaxil,
        mexaric_cem: mexaric,
        balans,
      };
    });
  });
}

export async function getKassaOperations(kassaId: string, limit = 50) {
  return withTenant(async () => {
    const rows = await prisma.kassa_emeliyyatlari.findMany({
      where: { kassa_id: kassaId },
      orderBy: { tarix: "desc" },
      take: limit,
      include: { istifadeciler: { select: { ad_soyad: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      tarix: r.tarix,
      nov: r.emeliyyat_nov,
      odenis_nov: r.odenis_nov,
      mebleg: Number(r.mebleg),
      ref_nov: r.ref_nov,
      istifadeci_ad: r.istifadeciler?.ad_soyad ?? null,
      qeyd: r.qeyd,
    }));
  });
}

export async function getKassaStats() {
  return withTenant(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [open, allClosed, todayOps, monthOps] = await Promise.all([
      prisma.kassalar.count({ where: { status: "acig" } }),
      prisma.kassalar.count({ where: { status: "bagli" } }),
      prisma.kassa_emeliyyatlari.aggregate({
        where: { tarix: { gte: today }, emeliyyat_nov: "satis" },
        _sum: { mebleg: true },
        _count: { _all: true },
      }),
      prisma.kassa_emeliyyatlari.aggregate({
        where: { tarix: { gte: monthStart }, emeliyyat_nov: "satis" },
        _sum: { mebleg: true },
        _count: { _all: true },
      }),
    ]);

    return {
      acig: open,
      bagli: allClosed,
      bugun_dovriyye: Number(todayOps._sum.mebleg ?? 0),
      bugun_say: todayOps._count._all,
      bu_ay_dovriyye: Number(monthOps._sum.mebleg ?? 0),
      bu_ay_say: monthOps._count._all,
    };
  });
}
