"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { safeAuditLog } from "@/lib/audit/safe-log";
import { audit } from "@/lib/audit/log";
import { checkAndCreateStockAlertBatch } from "@/features/anbar/alert-helpers";
import { requireTicaretPerm, requireTicaretActionPerm, bustTicaretCache } from "./access-guard";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/* =========================================================================
 * 1. ACTIVITY FEED — son 100 ticarət hadisəsi (audit_log əsasında)
 * ======================================================================= */
export type TicaretActivityItem = {
  id: string;
  emeliyyat: string;
  resurs_nov: string;
  resurs_id: string | null;
  istifadeci_ad: string | null;
  sebeb: string | null;
  status: string | null;
  yaradildi: Date;
};

export async function getSalesActivityFeed(limit = 100): Promise<TicaretActivityItem[]> {
  await requireTicaretPerm();
  const safeLimit = Math.min(500, Math.max(1, limit));
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.audit_log.findMany({
      where: {
        sahibkar_id: sahibkarId,
        resurs_nov: {
          in: [
            "satis_sifarisi",
            "satis_split",
            "alis_sifarisi",
            "qaytarma_sifarisi",
            "kredit_satis",
            "kredit_satis_odenis",
            "kredit_bank_odenis",
            "teklif",
            "stok_bron",
            "commission",
            "commission_rules",
            "marketplace_satis",
          ],
        },
      },
      orderBy: { yaradildi: "desc" },
      take: safeLimit,
      select: {
        id: true,
        emeliyyat: true,
        resurs_nov: true,
        resurs_id: true,
        istifadeci_ad: true,
        sebeb: true,
        status: true,
        yaradildi: true,
      },
    });
    return rows.map((r) => ({
      id: String(r.id),
      emeliyyat: r.emeliyyat,
      resurs_nov: r.resurs_nov,
      resurs_id: r.resurs_id,
      istifadeci_ad: r.istifadeci_ad,
      sebeb: r.sebeb,
      status: r.status,
      yaradildi: r.yaradildi ?? new Date(),
    }));
  });
}

/* =========================================================================
 * 2. BULK CANCEL SALES — çoxlu satışı toplu ləğv (stok bərpa + audit)
 * ======================================================================= */
export async function bulkCancelSales(
  saleIds: string[],
  reason: string,
): Promise<ActionResult<{ cancelled: number; skipped: number; failures: { id: string; error: string }[] }>> {
  const permCheck = await requireTicaretActionPerm(["satis.legv", "satis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!Array.isArray(saleIds) || saleIds.length === 0) {
    return { ok: false, error: "Heç bir satış seçilməyib" };
  }
  if (saleIds.length > 100) return { ok: false, error: "Bir dəfəyə 100-dən çox satış olmamalıdır" };
  const sebeb = reason.trim();
  if (!sebeb) return { ok: false, error: "Səbəb göstərilməlidir" };
  if (sebeb.length > 500) return { ok: false, error: "Səbəb çox uzundur" };

  const { cancelSale } = await import("./satis-actions");

  let cancelled = 0;
  let skipped = 0;
  const failures: { id: string; error: string }[] = [];
  for (const id of saleIds) {
    try {
      const r = await cancelSale(id, sebeb);
      if (r.ok) cancelled++;
      else {
        skipped++;
        failures.push({ id, error: r.error });
      }
    } catch (e) {
      skipped++;
      failures.push({ id, error: e instanceof Error ? e.message : "naməlum" });
    }
  }

  await withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "bulk_legv",
        resurs_nov: "satis_sifarisi",
        resurs_id: null,
        yeni_data: { requested: saleIds.length, cancelled, skipped, sebeb },
        status: failures.length === 0 ? "ugur" : "qismi",
      });
    } catch { /* non-fatal */ }
  });

  revalidatePath("/ticaret/satislar");
  bustTicaretCache();
  return { ok: true, data: { cancelled, skipped, failures } };
}

/* =========================================================================
 * 3. SALES ANALYTICS — bu ay / keçmiş ay müqayisəsi
 * ======================================================================= */
export type SalesAnalytics = {
  bu_ay: { sayi: number; cem: number; orta_cek: number };
  kechmis_ay: { sayi: number; cem: number; orta_cek: number };
  artim_faiz: number;
  top_5_mehsul: { mehsul_id: string; ad: string; sayi: number; cem: number }[];
  top_5_musteri: { musteri_id: string; ad: string; sayi: number; cem: number }[];
};

export async function getSalesAnalytics(): Promise<SalesAnalytics> {
  await requireTicaretPerm("hesabat.oxu");
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const startBu = new Date(now.getFullYear(), now.getMonth(), 1);
    const startKech = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endKech = new Date(now.getFullYear(), now.getMonth(), 1);

    const [buAy, kechAy] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { sahibkar_id: sahibkarId, tarix: { gte: startBu }, status: { not: "legv" }, qaralama: false },
        _count: { _all: true },
        _sum: { son_mebleg: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: { sahibkar_id: sahibkarId, tarix: { gte: startKech, lt: endKech }, status: { not: "legv" }, qaralama: false },
        _count: { _all: true },
        _sum: { son_mebleg: true },
      }),
    ]);

    const buCem = Number(buAy._sum.son_mebleg ?? 0);
    const kechCem = Number(kechAy._sum.son_mebleg ?? 0);
    const artim = kechCem > 0 ? ((buCem - kechCem) / kechCem) * 100 : 0;

    // Top 5 məhsul (bu ay)
    const topLines = await prisma.satis_sifaris_satirlari.groupBy({
      by: ["mehsul_id"],
      where: {
        sahibkar_id: sahibkarId,
        satis_sifarisleri: { sahibkar_id: sahibkarId, tarix: { gte: startBu }, status: { not: "legv" }, qaralama: false },
      },
      _sum: { miqdar: true, cemi: true },
      orderBy: { _sum: { cemi: "desc" } },
      take: 5,
    });
    const mehsulIds = topLines.map((l) => l.mehsul_id).filter((x): x is string => x !== null);
    const mehsulNames = mehsulIds.length
      ? await prisma.mehsullar.findMany({
          where: { sahibkar_id: sahibkarId, id: { in: mehsulIds } },
          select: { id: true, ad: true },
        })
      : [];
    const nameMap = new Map(mehsulNames.map((m) => [m.id, m.ad]));

    // Top 5 müştəri (bu ay)
    const topCust = await prisma.satis_sifarisleri.groupBy({
      by: ["musteri_id"],
      where: { sahibkar_id: sahibkarId, tarix: { gte: startBu }, status: { not: "legv" }, qaralama: false, musteri_id: { not: null } },
      _count: { _all: true },
      _sum: { son_mebleg: true },
      orderBy: { _sum: { son_mebleg: "desc" } },
      take: 5,
    });
    const custIds = topCust.map((c) => c.musteri_id).filter((x): x is string => x !== null);
    const custs = custIds.length
      ? await prisma.kontragentler.findMany({
          where: { sahibkar_id: sahibkarId, id: { in: custIds } },
          select: { id: true, ad: true },
        })
      : [];
    const custMap = new Map(custs.map((c) => [c.id, c.ad]));

    return {
      bu_ay: {
        sayi: buAy._count._all,
        cem: buCem,
        orta_cek: buAy._count._all > 0 ? buCem / buAy._count._all : 0,
      },
      kechmis_ay: {
        sayi: kechAy._count._all,
        cem: kechCem,
        orta_cek: kechAy._count._all > 0 ? kechCem / kechAy._count._all : 0,
      },
      artim_faiz: Math.round(artim * 10) / 10,
      top_5_mehsul: topLines.map((l) => ({
        mehsul_id: l.mehsul_id ?? "",
        ad: nameMap.get(l.mehsul_id ?? "") ?? "—",
        sayi: Number(l._sum?.miqdar ?? 0),
        cem: Number(l._sum?.cemi ?? 0),
      })),
      top_5_musteri: topCust.map((c) => ({
        musteri_id: c.musteri_id ?? "",
        ad: custMap.get(c.musteri_id ?? "") ?? "—",
        sayi: c._count._all,
        cem: Number(c._sum.son_mebleg ?? 0),
      })),
    };
  });
}

/* =========================================================================
 * 4. CUSTOMER SALES HISTORY — müştərinin son satışları + balans
 * ======================================================================= */
export type CustomerSalesHistory = {
  musteri: { id: string; ad: string; borc: number; alacaq: number } | null;
  son_satislar: { id: string; nomre: string; tarix: Date; status: string; son_mebleg: number; odenilmis: number }[];
  cem_satis: number;
  satis_sayi: number;
};

export async function getCustomerSalesHistory(musteriId: string): Promise<CustomerSalesHistory> {
  await requireTicaretPerm();
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const m = await prisma.kontragentler.findFirst({
      where: { id: musteriId, sahibkar_id: sahibkarId },
      select: { id: true, ad: true, borc: true, alacaq: true },
    });
    if (!m) return { musteri: null, son_satislar: [], cem_satis: 0, satis_sayi: 0 };
    const son = await prisma.satis_sifarisleri.findMany({
      where: { sahibkar_id: sahibkarId, musteri_id: musteriId, qaralama: false },
      orderBy: { tarix: "desc" },
      take: 30,
      select: { id: true, nomre: true, tarix: true, status: true, son_mebleg: true, odenilmis: true },
    });
    const agg = await prisma.satis_sifarisleri.aggregate({
      where: { sahibkar_id: sahibkarId, musteri_id: musteriId, qaralama: false, status: { not: "legv" } },
      _count: { _all: true },
      _sum: { son_mebleg: true },
    });
    return {
      musteri: {
        id: m.id,
        ad: m.ad,
        borc: Number(m.borc ?? 0),
        alacaq: Number(m.alacaq ?? 0),
      },
      son_satislar: son.map((s) => ({
        id: s.id,
        nomre: s.nomre,
        tarix: s.tarix,
        status: s.status ?? "yeni",
        son_mebleg: Number(s.son_mebleg ?? 0),
        odenilmis: Number(s.odenilmis ?? 0),
      })),
      cem_satis: Number(agg._sum.son_mebleg ?? 0),
      satis_sayi: agg._count._all,
    };
  });
}

/* =========================================================================
 * 5. EXPORT SALES CSV — bütün satışları və ya tarix aralığını CSV kimi
 * ======================================================================= */
export async function exportSalesCsv(
  baslangic?: string,
  son?: string,
): Promise<ActionResult<{ csv: string; sayi: number }>> {
  const permCheck = await requireTicaretActionPerm(["satis.export", "hesabat.export", "satis.oxu"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const where: { sahibkar_id: string; tarix?: { gte?: Date; lte?: Date } } = { sahibkar_id: sahibkarId };
      if (baslangic) where.tarix = { ...(where.tarix ?? {}), gte: new Date(baslangic) };
      if (son) where.tarix = { ...(where.tarix ?? {}), lte: new Date(son) };
      const rows = await prisma.satis_sifarisleri.findMany({
        where,
        orderBy: { tarix: "desc" },
        take: 5000,
        select: {
          nomre: true,
          tarix: true,
          status: true,
          odenis_nov: true,
          son_mebleg: true,
          odenilmis: true,
          kontragentler: { select: { ad: true } },
          anbarlar: { select: { ad: true } },
        },
      });
      const escape = (s: unknown): string => {
        const v = String(s ?? "").replace(/"/g, '""');
        return /[",\n]/.test(v) ? `"${v}"` : v;
      };
      const header = "Nömrə,Tarix,Müştəri,Anbar,Status,Ödəniş növü,Yekun məbləğ,Ödənilmiş";
      const lines = rows.map((r) =>
        [
          r.nomre,
          r.tarix.toISOString().slice(0, 10),
          r.kontragentler?.ad ?? "",
          r.anbarlar?.ad ?? "",
          r.status ?? "",
          r.odenis_nov ?? "",
          Number(r.son_mebleg ?? 0).toFixed(2),
          Number(r.odenilmis ?? 0).toFixed(2),
        ]
          .map(escape)
          .join(","),
      );
      const csv = [header, ...lines].join("\n");
      try {
        await audit("export", "satis_sifarisi", null, {
          yeni_data: { sayi: rows.length, baslangic: baslangic ?? null, son: son ?? null },
          sebeb: "Satışlar CSV kimi export edildi",
        });
      } catch { /* non-fatal */ }
      return { ok: true, data: { csv, sayi: rows.length } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Export alınmadı" };
    }
  });
}

/* =========================================================================
 * 6. EMERGENCY FREEZE SALES — yeni satışları dayandır (kill-switch)
 * ======================================================================= */
export async function emergencyFreezeSales(
  freeze: boolean,
  reason: string,
): Promise<ActionResult<{ freeze: boolean }>> {
  const permCheck = await requireTicaretActionPerm(["satis.freeze", "ayarlar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (freeze && !reason.trim()) return { ok: false, error: "Səbəb göstərilməlidir" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.ayarlar.upsert({
        where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "ticaret", acar: "satis_freeze" } },
        update: { deyer: String(freeze), yenilendi: new Date(), nov: "boolean" },
        create: {
          sahibkar_id: sahibkarId,
          qrup: "ticaret",
          acar: "satis_freeze",
          deyer: String(freeze),
          nov: "boolean",
          tesvir: "Satışları dayandırma kill-switch",
        },
      });
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: freeze ? "freeze" : "unfreeze",
          resurs_nov: "satis_freeze",
          resurs_id: null,
          yeni_data: { freeze, reason: reason.slice(0, 500) },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      revalidatePath("/ticaret");
      bustTicaretCache();
      return { ok: true, data: { freeze } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

export async function isSalesFrozen(): Promise<boolean> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findUnique({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "ticaret", acar: "satis_freeze" } },
    });
    return row?.deyer === "true";
  });
}

/* =========================================================================
 * 7. RETURN REASON REPORT — son 90 gün qaytarma səbəbi analizi
 * ======================================================================= */
export type ReturnReasonRow = { sebeb: string; sayi: number; cem: number };

export async function getReturnReasonReport(): Promise<ReturnReasonRow[]> {
  await requireTicaretPerm("hesabat.oxu");
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const rows = await prisma.qaytarma_sifarisleri.findMany({
      where: { sahibkar_id: sahibkarId, tarix: { gte: since } },
      select: { sebeb: true, umumi_mebleg: true },
    });
    const map = new Map<string, { sayi: number; cem: number }>();
    for (const r of rows) {
      const key = (r.sebeb?.slice(0, 80) ?? "—") || "—";
      const cur = map.get(key) ?? { sayi: 0, cem: 0 };
      cur.sayi += 1;
      cur.cem += Number(r.umumi_mebleg ?? 0);
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([sebeb, v]) => ({ sebeb, ...v }))
      .sort((a, b) => b.cem - a.cem)
      .slice(0, 20);
  });
}

/* =========================================================================
 * 8. PURCHASE ANALYTICS — alış tendensiyası
 * ======================================================================= */
export type PurchaseAnalytics = {
  son_30_gun: { sayi: number; cem: number };
  gozlemede: { sayi: number; cem: number };
  top_5_techizatci: { techiazatci_id: string; ad: string; sayi: number; cem: number }[];
};

export async function getPurchaseAnalytics(): Promise<PurchaseAnalytics> {
  await requireTicaretPerm("hesabat.oxu");
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [son30, gozle, topT] = await Promise.all([
      prisma.alis_sifarisleri.aggregate({
        where: { sahibkar_id: sahibkarId, tarix: { gte: since } },
        _count: { _all: true },
        _sum: { umumi_mebleg: true },
      }),
      prisma.alis_sifarisleri.aggregate({
        where: { sahibkar_id: sahibkarId, status: "gozlemede" },
        _count: { _all: true },
        _sum: { umumi_mebleg: true },
      }),
      prisma.alis_sifarisleri.groupBy({
        by: ["techiazatci_id"],
        where: { sahibkar_id: sahibkarId, tarix: { gte: since }, techiazatci_id: { not: null } },
        _count: { _all: true },
        _sum: { umumi_mebleg: true },
        orderBy: { _sum: { umumi_mebleg: "desc" } },
        take: 5,
      }),
    ]);
    const ids = topT.map((t) => t.techiazatci_id).filter((x): x is string => x !== null);
    const names = ids.length
      ? await prisma.kontragentler.findMany({
          where: { sahibkar_id: sahibkarId, id: { in: ids } },
          select: { id: true, ad: true },
        })
      : [];
    const nameMap = new Map(names.map((n) => [n.id, n.ad]));
    return {
      son_30_gun: {
        sayi: son30._count?._all ?? 0,
        cem: Number(son30._sum?.umumi_mebleg ?? 0),
      },
      gozlemede: {
        sayi: gozle._count?._all ?? 0,
        cem: Number(gozle._sum?.umumi_mebleg ?? 0),
      },
      top_5_techizatci: topT.map((t) => ({
        techiazatci_id: t.techiazatci_id ?? "",
        ad: nameMap.get(t.techiazatci_id ?? "") ?? "—",
        sayi: t._count?._all ?? 0,
        cem: Number(t._sum?.umumi_mebleg ?? 0),
      })),
    };
  });
}

/* =========================================================================
 * 9. SALES FORECAST — son 3 ay ortalama əsasında bu ayın proqnozu
 * ======================================================================= */
export type SalesForecast = {
  son_3_ay_orta: number;
  bu_ay_inkishaf: number;
  proqnoz_bu_ay_son: number;
  guven_faiz: number;
};

export async function forecastSalesForMonth(): Promise<SalesForecast> {
  await requireTicaretPerm("hesabat.oxu");
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const start3Ay = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const startBu = new Date(now.getFullYear(), now.getMonth(), 1);
    const [son3, buAy] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { sahibkar_id: sahibkarId, tarix: { gte: start3Ay, lt: startBu }, status: { not: "legv" }, qaralama: false },
        _sum: { son_mebleg: true },
      }),
      prisma.satis_sifarisleri.aggregate({
        where: { sahibkar_id: sahibkarId, tarix: { gte: startBu }, status: { not: "legv" }, qaralama: false },
        _sum: { son_mebleg: true },
      }),
    ]);
    const orta = Number(son3._sum.son_mebleg ?? 0) / 3;
    const buCem = Number(buAy._sum.son_mebleg ?? 0);
    const gunler = Math.max(1, Math.ceil((now.getTime() - startBu.getTime()) / (24 * 60 * 60 * 1000)));
    const ayGun = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const proqnoz = gunler > 0 ? (buCem / gunler) * ayGun : 0;
    const guven = Math.min(100, Math.round((gunler / ayGun) * 100));
    return {
      son_3_ay_orta: Math.round(orta * 100) / 100,
      bu_ay_inkishaf: Math.round(buCem * 100) / 100,
      proqnoz_bu_ay_son: Math.round(proqnoz * 100) / 100,
      guven_faiz: guven,
    };
  });
}

/* =========================================================================
 * 10. APPROVAL QUEUE — gözləyən təsdiq tələbləri (satış üçün)
 * ======================================================================= */
export type ApprovalQueueItem = {
  id: number;
  basliq: string | null;
  resurs_nov: string | null;
  resurs_id: string | null;
  mebleg: number;
  prioritet: string;
  risk_sebeb: string | null;
  yaradildi: Date;
};

export async function approvalQueueForSales(): Promise<ApprovalQueueItem[]> {
  await requireTicaretPerm("tesdiq.oxu");
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.tesdiq_telep.findMany({
      where: {
        sahibkar_id: sahibkarId,
        status: "gozleyir",
        emeliyyat_nov: { in: ["satis_qaime", "endirim_tesdiq", "kredit_satis"] },
      },
      orderBy: [{ prioritet: "desc" }, { yaradildi: "desc" }],
      take: 100,
      select: {
        id: true,
        basliq: true,
        resurs_nov: true,
        resurs_id: true,
        mebleg: true,
        prioritet: true,
        risk_sebeb: true,
        yaradildi: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      basliq: r.basliq,
      resurs_nov: r.resurs_nov,
      resurs_id: r.resurs_id,
      mebleg: Number(r.mebleg ?? 0),
      prioritet: r.prioritet ?? "orta",
      risk_sebeb: r.risk_sebeb,
      yaradildi: r.yaradildi ?? new Date(),
    }));
  });
}

/* =========================================================================
 * 11. RESCAN STOCK ALERTS — bütün satılan məhsullar üçün stok xəbərdarlığı
 *      yenidən yoxla (admin maintenance tool)
 * ======================================================================= */
export async function rescanStockAlertsForActiveProducts(): Promise<ActionResult<{ scanned: number }>> {
  const permCheck = await requireTicaretActionPerm(["anbar.idare", "ticaret.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const products = await prisma.mehsullar.findMany({
      where: { sahibkar_id: sahibkarId, aktiv: true },
      select: { id: true },
      take: 2000,
    });
    if (products.length === 0) return { ok: true, data: { scanned: 0 } };
    await checkAndCreateStockAlertBatch(products.map((p) => p.id));
    try {
      await audit("rescan", "stock_alerts", null, {
        yeni_data: { scanned: products.length },
        sebeb: "Stok xəbərdarlığı yenidən yoxlandı",
      });
    } catch { /* non-fatal */ }
    revalidatePath("/anbar");
    revalidatePath("/xeberdarliqlar");
    bustTicaretCache();
    return { ok: true, data: { scanned: products.length } };
  });
}
