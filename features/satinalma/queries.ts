import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { searchProductIdsSpaceInsensitive } from "@/lib/db/space-insensitive-search";

export async function getProposals(filter?: { status?: string; search?: string }) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const where: Record<string, unknown> = { sahibkar_id: sahibkarId };
    if (filter?.status) where.status = filter.status;
    if (filter?.search) {
      where.OR = [
        { kod: { contains: filter.search, mode: "insensitive" } },
        { ad: { contains: filter.search, mode: "insensitive" } },
      ];
    }
    return prisma.satinalma_teklif.findMany({
      where,
      orderBy: { yaradildi: "desc" },
      take: 200,
      include: {
        yaradan: { select: { ad_soyad: true, email: true } },
        baxan: { select: { ad_soyad: true } },
        filial: { select: { ad: true } },
        _count: { select: { satirlar: true } },
      },
    });
  });
}

export async function getProposalStats() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const byStatus = await prisma.satinalma_teklif.groupBy({
      by: ["status"],
      where: { sahibkar_id: sahibkarId },
      _count: { _all: true },
    });
    const map = Object.fromEntries(byStatus.map((b) => [b.status, b._count._all]));
    return {
      total: byStatus.reduce((s, b) => s + b._count._all, 0),
      draft: map.draft ?? 0,
      gonderildi: map.gonderildi ?? 0,
      tesdiq: map.tesdiq ?? 0,
      redd: map.redd ?? 0,
      legv: map.legv ?? 0,
    };
  });
}

export async function getProposalDetail(id: number) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.satinalma_teklif.findFirst({
      where: { id, sahibkar_id: sahibkarId },
      include: {
        yaradan: { select: { id: true, ad_soyad: true, email: true } },
        baxan: { select: { id: true, ad_soyad: true } },
        filial: { select: { id: true, ad: true } },
        satirlar: {
          orderBy: { id: "asc" },
          include: {
            mehsul: {
              select: { id: true, ad: true, kod: true, barkod: true, satis_qiymeti: true, alish_qiymeti: true },
            },
            techizatci: { select: { id: true, ad: true } },
          },
        },
      },
    });
  });
}

export async function getProductsForPicker(query: string) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const q = query.trim();
    // Boşluqdan asılı olmayan axtarış: "buds3" ↔ "buds 3".
    const matchedIds = q ? await searchProductIdsSpaceInsensitive(q, { limit: 100, activeOnly: true }) : [];
    if (q && matchedIds.length === 0) return [];
    return prisma.mehsullar.findMany({
      where: {
        sahibkar_id: sahibkarId,
        aktiv: true,
        ...(q ? { id: { in: matchedIds } } : {}),
      },
      take: 30,
      orderBy: { ad: "asc" },
      select: {
        id: true,
        ad: true,
        kod: true,
        barkod: true,
        marka: true,
        alish_qiymeti: true,
        satis_qiymeti: true,
        son_alish_de: true,
        stok: {
          select: { miqdar: true },
          take: 10,
        },
      },
    });
  });
}

export async function getSuppliersForPicker() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.kontragentler.findMany({
      where: { sahibkar_id: sahibkarId, nov: "techizatci", aktiv: true },
      orderBy: { ad: "asc" },
      select: { id: true, ad: true, telefon: true, email: true },
    });
  });
}

export async function getPlanningTable(filter?: { search?: string; durum?: string }) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
    const d70 = new Date(now); d70.setDate(d70.getDate() - 70);
    const d80 = new Date(now); d80.setDate(d80.getDate() - 80);

    const where: Record<string, unknown> = { sahibkar_id: sahibkarId, aktiv: true };
    if (filter?.search?.trim()) {
      // Boşluqdan asılı olmayan axtarış: "buds3" ↔ "buds 3".
      const matchedIds = await searchProductIdsSpaceInsensitive(filter.search.trim(), {
        limit: 500,
        activeOnly: true,
      });
      if (matchedIds.length === 0) return [];
      where.id = { in: matchedIds };
    }

    const products = await prisma.mehsullar.findMany({
      where,
      take: 500,
      orderBy: { yenilendi: "desc" },
      include: {
        stok: { select: { miqdar: true } },
        kateqoriyalar: { select: { ad: true } },
      },
    });

    // Sales aggregates per product over 30/70/80 day windows.
    // Perf: aggregate in-DB (one round-trip) instead of streaming every line
    // item into JS. Same semantics as before — window sums by tarix + last sale
    // date. sahibkar_id scope preserved explicitly (raw bypasses tenant filter).
    const productIds = products.map((p) => p.id);
    const stats = new Map<string, { sale30: number; sale70: number; sale80: number; lastSaleDate: Date | null }>();
    if (productIds.length > 0) {
      const aggRows = await prisma.$queryRaw<
        { mehsul_id: string; sale30: number; sale70: number; sale80: number; last_sale: Date | null }[]
      >`
        SELECT sls.mehsul_id::text AS mehsul_id,
               COALESCE(SUM(CASE WHEN ss.tarix >= ${d30} THEN sls.miqdar ELSE 0 END), 0)::float AS sale30,
               COALESCE(SUM(CASE WHEN ss.tarix >= ${d70} THEN sls.miqdar ELSE 0 END), 0)::float AS sale70,
               COALESCE(SUM(sls.miqdar), 0)::float AS sale80,
               MAX(ss.tarix) AS last_sale
          FROM satis_sifaris_satirlari sls
          JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
         WHERE sls.sahibkar_id = ${sahibkarId}::uuid
           AND sls.mehsul_id = ANY(${productIds}::uuid[])
           AND ss.tarix >= ${d80}
           AND ss.status IS DISTINCT FROM 'legv'
         GROUP BY sls.mehsul_id
      `;
      for (const r of aggRows) {
        if (!r.mehsul_id) continue;
        stats.set(r.mehsul_id, {
          sale30: Number(r.sale30),
          sale70: Number(r.sale70),
          sale80: Number(r.sale80),
          lastSaleDate: r.last_sale ? new Date(r.last_sale) : null,
        });
      }
    }

    const result = products.map((p) => {
      const stok = p.stok.reduce((s, r) => s + Number(r.miqdar ?? 0), 0);
      const st = stats.get(p.id) ?? { sale30: 0, sale70: 0, sale80: 0, lastSaleDate: null };
      const dailyRate = st.sale30 / 30;
      const daysOfStock = dailyRate > 0 ? stok / dailyRate : 999;
      const kritik = Number(p.kritik_stok ?? 0);

      let durum: "bitib" | "kritik" | "azalir" | "donmus" | "passiv" | "normal";
      let aiTovsiye: string;
      let suggestedQty: number;

      if (stok <= 0) {
        if (st.sale30 > 0) {
          durum = "bitib";
          aiTovsiye = `Stok bitib — son 30 gün ${st.sale30} satılıb, təcili al!`;
          suggestedQty = Math.max(5, Math.ceil(dailyRate * 30));
        } else if (st.sale80 > 0) {
          durum = "passiv";
          aiTovsiye = "Stok bitib, son 30 gün satış yoxdur — biraz gözlə";
          suggestedQty = 0;
        } else {
          durum = "donmus";
          aiTovsiye = "Heç bir satış yoxdur — al qərarı verməyə ehtiyac yox";
          suggestedQty = 0;
        }
      } else if (kritik > 0 && stok <= kritik) {
        durum = "kritik";
        aiTovsiye = `Kritik stok (${stok}/${kritik}) — təcili al`;
        suggestedQty = Math.max(5, Math.ceil(dailyRate * 30) - stok);
      } else if (daysOfStock < 7 && dailyRate > 0) {
        durum = "azalir";
        aiTovsiye = `${Math.round(daysOfStock)} günə bitir, sıfra al`;
        suggestedQty = Math.max(5, Math.ceil(dailyRate * 30) - stok);
      } else if (daysOfStock < 14 && dailyRate > 0.5) {
        durum = "azalir";
        aiTovsiye = "Sürətli satılır, çox alış at";
        suggestedQty = Math.max(5, Math.ceil(dailyRate * 30));
      } else if (st.sale80 === 0 && stok > 0) {
        durum = "donmus";
        aiTovsiye = "80+ gündür satılmır — alma, endirim edib sat";
        suggestedQty = 0;
      } else {
        durum = "normal";
        aiTovsiye = "Stok normaldır";
        suggestedQty = 0;
      }

      return {
        id: p.id,
        ad: p.ad,
        kod: p.kod,
        barkod: p.barkod,
        marka: p.marka,
        kateqoriya: p.kateqoriyalar?.ad ?? null,
        stok,
        sale30: st.sale30,
        sale70: st.sale70,
        sale80: st.sale80,
        dailyRate,
        daysOfStock,
        lastSaleDate: st.lastSaleDate,
        alish_qiymeti: Number(p.alish_qiymeti ?? 0),
        satis_qiymeti: Number(p.satis_qiymeti ?? 0),
        tedarukci_id: p.tedarukci_id,
        kritik_stok: kritik,
        durum,
        aiTovsiye,
        suggestedQty,
      };
    });

    // Filter by durum if requested
    let filtered = result;
    if (filter?.durum) {
      filtered = filtered.filter((r) => r.durum === filter.durum);
    }

    // Default sort: priority — bitib > kritik > azalir > donmus > passiv > normal
    const priority = { bitib: 100, kritik: 90, azalir: 70, donmus: 30, passiv: 20, normal: 0 };
    filtered.sort((a, b) => (priority[b.durum] ?? 0) - (priority[a.durum] ?? 0));

    return filtered;
  });
}

export async function getPlanningStats() {
  const rows = await getPlanningTable();
  return {
    total: rows.length,
    bitib: rows.filter((r) => r.durum === "bitib").length,
    kritik: rows.filter((r) => r.durum === "kritik").length,
    azalir: rows.filter((r) => r.durum === "azalir").length,
    donmus: rows.filter((r) => r.durum === "donmus").length,
  };
}

/** AI/algorithmic recommendation — low stock + sales velocity */
export async function getAiSuggestions() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const thirtyAgo = new Date();
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);

    // Find products with low stock
    const lowStock = await prisma.mehsullar.findMany({
      where: { sahibkar_id: sahibkarId, aktiv: true },
      include: {
        stok: { select: { miqdar: true } },
        satis_sifaris_satirlari: {
          where: { satis_sifarisleri: { tarix: { gte: thirtyAgo } } },
          select: { miqdar: true },
        },
      },
      take: 200,
    });

    const suggestions = lowStock
      .map((m) => {
        const stokTotal = m.stok.reduce((s, r) => s + Number(r.miqdar ?? 0), 0);
        const salesQty = m.satis_sifaris_satirlari.reduce((s, r) => s + Number(r.miqdar ?? 0), 0);
        const dailySales = salesQty / 30;
        const daysOfStock = dailySales > 0 ? stokTotal / dailySales : 999;
        const kritik = Number(m.kritik_stok ?? 0);

        let priority = 0;
        let reason = "";
        if (stokTotal === 0 && salesQty > 0) {
          priority = 100;
          reason = `Stok bitib, son 30 gündə ${salesQty} ədəd satılıb`;
        } else if (kritik > 0 && stokTotal <= kritik) {
          priority = 85;
          reason = `Kritik stok altında (${stokTotal}/${kritik})`;
        } else if (daysOfStock < 7 && dailySales > 0) {
          priority = 70;
          reason = `${Math.round(daysOfStock)} günlük stok qaldı (gündə ~${dailySales.toFixed(1)} ədəd satılır)`;
        } else if (daysOfStock < 14 && dailySales > 0.5) {
          priority = 50;
          reason = `2 həftə daxili stok azalır`;
        }

        if (priority === 0) return null;

        // Suggest order qty: 30 days worth
        const suggestedQty = Math.max(5, Math.ceil(dailySales * 30) - Math.floor(stokTotal));

        return {
          mehsul_id: m.id,
          ad: m.ad,
          kod: m.kod,
          stok: stokTotal,
          dailySales,
          daysOfStock,
          alish_qiymeti: Number(m.alish_qiymeti ?? 0),
          son_alish_de: m.son_alish_de,
          priority,
          reason,
          suggestedQty,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 50);

    return suggestions;
  });
}
