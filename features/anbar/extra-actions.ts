"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireAnbarActionPerm, bustAnbarCache } from "./access-guard";
import { safeUserMessage } from "@/lib/error/user-message";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

// ============================================================
// YENİ FUNKSIONALLIQ — Anbar dashboard, reports, bulk ops
// ============================================================

/**
 * 1) Stok anomali hesabatı — mənfi stok, sıfır stok + aktiv, qiymət-marja səhv.
 */
export type StockAnomaly = {
  id: string;
  ad: string;
  problem: "menfi_stok" | "sifir_stok_aktiv" | "maya_yox" | "satis_qiymet_yox" | "satis_mayadan_az";
  detal: string;
};

export async function getStockAnomalyReport(): Promise<
  ActionResult<{ count: number; anomalies: StockAnomaly[] }>
> {
  const permCheck = await requireAnbarActionPerm(["anbar.oxu", "anbar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const anomalies: StockAnomaly[] = [];
      const negStock = await prisma.$queryRaw<{ id: string; ad: string; qaliq: number }[]>`
        SELECT m.id::text, m.ad, COALESCE(SUM(s.miqdar), 0)::float AS qaliq
          FROM mehsullar m
          LEFT JOIN stok s ON s.mehsul_id = m.id AND s.sahibkar_id = ${sahibkarId}::uuid
         WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = true
         GROUP BY m.id, m.ad
        HAVING COALESCE(SUM(s.miqdar), 0) < 0
         LIMIT 200
      `.catch(() => []);
      for (const r of negStock) {
        anomalies.push({ id: r.id, ad: r.ad, problem: "menfi_stok", detal: `Stok: ${r.qaliq}` });
      }

      const noCost = await prisma.mehsullar.findMany({
        where: { aktiv: true, OR: [{ alish_qiymeti: null }, { alish_qiymeti: 0 }] },
        select: { id: true, ad: true },
        take: 200,
      });
      for (const m of noCost) {
        anomalies.push({ id: m.id, ad: m.ad, problem: "maya_yox", detal: "alish_qiymeti = 0 ya null" });
      }

      const noSalePrice = await prisma.mehsullar.findMany({
        where: { aktiv: true, OR: [{ satis_qiymeti: null }, { satis_qiymeti: 0 }] },
        select: { id: true, ad: true },
        take: 200,
      });
      for (const m of noSalePrice) {
        anomalies.push({ id: m.id, ad: m.ad, problem: "satis_qiymet_yox", detal: "satis_qiymeti = 0 ya null" });
      }

      // satış < maya
      const underCost = await prisma.$queryRaw<{ id: string; ad: string; satis: number; maya: number }[]>`
        SELECT m.id::text, m.ad,
               COALESCE(m.satis_qiymeti, 0)::float AS satis,
               COALESCE(m.alish_qiymeti, 0)::float AS maya
          FROM mehsullar m
         WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = true
           AND COALESCE(m.satis_qiymeti, 0) > 0
           AND COALESCE(m.alish_qiymeti, 0) > 0
           AND COALESCE(m.satis_qiymeti, 0) < COALESCE(m.alish_qiymeti, 0)
         LIMIT 100
      `.catch(() => []);
      for (const r of underCost) {
        anomalies.push({ id: r.id, ad: r.ad, problem: "satis_mayadan_az", detal: `Satış ${r.satis} < Maya ${r.maya}` });
      }

      return { ok: true, data: { count: anomalies.length, anomalies } };
    } catch (e) {
      console.error("[getStockAnomalyReport]", e);
      return { ok: false, error: safeUserMessage(e, "Anomali hesabatı alınmadı") };
    }
  });
}

/**
 * 2) Cost vs margin overview — sahibkar üçün.
 */
export type CostMarginOverview = {
  cemi_mehsul: number;
  cemi_maya_dayer: number;
  cemi_satis_dayer: number;
  ortalama_marja_pct: number;
  yuksek_marja_say: number; // >50%
  asagi_marja_say: number;  // <10%
  marja_yox_say: number;    // satış/maya = 0
};

export async function getCostMarginReport(): Promise<ActionResult<CostMarginOverview>> {
  // Maliyə icazə tələb olunur — kritik finansal məlumat
  const permCheck = await requireAnbarActionPerm(["maliye.view", "qiymet.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const stat = await prisma.$queryRaw<{
        cemi: bigint;
        maya_dayer: number;
        satis_dayer: number;
        ort_marja: number;
        yuksek: bigint;
        asagi: bigint;
        marja_yox: bigint;
      }[]>`
        WITH stok_data AS (
          SELECT m.id,
                 COALESCE(m.alish_qiymeti, 0)::float AS maya,
                 COALESCE(m.satis_qiymeti, 0)::float AS satis,
                 COALESCE(SUM(s.miqdar), 0)::float AS qaliq
            FROM mehsullar m
            LEFT JOIN stok s ON s.mehsul_id = m.id AND s.sahibkar_id = ${sahibkarId}::uuid
           WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = true
           GROUP BY m.id, m.alish_qiymeti, m.satis_qiymeti
        )
        SELECT COUNT(*)::bigint AS cemi,
               COALESCE(SUM(maya * qaliq), 0)::float AS maya_dayer,
               COALESCE(SUM(satis * qaliq), 0)::float AS satis_dayer,
               COALESCE(AVG(CASE WHEN maya > 0 AND satis > 0 THEN ((satis - maya) / maya) * 100 ELSE NULL END), 0)::float AS ort_marja,
               SUM(CASE WHEN maya > 0 AND satis > 0 AND ((satis - maya) / maya) > 0.5 THEN 1 ELSE 0 END)::bigint AS yuksek,
               SUM(CASE WHEN maya > 0 AND satis > 0 AND ((satis - maya) / maya) < 0.1 THEN 1 ELSE 0 END)::bigint AS asagi,
               SUM(CASE WHEN maya = 0 OR satis = 0 THEN 1 ELSE 0 END)::bigint AS marja_yox
          FROM stok_data
      `.catch(() => []);
      const r = stat[0];
      if (!r) {
        return {
          ok: true,
          data: {
            cemi_mehsul: 0, cemi_maya_dayer: 0, cemi_satis_dayer: 0,
            ortalama_marja_pct: 0, yuksek_marja_say: 0, asagi_marja_say: 0, marja_yox_say: 0,
          },
        };
      }
      return {
        ok: true,
        data: {
          cemi_mehsul: Number(r.cemi),
          cemi_maya_dayer: r.maya_dayer,
          cemi_satis_dayer: r.satis_dayer,
          ortalama_marja_pct: Math.round(r.ort_marja * 10) / 10,
          yuksek_marja_say: Number(r.yuksek),
          asagi_marja_say: Number(r.asagi),
          marja_yox_say: Number(r.marja_yox),
        },
      };
    } catch (e) {
      console.error("[getCostMarginReport]", e);
      return { ok: false, error: safeUserMessage(e, "Marja hesabatı alınmadı") };
    }
  });
}

/**
 * 3) Məhsul üzrə qiymət dəyişiklik tarixçəsi (audit_log-dan).
 */
export type PriceHistoryEntry = {
  ts: Date;
  emeliyyat: string;
  resurs_nov: string;
  istifadeci_ad: string | null;
  evvelki_data: unknown;
  yeni_data: unknown;
};

export async function getProductPriceHistory(
  mehsulId: string,
): Promise<ActionResult<{ events: PriceHistoryEntry[] }>> {
  const permCheck = await requireAnbarActionPerm(["anbar.oxu", "qiymet.oxu", "qiymet.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const rows = await prisma.audit_log.findMany({
        where: {
          resurs_id: mehsulId,
          resurs_nov: { in: ["mehsul_qiymet", "mehsul_maya", "mehsul_satis_qiymet"] },
        },
        include: { istifadeciler: { select: { ad_soyad: true } } },
        orderBy: { yaradildi: "desc" },
        take: 50,
      });
      return {
        ok: true,
        data: {
          events: rows.map((r) => ({
            ts: r.yaradildi ?? new Date(),
            emeliyyat: r.emeliyyat,
            resurs_nov: r.resurs_nov,
            istifadeci_ad: r.istifadeciler?.ad_soyad ?? null,
            evvelki_data: r.evvelki_data,
            yeni_data: r.yeni_data,
          })),
        },
      };
    } catch (e) {
      console.error("[getProductPriceHistory]", e);
      return { ok: false, error: safeUserMessage(e, "Qiymət tarixçəsi alınmadı") };
    }
  });
}

/**
 * 4) Toplu arxivlə (məhsul aktiv=false) + säbäb.
 */
export async function bulkArchiveProducts(
  ids: string[],
  sebeb: string,
): Promise<ActionResult<{ count: number }>> {
  const permCheck = await requireAnbarActionPerm(["mehsul.idare", "mehsul.sil"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Seçim yoxdur" };
  if (ids.length > 1000) return { ok: false, error: "1000-dən çox məhsul ola bilməz" };
  if (!sebeb || sebeb.trim().length < 2) return { ok: false, error: "Səbəb məcburidir" };
  return withTenant(async () => {
    try {
      const r = await prisma.mehsullar.updateMany({
        where: { id: { in: ids } },
        data: { aktiv: false },
      });
      revalidatePath("/anbar/mehsullar");
      bustAnbarCache();
      await audit("toplu_arxiv", "mehsul", null, {
        yeni_data: { count: r.count, sebeb: sebeb.trim(), ids_first_10: ids.slice(0, 10) },
        sebeb: `Toplu arxivləmə (${r.count} məhsul): ${sebeb.trim()}`,
      });
      return { ok: true, data: { count: r.count } };
    } catch (e) {
      console.error("[bulkArchiveProducts]", e);
      return { ok: false, error: safeUserMessage(e, "Arxivləmə uğursuz oldu") };
    }
  });
}

/**
 * 5) Məhsul üzrə tam aktivlik feed (audit + hereket).
 */
export type ProductActivity = {
  ts: Date;
  tip: "audit" | "hereket";
  emeliyyat: string;
  detal: string;
};

export async function getProductActivityFeed(
  mehsulId: string,
): Promise<ActionResult<{ events: ProductActivity[] }>> {
  const permCheck = await requireAnbarActionPerm(["anbar.oxu"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const [auditRows, hereketler] = await Promise.all([
        prisma.audit_log.findMany({
          where: { resurs_id: mehsulId, resurs_nov: { startsWith: "mehsul" } },
          orderBy: { yaradildi: "desc" },
          take: 100,
        }),
        prisma.anbar_hereketleri.findMany({
          where: { mehsul_id: mehsulId },
          orderBy: { yaradildi: "desc" },
          take: 100,
        }),
      ]);
      const events: ProductActivity[] = [];
      for (const a of auditRows) {
        events.push({
          ts: a.yaradildi ?? new Date(),
          tip: "audit",
          emeliyyat: a.emeliyyat,
          detal: a.sebeb ?? "",
        });
      }
      for (const h of hereketler) {
        events.push({
          ts: h.yaradildi ?? new Date(),
          tip: "hereket",
          emeliyyat: h.nov ?? "hereket",
          detal: `Miqdar: ${h.miqdar}`,
        });
      }
      events.sort((a, b) => b.ts.getTime() - a.ts.getTime());
      return { ok: true, data: { events: events.slice(0, 100) } };
    } catch (e) {
      console.error("[getProductActivityFeed]", e);
      return { ok: false, error: safeUserMessage(e, "Aktivlik tarixçəsi alınmadı") };
    }
  });
}

/**
 * 6) Anbar dashboard — sahibkar üçün ümumi statistika.
 */
export type AnbarDashboard = {
  cemi_mehsul: number;
  aktiv_mehsul: number;
  cemi_kateqoriya: number;
  cemi_marka: number;
  cemi_anbar: number;
  bron_aktiv: number;
  inventar_acig: number;
  son_24_saat_hereketler: number;
};

export async function getAnbarDashboard(): Promise<ActionResult<AnbarDashboard>> {
  const permCheck = await requireAnbarActionPerm(["anbar.oxu"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const dayAgo = new Date(Date.now() - 86400_000);
      const [cemi, aktiv, kateq, marka, anbar, bron, inventar, hereket] = await Promise.all([
        prisma.mehsullar.count(),
        prisma.mehsullar.count({ where: { aktiv: true } }),
        prisma.kateqoriyalar.count().catch(() => 0),
        prisma.markalar.count().catch(() => 0),
        prisma.anbarlar.count({ where: { aktiv: true } }).catch(() => 0),
        prisma.stok_bron.count({ where: { status: "aktiv" } }).catch(() => 0),
        prisma.inventarizasiyalar.count({ where: { status: { in: ["acig", "isleyir"] } } }).catch(() => 0),
        prisma.anbar_hereketleri.count({ where: { yaradildi: { gte: dayAgo } } }).catch(() => 0),
      ]);
      return {
        ok: true,
        data: {
          cemi_mehsul: cemi,
          aktiv_mehsul: aktiv,
          cemi_kateqoriya: kateq,
          cemi_marka: marka,
          cemi_anbar: anbar,
          bron_aktiv: bron,
          inventar_acig: inventar,
          son_24_saat_hereketler: hereket,
        },
      };
    } catch (e) {
      console.error("[getAnbarDashboard]", e);
      return { ok: false, error: safeUserMessage(e, "Dashboard məlumatı alınmadı") };
    }
  });
}

/**
 * 7) Mehsul CSV export.
 */
function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function bulkExportProducts(
  filter?: { aktiv?: boolean; kateqoriya_id?: number },
): Promise<ActionResult<{ csv: string; count: number; filename: string }>> {
  const permCheck = await requireAnbarActionPerm(["anbar.oxu"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (filter?.aktiv != null) where.aktiv = filter.aktiv;
      if (filter?.kateqoriya_id) where.kateqoriya_id = filter.kateqoriya_id;
      const rows = await prisma.mehsullar.findMany({
        where,
        select: {
          id: true, ad: true, kod: true, barkod: true,
          alish_qiymeti: true, satis_qiymeti: true, endirimli_qiymet: true,
          kritik_stok: true, aktiv: true,
        },
        take: 10000,
        orderBy: { ad: "asc" },
      });
      const headers = ["id", "ad", "kod", "barkod", "alish_qiymeti", "satis_qiymeti", "endirimli_qiymet", "kritik_stok", "aktiv"];
      const head = headers.join(",");
      const lines = rows.map((r) =>
        headers.map((h) => csvCell((r as Record<string, unknown>)[h])).join(","),
      );
      const csv = [head, ...lines].join("\n");
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `mehsullar-${stamp}.csv`;
      await audit("export", "mehsul_csv", null, {
        yeni_data: { count: rows.length, filter: filter ?? {} },
        sebeb: `Məhsul CSV export: ${rows.length} sətir`,
      });
      return { ok: true, data: { csv, count: rows.length, filename } };
    } catch (e) {
      console.error("[bulkExportProducts]", e);
      return { ok: false, error: safeUserMessage(e, "Export alınmadı") };
    }
  });
}

/**
 * 8) Emergency freeze — bütün qiymət dəyişikliklərini blokla.
 * `ayarlar.anbar.qiymet_freeze = true` — POS/qiymet səhifələri yoxlamalıdır.
 */
export async function emergencyFreezePrices(
  freeze: boolean,
): Promise<ActionResult<{ frozen: boolean }>> {
  const permCheck = await requireAnbarActionPerm(["qiymet.idare", "anbar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    await prisma.ayarlar.upsert({
      where: {
        sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "anbar", acar: "qiymet_freeze" },
      },
      create: {
        sahibkar_id: sahibkarId, qrup: "anbar", acar: "qiymet_freeze",
        deyer: freeze ? "1" : "0", nov: "boolean",
      },
      update: { deyer: freeze ? "1" : "0", yenilendi: new Date() },
    });
    revalidatePath("/anbar/qiymet");
    revalidatePath("/pos");
    bustAnbarCache();
    await audit(freeze ? "freeze" : "unfreeze", "anbar_ayar", null, {
      yeni_data: { frozen: freeze },
      sebeb: freeze ? "🔒 Qiymət dəyişiklikləri donduruldu" : "🔓 Qiymət dəyişiklikləri açıldı",
    });
    return { ok: true, data: { frozen: freeze } };
  });
}
