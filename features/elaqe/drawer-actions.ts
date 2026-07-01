"use server";

import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

const KREDIT_NOVLER = ["nisye", "kredit", "kredit_qeyd"];

export type CustomerDrawerData = {
  ok: true;
  kontragent: {
    id: string;
    ad: string;
    telefon: string | null;
    email: string | null;
    sheher: string | null;
    nov: string | null;
    qiymet_tipi: string | null;
    musteri_reyting: number | null;
    risk_seviyye: string | null;
    qara_siyahi: boolean | null;
    borc: number;
    borc_limiti: number | null;
    aktiv: boolean | null;
    son_temas: Date | null;
  };
  kpis: {
    sales_count: number;
    sales_total: number;
    sales_paid: number;
    borc: number;
    last_sale_date: Date | null;
    avg_check: number;
  };
  recent_sales: Array<{
    id: string;
    nomre: string;
    tarix: Date;
    son_mebleg: number;
    odenilmis: number;
    status: string;
    odenis_nov: string;
    satir_say: number;
  }>;
  active_credits: {
    count: number;
    total_borc: number;
    overdue_count: number;
  };
} | { ok: false; error: string };

export async function getCustomerDrawer(id: string): Promise<CustomerDrawerData> {
  const { requireElaqeActionPerm } = await import("./access-guard");
  const permCheck = await requireElaqeActionPerm("musteri.oxu");
  if (!permCheck.ok) return { ok: false as const, error: permCheck.error };
  try {
    return await withTenant(async () => {
      const k = await prisma.kontragentler.findUnique({ where: { id } });
      if (!k) return { ok: false as const, error: "Müştəri tapılmadı" };

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const overdueCutoff = new Date(today);
      overdueCutoff.setDate(overdueCutoff.getDate() - 30);

      const [salesAgg, recentSales, creditAgg, overdueAgg] = await Promise.all([
        prisma.satis_sifarisleri.aggregate({
          where: { musteri_id: id, qaralama: { not: true }, status: { not: "legv" } },
          _count: { _all: true },
          _sum: { son_mebleg: true, odenilmis: true },
          _max: { tarix: true },
        }),
        prisma.satis_sifarisleri.findMany({
          where: { musteri_id: id, qaralama: { not: true } },
          orderBy: { tarix: "desc" },
          take: 5,
          include: { _count: { select: { satis_sifaris_satirlari: true } } },
        }),
        prisma.satis_sifarisleri.aggregate({
          where: {
            musteri_id: id,
            odenis_nov: { in: KREDIT_NOVLER },
            status: { not: "legv" },
          },
          _count: { _all: true },
          _sum: { son_mebleg: true, odenilmis: true },
        }),
        prisma.satis_sifarisleri.count({
          where: {
            musteri_id: id,
            odenis_nov: { in: KREDIT_NOVLER },
            status: { not: "legv" },
            tarix: { lt: overdueCutoff },
          },
        }),
      ]);

      const salesTotal = Number(salesAgg._sum.son_mebleg ?? 0);
      const salesPaid = Number(salesAgg._sum.odenilmis ?? 0);
      const salesCount = salesAgg._count._all;
      const creditTotal = Number(creditAgg._sum.son_mebleg ?? 0);
      const creditPaid = Number(creditAgg._sum.odenilmis ?? 0);

      return {
        ok: true as const,
        kontragent: {
          id: k.id,
          ad: k.ad,
          telefon: k.telefon,
          email: k.email,
          sheher: k.sheher,
          nov: k.nov,
          qiymet_tipi: k.qiymet_tipi,
          musteri_reyting: k.musteri_reyting,
          risk_seviyye: k.risk_seviyye,
          qara_siyahi: k.qara_siyahi,
          // Yeni model: müştərinin bizə borcu `alacaq`-da saxlanılır.
          // Köhnə kayıtlarda `borc`-da idi — daha böyüyünü götür (legacy uyğunluq).
          borc: Math.max(Number(k.alacaq ?? 0), Number(k.borc ?? 0)),
          borc_limiti: k.borc_limiti != null ? Number(k.borc_limiti) : null,
          aktiv: k.aktiv,
          son_temas: k.son_temas,
        },
        kpis: {
          sales_count: salesCount,
          sales_total: salesTotal,
          sales_paid: salesPaid,
          borc: salesTotal - salesPaid,
          last_sale_date: salesAgg._max.tarix,
          avg_check: salesCount > 0 ? salesTotal / salesCount : 0,
        },
        recent_sales: recentSales.map((s) => ({
          id: s.id,
          nomre: s.nomre,
          tarix: s.tarix,
          son_mebleg: Number(s.son_mebleg ?? 0),
          odenilmis: Number(s.odenilmis ?? 0),
          status: s.status ?? "yeni",
          odenis_nov: s.odenis_nov ?? "negd",
          satir_say: s._count.satis_sifaris_satirlari,
        })),
        active_credits: {
          count: creditAgg._count._all,
          total_borc: creditTotal - creditPaid,
          overdue_count: overdueAgg,
        },
      };
    });
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Xəta baş verdi" };
  }
}
