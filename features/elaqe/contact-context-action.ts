"use server";

import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type ContactContext = {
  id: string;
  ad: string;
  nov: string;
  is_customer: boolean;
  is_supplier: boolean;
  borc: number;
  avans: number;
  borc_limiti: number | null;
  limit_asib: boolean;
  acig_satis_say: number;
  acig_alis_say: number;
  gecikme_gun: number;
  son_satis: { nomre: string; mebleg: number; tarix: Date } | null;
  son_alis: { nomre: string; mebleg: number; tarix: Date } | null;
  son_odenis: { mebleg: number; tarix: Date } | null;
  risk: "low" | "medium" | "high";
  risk_label: string;
};

export async function getContactContext(kontragentId: string): Promise<ContactContext | null> {
  if (!kontragentId) return null;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const k = await prisma.kontragentler.findFirst({
      where: { id: kontragentId, sahibkar_id: sahibkarId },
      select: {
        id: true, ad: true, nov: true,
        borc: true, alacaq: true, avans: true, borc_limiti: true,
      },
    });
    if (!k) return null;

    const isCustomer = k.nov === "musteri" || k.nov === "her_ikisi";
    const isSupplier = k.nov === "techizatci" || k.nov === "her_ikisi";

    // Açıq satışlar (nisye, customer) — sadə Prisma findMany
    const openSales = isCustomer
      ? await prisma.satis_sifarisleri.findMany({
          where: {
            sahibkar_id: sahibkarId,
            musteri_id: kontragentId,
            status: { not: "legv" },
            qaralama: { not: true },
            odenis_nov: { in: ["nisye", "borc"] },
          },
          select: { son_mebleg: true, odenilmis: true, tarix: true },
        }).catch(() => [])
      : [];

    let openTotal = 0;
    let acigSay = 0;
    let enKohne: Date | null = null;
    for (const s of openSales) {
      const qaliq = Number(s.son_mebleg ?? 0) - Number(s.odenilmis ?? 0);
      if (qaliq > 0.01) {
        openTotal += qaliq;
        acigSay++;
        if (!enKohne || (s.tarix && s.tarix < enKohne)) enKohne = s.tarix;
      }
    }

    // Açıq alışlar (supplier)
    const openPurchases = isSupplier
      ? await prisma.alis_sifarisleri.findMany({
          where: {
            sahibkar_id: sahibkarId,
            techiazatci_id: kontragentId,
            status: { not: "legv" },
          },
          select: { umumi_mebleg: true, odenilmis: true },
        }).catch(() => [])
      : [];

    let acigAlisSay = 0;
    for (const a of openPurchases) {
      const qaliq = Number(a.umumi_mebleg ?? 0) - Number(a.odenilmis ?? 0);
      if (qaliq > 0.01) acigAlisSay++;
    }

    // Son satış
    const sonSatis = isCustomer
      ? await prisma.satis_sifarisleri.findFirst({
          where: {
            sahibkar_id: sahibkarId,
            musteri_id: kontragentId,
            status: { not: "legv" },
            qaralama: { not: true },
          },
          orderBy: { tarix: "desc" },
          select: { nomre: true, son_mebleg: true, tarix: true },
        }).catch(() => null)
      : null;

    // Son alış
    const sonAlis = isSupplier
      ? await prisma.alis_sifarisleri.findFirst({
          where: {
            sahibkar_id: sahibkarId,
            techiazatci_id: kontragentId,
            status: { not: "legv" },
          },
          orderBy: { tarix: "desc" },
          select: { nomre: true, umumi_mebleg: true, tarix: true },
        }).catch(() => null)
      : null;

    // Son ödəniş
    const sonOdenis = await prisma.finance_operations.findFirst({
      where: {
        sahibkar_id: sahibkarId,
        kontragent_id: kontragentId,
        status: "aktiv",
        type_kod: { in: ["qaime", "alis_odenis"] },
      },
      orderBy: { tarix: "desc" },
      select: { meblegh: true, tarix: true },
    }).catch(() => null);

    const alacaq = Number(k.alacaq ?? 0);
    const legacyBorc = Number(k.borc ?? 0);
    const borc = isCustomer
      ? Math.max(alacaq, openTotal)
      : Math.max(legacyBorc, 0);

    const limit = k.borc_limiti != null ? Number(k.borc_limiti) : null;
    const limitAsib = limit != null && limit > 0 && borc > limit;

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const gecikme = enKohne ? Math.max(0, Math.floor((now - new Date(enKohne).getTime()) / DAY)) : 0;

    let risk: "low" | "medium" | "high" = "low";
    let riskLabel = "Risk yox";
    if (limitAsib) { risk = "high"; riskLabel = "Limit aşılıb"; }
    else if (gecikme >= 90) { risk = "high"; riskLabel = `${gecikme} gün gecikib`; }
    else if (gecikme >= 30) { risk = "medium"; riskLabel = `${gecikme} gün gecikib`; }
    else if (borc > 0 && gecikme === 0) { riskLabel = "Cari (gecikmə yox)"; }
    else if (borc === 0) { riskLabel = "Borc yoxdur"; }

    return {
      id: k.id,
      ad: k.ad,
      nov: k.nov,
      is_customer: isCustomer,
      is_supplier: isSupplier,
      borc: +borc.toFixed(2),
      avans: Number(k.avans ?? 0),
      borc_limiti: limit,
      limit_asib: limitAsib,
      acig_satis_say: acigSay,
      acig_alis_say: acigAlisSay,
      gecikme_gun: gecikme,
      son_satis: sonSatis ? {
        nomre: sonSatis.nomre,
        mebleg: Number(sonSatis.son_mebleg ?? 0),
        tarix: sonSatis.tarix,
      } : null,
      son_alis: sonAlis ? {
        nomre: sonAlis.nomre,
        mebleg: Number(sonAlis.umumi_mebleg ?? 0),
        tarix: sonAlis.tarix,
      } : null,
      son_odenis: sonOdenis ? {
        mebleg: Number(sonOdenis.meblegh),
        tarix: sonOdenis.tarix,
      } : null,
      risk,
      risk_label: riskLabel,
    };
  });
}
