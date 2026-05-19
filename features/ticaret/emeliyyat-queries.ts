import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export type OperationKind = "satis" | "alis" | "qaytarma" | "transfer";

export type OperationRow = {
  id: string;
  nov: OperationKind;
  nomre: string;
  tarix: Date;
  status: string;
  kontragent_ad: string | null;
  anbar_ad: string | null;
  satir_say: number;
  meb: number;
  odenilmis: number;
  qaliq: number;
  yaradan_ad: string | null;
  yaradildi: Date | null;
  qeyd: string | null;
  href: string;
};

export type OperationFilter = {
  novlar?: OperationKind[];
  status?: string[];
  anbar_id?: number;
  kontragent_id?: string;
  from?: Date;
  to?: Date;
  search?: string;
};

export async function getTradeOperations(
  filter: OperationFilter,
  limit = 200
): Promise<OperationRow[]> {
  return withTenant(async () => {
    const includeAll = !filter.novlar?.length;
    const want = (k: OperationKind) => includeAll || filter.novlar!.includes(k);

    const tarixFilter: { gte?: Date; lte?: Date } = {};
    if (filter.from) tarixFilter.gte = filter.from;
    if (filter.to) tarixFilter.lte = filter.to;
    const hasTarix = Boolean(tarixFilter.gte || tarixFilter.lte);

    const q = filter.search?.trim();

    const result: OperationRow[] = [];

    if (want("satis")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { qaralama: { not: true } };
      if (hasTarix) where.tarix = tarixFilter;
      if (filter.status?.length) where.status = { in: filter.status };
      if (filter.anbar_id) where.anbar_id = filter.anbar_id;
      if (filter.kontragent_id) where.musteri_id = filter.kontragent_id;
      if (q) {
        where.OR = [
          { nomre: { contains: q, mode: "insensitive" } },
          { kontragentler: { ad: { contains: q, mode: "insensitive" } } },
        ];
      }
      const rows = await prisma.satis_sifarisleri.findMany({
        where,
        orderBy: [{ tarix: "desc" }, { yaradildi: "desc" }],
        take: limit,
        include: {
          kontragentler: { select: { ad: true } },
          anbarlar: { select: { ad: true } },
          istifadeciler_satis_sifarisleri_yaradan_idToistifadeciler: { select: { ad_soyad: true } },
          _count: { select: { satis_sifaris_satirlari: true } },
        },
      });
      for (const s of rows) {
        const meb = Number(s.son_mebleg ?? 0);
        const odenilmis = Number(s.odenilmis ?? 0);
        result.push({
          id: s.id,
          nov: "satis",
          nomre: s.nomre,
          tarix: s.tarix,
          status: s.status ?? "yeni",
          kontragent_ad: s.kontragentler?.ad ?? null,
          anbar_ad: s.anbarlar?.ad ?? null,
          satir_say: s._count.satis_sifaris_satirlari,
          meb,
          odenilmis,
          qaliq: meb - odenilmis,
          yaradan_ad: s.istifadeciler_satis_sifarisleri_yaradan_idToistifadeciler?.ad_soyad ?? null,
          yaradildi: s.yaradildi ?? null,
          qeyd: s.qeyd ?? null,
          href: `/ticaret/satislar/${s.id}`,
        });
      }
    }

    if (want("alis")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (hasTarix) where.tarix = tarixFilter;
      if (filter.status?.length) where.status = { in: filter.status };
      if (filter.anbar_id) where.anbar_id = filter.anbar_id;
      if (filter.kontragent_id) where.techiazatci_id = filter.kontragent_id;
      if (q) {
        where.OR = [
          { nomre: { contains: q, mode: "insensitive" } },
          { kontragentler: { ad: { contains: q, mode: "insensitive" } } },
        ];
      }
      const rows = await prisma.alis_sifarisleri.findMany({
        where,
        orderBy: [{ tarix: "desc" }, { yaradildi: "desc" }],
        take: limit,
        include: {
          kontragentler: { select: { ad: true } },
          anbarlar: { select: { ad: true } },
          istifadeciler_alis_sifarisleri_yaradan_idToistifadeciler: { select: { ad_soyad: true } },
          _count: { select: { alis_sifaris_satirlari: true } },
        },
      });
      for (const s of rows) {
        const meb = Number(s.umumi_mebleg ?? 0);
        const odenilmis = Number(s.odenilmis ?? 0);
        result.push({
          id: s.id,
          nov: "alis",
          nomre: s.nomre,
          tarix: s.tarix,
          status: s.status ?? "gozlemede",
          kontragent_ad: s.kontragentler?.ad ?? null,
          anbar_ad: s.anbarlar?.ad ?? null,
          satir_say: s._count.alis_sifaris_satirlari,
          meb,
          odenilmis,
          qaliq: meb - odenilmis,
          yaradan_ad: s.istifadeciler_alis_sifarisleri_yaradan_idToistifadeciler?.ad_soyad ?? null,
          yaradildi: s.yaradildi ?? null,
          qeyd: s.qeyd ?? null,
          href: `/ticaret/alislar/${s.id}`,
        });
      }
    }

    if (want("qaytarma")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (hasTarix) where.tarix = tarixFilter;
      if (filter.status?.length) where.status = { in: filter.status };
      if (filter.anbar_id) where.anbar_id = filter.anbar_id;
      if (filter.kontragent_id) where.kontragent_id = filter.kontragent_id;
      if (q) {
        where.OR = [
          { nomre: { contains: q, mode: "insensitive" } },
          { kontragentler: { ad: { contains: q, mode: "insensitive" } } },
        ];
      }
      const rows = await prisma.qaytarma_sifarisleri.findMany({
        where,
        orderBy: [{ tarix: "desc" }, { yaradildi: "desc" }],
        take: limit,
        include: {
          kontragentler: { select: { ad: true } },
          anbarlar: { select: { ad: true } },
          istifadeciler: { select: { ad_soyad: true } },
          _count: { select: { qaytarma_satirlari: true } },
        },
      });
      for (const s of rows) {
        const meb = Number(s.umumi_mebleg ?? 0);
        result.push({
          id: s.id,
          nov: "qaytarma",
          nomre: s.nomre,
          tarix: s.tarix,
          status: s.status ?? "tesdiqlenmemis",
          kontragent_ad: s.kontragentler?.ad ?? null,
          anbar_ad: s.anbarlar?.ad ?? null,
          satir_say: s._count.qaytarma_satirlari,
          meb,
          odenilmis: 0,
          qaliq: 0,
          yaradan_ad: s.istifadeciler?.ad_soyad ?? null,
          yaradildi: s.yaradildi ?? null,
          qeyd: s.qeyd ?? null,
          href: `/ticaret/qaytarma#${s.id}`,
        });
      }
    }

    if (want("transfer")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (hasTarix) where.tarix = tarixFilter;
      if (filter.status?.length) where.status = { in: filter.status };
      if (filter.anbar_id) {
        where.OR = [{ kaynak_anbar_id: filter.anbar_id }, { hedef_anbar_id: filter.anbar_id }];
      }
      if (q) {
        where.AND = [{ nomre: { contains: q, mode: "insensitive" } }];
      }
      const rows = await prisma.anbar_transferleri.findMany({
        where,
        orderBy: [{ tarix: "desc" }, { yaradildi: "desc" }],
        take: limit,
        include: {
          anbarlar_anbar_transferleri_kaynak_anbar_idToanbarlar: { select: { ad: true } },
          anbarlar_anbar_transferleri_hedef_anbar_idToanbarlar: { select: { ad: true } },
          istifadeciler: { select: { ad_soyad: true } },
          _count: { select: { transfer_satirlari: true } },
        },
      });
      for (const s of rows) {
        const kaynak = s.anbarlar_anbar_transferleri_kaynak_anbar_idToanbarlar?.ad ?? "?";
        const hedef = s.anbarlar_anbar_transferleri_hedef_anbar_idToanbarlar?.ad ?? "?";
        result.push({
          id: s.id,
          nov: "transfer",
          nomre: s.nomre,
          tarix: s.tarix,
          status: s.status ?? "tesdiqlenmemis",
          kontragent_ad: null,
          anbar_ad: `${kaynak} → ${hedef}`,
          satir_say: s._count.transfer_satirlari,
          meb: 0,
          odenilmis: 0,
          qaliq: 0,
          yaradan_ad: s.istifadeciler?.ad_soyad ?? null,
          yaradildi: s.yaradildi ?? null,
          qeyd: s.qeyd ?? null,
          href: `/anbar/transfer#${s.id}`,
        });
      }
    }

    result.sort((a, b) => {
      const ta = a.tarix?.getTime() ?? 0;
      const tb = b.tarix?.getTime() ?? 0;
      if (ta !== tb) return tb - ta;
      const ya = a.yaradildi?.getTime() ?? 0;
      const yb = b.yaradildi?.getTime() ?? 0;
      return yb - ya;
    });

    return result.slice(0, limit);
  });
}

export async function getOperationFilterOptions() {
  return withTenant(async () => {
    const [anbarlar, musteriler, techizatcilar] = await Promise.all([
      prisma.anbarlar.findMany({ select: { id: true, ad: true }, orderBy: { ad: "asc" } }),
      prisma.kontragentler.findMany({
        where: { nov: { in: ["musteri", "her_ikisi"] } },
        select: { id: true, ad: true },
        orderBy: { ad: "asc" },
        take: 300,
      }),
      prisma.kontragentler.findMany({
        where: { nov: { in: ["techizatci", "her_ikisi"] } },
        select: { id: true, ad: true },
        orderBy: { ad: "asc" },
        take: 300,
      }),
    ]);
    return {
      anbarlar: anbarlar.map((a) => ({ id: a.id, ad: a.ad })),
      musteriler: musteriler.map((k) => ({ id: k.id, ad: k.ad })),
      techizatcilar: techizatcilar.map((k) => ({ id: k.id, ad: k.ad })),
    };
  });
}
