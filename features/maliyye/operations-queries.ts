import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export type OperationFilter = {
  search?: string;
  qrup?: string;
  yon?: string;
  status?: string;
  hesab_id?: string;
  kontragent_id?: string;
  from?: Date;
  to?: Date;
  min?: number;
  max?: number;
  /** Soft-delete filter */
  recordStatus?: "aktiv" | "silinmis" | "hamisi";
};

export type OperationRow = {
  id: string;
  tarix: Date;
  icra_tarixi: Date | null;
  type_kod: string;
  type_ad: string;
  type_qrup: string;
  type_emoji: string | null;
  yon: string;
  mebleg: number;
  azn_mebleg: number;
  valyuta: string;
  mezenne: number;
  komissiya: number;
  hesab_ad: string | null;
  hesab_id: string | null;
  hesab2_ad: string | null;
  hesab2_id: string | null;
  kontragent_ad: string | null;
  kontragent_id: string | null;
  /** Kontragentin növü — müştəri/təchizatçı/her_ikisi (link route üçün) */
  kontragent_nov: string | null;
  qarsi_teref: string | null;
  isci_ad: string | null;
  isci_id: string | null;
  satis_id: string | null;
  satis_nomre: string | null;
  alish_id: string | null;
  alish_nomre: string | null;
  servis_id: string | null;
  sened_nomresi: string | null;
  status: string;
  qeyd: string | null;
  yaradan_ad: string | null;
  yaradildi: Date | null;
};

export async function getOperations(
  filter: OperationFilter,
  page = 1,
  pageSize = 50,
): Promise<{ items: OperationRow[]; total: number }> {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    const rs = filter.recordStatus ?? "aktiv";
    if (rs === "aktiv") where.deleted_at = null;
    else if (rs === "silinmis") where.deleted_at = { not: null };
    if (filter.status) where.status = filter.status;
    if (filter.yon) where.y_n = filter.yon;
    if (filter.hesab_id) {
      where.OR = [{ hesab_id: filter.hesab_id }, { hesab_id2: filter.hesab_id }];
    }
    if (filter.kontragent_id) where.kontragent_id = filter.kontragent_id;
    if (filter.from || filter.to) {
      where.tarix = {};
      if (filter.from) where.tarix.gte = filter.from;
      if (filter.to) where.tarix.lte = filter.to;
    }
    if (filter.min != null || filter.max != null) {
      where.meblegh = {};
      if (filter.min != null) where.meblegh.gte = filter.min;
      if (filter.max != null) where.meblegh.lte = filter.max;
    }
    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { qeyd: { contains: q, mode: "insensitive" } },
        { sened_nomresi: { contains: q, mode: "insensitive" } },
        { qarsi_teref_ad: { contains: q, mode: "insensitive" } },
        // Kontragent ad, telefon, voen
        { kontragentler: { ad: { contains: q, mode: "insensitive" } } },
        { kontragentler: { telefon: { contains: q } } },
        { kontragentler: { voen: { contains: q } } },
        // Bağlı satış nömrəsi
        { satis_sifarisleri: { nomre: { contains: q, mode: "insensitive" } } },
        // Bağlı alış nömrəsi
        { alis_sifarisleri: { nomre: { contains: q, mode: "insensitive" } } },
        { alis_sifarisleri: { qaime_nomre: { contains: q, mode: "insensitive" } } },
      ];
    }
    if (filter.qrup) {
      where.finance_operation_types = { qrup: filter.qrup };
    }

    const [items, total] = await Promise.all([
      prisma.finance_operations.findMany({
        where,
        orderBy: [{ tarix: "desc" }, { yaradildi: "desc" }],
        take: pageSize,
        skip: (page - 1) * pageSize,
        include: {
          finance_operation_types: { select: { ad: true, qrup: true, emoji: true } },
          maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari: {
            select: { ad: true },
          },
          maliye_hesablari_finance_operations_hesab_id2Tomaliye_hesablari: {
            select: { ad: true },
          },
          kontragentler: { select: { ad: true, nov: true } },
          istifadeciler_finance_operations_isci_idToistifadeciler: {
            select: { ad_soyad: true },
          },
          istifadeciler_finance_operations_yaradan_idToistifadeciler: {
            select: { ad_soyad: true },
          },
          satis_sifarisleri: { select: { nomre: true } },
          alis_sifarisleri: { select: { nomre: true } },
        },
      }).catch(() => [] as never[]),
      prisma.finance_operations.count({ where }).catch(() => 0),
    ]);

    return {
      items: items.map((o) => ({
        id: o.id,
        tarix: o.tarix,
        icra_tarixi: o.icra_tarixi ?? null,
        type_kod: o.type_kod,
        type_ad: o.finance_operation_types?.ad ?? o.type_kod,
        type_qrup: o.finance_operation_types?.qrup ?? "—",
        type_emoji: o.finance_operation_types?.emoji ?? null,
        yon: o.y_n,
        mebleg: Number(o.meblegh ?? 0),
        azn_mebleg: Number(o.azn_meblegh ?? o.meblegh ?? 0),
        valyuta: o.valyuta ?? "AZN",
        mezenne: Number(o.mezenne ?? 1),
        komissiya: Number(o.komissiya ?? 0),
        hesab_ad:
          o.maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari?.ad ?? null,
        hesab_id: o.hesab_id ?? null,
        hesab2_ad:
          o.maliye_hesablari_finance_operations_hesab_id2Tomaliye_hesablari?.ad ?? null,
        hesab2_id: o.hesab_id2 ?? null,
        kontragent_ad: o.kontragentler?.ad ?? null,
        kontragent_id: o.kontragent_id ?? null,
        kontragent_nov: o.kontragentler?.nov ?? null,
        qarsi_teref: o.qarsi_teref_ad ?? null,
        isci_ad: o.istifadeciler_finance_operations_isci_idToistifadeciler?.ad_soyad ?? null,
        isci_id: o.isci_id ?? null,
        satis_id: o.satis_id ?? null,
        satis_nomre: o.satis_sifarisleri?.nomre ?? null,
        alish_id: o.alish_id ?? null,
        alish_nomre: o.alis_sifarisleri?.nomre ?? null,
        servis_id: o.servis_id ?? null,
        sened_nomresi: o.sened_nomresi ?? null,
        status: o.status ?? "aktiv",
        qeyd: o.qeyd ?? null,
        yaradan_ad:
          o.istifadeciler_finance_operations_yaradan_idToistifadeciler?.ad_soyad ?? null,
        yaradildi: o.yaradildi ?? null,
      })),
      total,
    };
  });
}

export async function getOperationsSummary(filter: OperationFilter) {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (filter.status) where.status = filter.status;
    if (filter.yon) where.y_n = filter.yon;
    if (filter.hesab_id) where.OR = [{ hesab_id: filter.hesab_id }, { hesab_id2: filter.hesab_id }];
    if (filter.kontragent_id) where.kontragent_id = filter.kontragent_id;
    if (filter.from || filter.to) {
      where.tarix = {};
      if (filter.from) where.tarix.gte = filter.from;
      if (filter.to) where.tarix.lte = filter.to;
    }
    if (filter.min != null || filter.max != null) {
      where.meblegh = {};
      if (filter.min != null) where.meblegh.gte = filter.min;
      if (filter.max != null) where.meblegh.lte = filter.max;
    }
    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { qeyd: { contains: q, mode: "insensitive" } },
        { sened_nomresi: { contains: q, mode: "insensitive" } },
        { qarsi_teref_ad: { contains: q, mode: "insensitive" } },
        { kontragentler: { ad: { contains: q, mode: "insensitive" } } },
        { kontragentler: { telefon: { contains: q } } },
        { kontragentler: { voen: { contains: q } } },
        { satis_sifarisleri: { nomre: { contains: q, mode: "insensitive" } } },
        { alis_sifarisleri: { nomre: { contains: q, mode: "insensitive" } } },
        { alis_sifarisleri: { qaime_nomre: { contains: q, mode: "insensitive" } } },
      ];
    }
    if (filter.qrup) where.finance_operation_types = { qrup: filter.qrup };

    try {
      const grouped = await prisma.finance_operations.groupBy({
        by: ["y_n"],
        where,
        _sum: { azn_meblegh: true },
        _count: { _all: true },
      });
      let cemi = 0, daxil = 0, xaric = 0, transfer = 0;
      for (const g of grouped) {
        const mb = Number(g._sum.azn_meblegh ?? 0);
        cemi += g._count._all;
        if (g.y_n === "daxil" || g.y_n === "medaxil") daxil += mb;
        // QA-K20: çıxışlar iki etiketlə yazılır (saveExpense/maas/paySupplier →
        // 'mexaric'; quick xerc/azaltma/dividend → 'xaric') — hər ikisi sayılır,
        // yoxsa maaş/xərc/təchizatçı ödənişləri net-dən çıxmırdı.
        else if (g.y_n === "xaric" || g.y_n === "mexaric") xaric += mb;
        else if (g.y_n === "transfer") transfer += mb;
      }
      return { cemi, daxil, xaric, transfer, net: daxil - xaric };
    } catch {
      return { cemi: 0, daxil: 0, xaric: 0, transfer: 0, net: 0 };
    }
  });
}

export async function getOperationTypes() {
  return withTenant(async () =>
    prisma.finance_operation_types
      .findMany({ orderBy: [{ qrup: "asc" }, { ad: "asc" }] })
      .catch(() => [] as never[]),
  );
}

export async function getOperationStats() {
  return withTenant(async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    try {
      const grouped = await prisma.finance_operations.groupBy({
        by: ["y_n"],
        where: { tarix: { gte: monthStart }, status: "aktiv" },
        _sum: { azn_meblegh: true },
        _count: { _all: true },
      });
      const result: Record<string, { mebleg: number; count: number }> = {};
      for (const g of grouped) {
        result[g.y_n] = {
          mebleg: Number(g._sum.azn_meblegh ?? 0),
          count: g._count._all,
        };
      }
      return result;
    } catch {
      return {};
    }
  });
}
