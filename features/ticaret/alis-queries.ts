import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export type PurchaseLineSummary = {
  ad: string;
  kod: string | null;
  miqdar: number;
  qiymet: number;
  cemi: number;
};

export type PurchaseListItem = {
  id: string;
  nomre: string;
  tarix: Date;
  status: string;
  techizatci_id: string | null;
  techizatci_ad: string | null;
  techizatci_telefon: string | null;
  anbar_ad: string | null;
  filial_ad: string | null;
  menecer_ad: string | null;
  yaradan_ad: string | null;
  qaime_nomre: string | null;
  umumi_mebleg: number;
  odenilmis: number;
  elave_xerc: number;
  satir_say: number;
  /** İlk 5 məhsulun xülasəsi — siyahıda peek üçün. */
  ilk_mehsullar: PurchaseLineSummary[];
  qeyd: string | null;
  xerc_qeyd: string | null;
  yaradildi: Date | null;
  yenilendi: Date | null;
};

export type PurchaseFilter = {
  search?: string;
  status?: string[];
  from?: Date;
  to?: Date;
  techizatci_id?: string;
  anbar_id?: number;
  /** "var" → bizim borcumuz olan açıq qaimələr; "yox" → ödənilmiş; undefined → hamısı */
  borc?: "var" | "yox";
  /** Soft-delete filter */
  recordStatus?: "aktiv" | "silinmis" | "hamisi";
};

export async function getPurchases(
  filter: PurchaseFilter,
  page = 1,
  pageSize = 50
): Promise<{ items: PurchaseListItem[]; total: number }> {
  pageSize = Math.min(Math.max(1, pageSize), 100);
  page = Math.max(1, page);
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    const rs = filter.recordStatus ?? "aktiv";
    if (rs === "aktiv") {
      where.deleted_at = null;
      // QA-standart: Aktiv = ləğv edilməmiş də (istifadəçi seçsə görünür)
      if (!filter.status || (Array.isArray(filter.status) && filter.status.length === 0)) where.status = { not: "legv" };
    }
    else if (rs === "silinmis") {
      // ləğvlilər də "silinmişlər"də görünür
      (where as Record<string, unknown>).AND = [ { OR: [ { deleted_at: { not: null } }, { status: "legv" } ] } ];
    }
    if (filter.status?.length) where.status = { in: filter.status };
    if (filter.from || filter.to) {
      where.tarix = {};
      if (filter.from) where.tarix.gte = filter.from;
      if (filter.to) where.tarix.lte = filter.to;
    }
    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { nomre: { contains: q, mode: "insensitive" } },
        { kontragentler: { ad: { contains: q, mode: "insensitive" } } },
      ];
    }
    if (filter.techizatci_id) where.techiazatci_id = filter.techizatci_id;
    if (filter.anbar_id) where.anbar_id = filter.anbar_id;
    if (filter.borc === "var") {
      // Açıq borc olan qaimələr: umumi_mebleg > odenilmis
      where.AND = [
        ...(where.AND ?? []),
        { umumi_mebleg: { gt: 0 } },
        {
          OR: [
            { odenilmis: null },
            { odenilmis: { lt: prisma.alis_sifarisleri.fields.umumi_mebleg } },
          ],
        },
        { status: { not: "legv" } },
      ];
    } else if (filter.borc === "yox") {
      where.AND = [
        ...(where.AND ?? []),
        { odenilmis: { gte: prisma.alis_sifarisleri.fields.umumi_mebleg } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.alis_sifarisleri.findMany({
        where,
        orderBy: [{ tarix: "desc" }, { yaradildi: "desc" }],
        take: pageSize,
        skip: (page - 1) * pageSize,
        include: {
          kontragentler: { select: { id: true, ad: true, telefon: true } },
          anbarlar: { select: { ad: true } },
          istifadeciler_alis_sifarisleri_menecer_idToistifadeciler: { select: { ad_soyad: true } },
          istifadeciler_alis_sifarisleri_yaradan_idToistifadeciler: { select: { ad_soyad: true } },
          _count: { select: { alis_sifaris_satirlari: true } },
          alis_sifaris_satirlari: {
            take: 5,
            orderBy: { id: "asc" },
            select: {
              miqdar: true,
              vahid_qiymet: true,
              cemi: true,
              mehsullar: { select: { ad: true, kod: true } },
            },
          },
        },
      }),
      prisma.alis_sifarisleri.count({ where }),
    ]);

    return {
      items: items.map((a) => ({
        id: a.id,
        nomre: a.nomre,
        tarix: a.tarix,
        status: a.status ?? "gozlemede",
        techizatci_id: a.kontragentler?.id ?? null,
        techizatci_ad: a.kontragentler?.ad ?? null,
        techizatci_telefon: a.kontragentler?.telefon ?? null,
        anbar_ad: a.anbarlar?.ad ?? null,
        filial_ad: null,
        menecer_ad: a.istifadeciler_alis_sifarisleri_menecer_idToistifadeciler?.ad_soyad ?? null,
        yaradan_ad: a.istifadeciler_alis_sifarisleri_yaradan_idToistifadeciler?.ad_soyad ?? null,
        qaime_nomre: a.qaime_nomre ?? null,
        umumi_mebleg: Number(a.umumi_mebleg ?? 0),
        odenilmis: Number(a.odenilmis ?? 0),
        elave_xerc: Number(a.elave_xerc ?? 0),
        satir_say: a._count.alis_sifaris_satirlari,
        ilk_mehsullar: a.alis_sifaris_satirlari.map((line) => ({
          ad: line.mehsullar?.ad ?? "—",
          kod: line.mehsullar?.kod ?? null,
          miqdar: Number(line.miqdar),
          qiymet: Number(line.vahid_qiymet ?? 0),
          cemi: Number(line.cemi ?? 0),
        })),
        qeyd: a.qeyd ?? null,
        xerc_qeyd: a.xerc_qeyd ?? null,
        yaradildi: a.yaradildi ?? null,
        yenilendi: a.yenilendi ?? null,
      })),
      total,
    };
  });
}

export async function getSuppliers() {
  return withTenant(async () => {
    // Dropdown üçündür — 500-dən çox təchizatçısı olan tenantlarda combobox onsuz da
    // axtarış vasitəsilə istifadə olunur. Limit qoymadan həm DB-yə, həm də client-ə
    // yüzlərlə MB göndərirdik.
    return prisma.kontragentler.findMany({
      where: { aktiv: true, nov: { in: ["techizatci", "her_ikisi"] } },
      orderBy: { ad: "asc" },
      select: { id: true, ad: true, telefon: true, borc: true },
      take: 500,
    });
  });
}

export async function getProductsForPurchase() {
  return withTenant(async () => {
    const rows = await prisma.mehsullar.findMany({
      where: { aktiv: true },
      orderBy: { ad: "asc" },
      select: { id: true, ad: true, kod: true, alish_qiymeti: true },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      kod: r.kod,
      alish_qiymeti: Number(r.alish_qiymeti ?? 0),
    }));
  });
}
