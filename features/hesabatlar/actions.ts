"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import {
  requireHesabatActionPerm,
  bustHesabatCache,
  reportTemplateKey,
} from "./access-guard";
import { getCustomersForExport, type CustomerSegment } from "./musteri-queries";
import { getStaffPerformance } from "./emekdas-queries";
import { parseDateRange } from "./shared";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * CSV-friendly escape — vergül və quote-ları düzgün escape edir.
 */
function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const head = headers.join(",");
  const lines = rows.map((r) => headers.map((h) => csvCell(r[h])).join(","));
  return [head, ...lines].join("\n");
}

// ============================================================
// 1) MÜŞTƏRİ CSV EXPORT — PII audit ilə
// ============================================================

const CustomerExportSchema = z.object({
  segment: z.enum(["all", "vip", "aktiv", "yatmis", "borclu"]).default("all"),
  limit: z.coerce.number().int().min(1).max(5000).default(5000),
});

export async function exportCustomersCsv(
  input: z.input<typeof CustomerExportSchema>,
): Promise<ActionResult<{ csv: string; count: number; filename: string }>> {
  const permCheck = await requireHesabatActionPerm(["musteri.oxu", "hesabat.view"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = CustomerExportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    try {
      const rows = await getCustomersForExport(d.segment as CustomerSegment, d.limit);
      const csv = rowsToCsv(
        ["ad", "telefon", "email", "sheher", "ltv", "borc"],
        rows.map((r) => ({
          ad: r.ad,
          telefon: r.telefon ?? "",
          email: r.email ?? "",
          sheher: r.sheher ?? "",
          ltv: r.ltv,
          borc: r.borc,
        })) as Record<string, unknown>[],
      );
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `musteriler-${d.segment}-${stamp}.csv`;
      // 💰 PII audit — kim, nə vaxt, hansı seqmenti çıxardı
      await audit("export", "musteri_csv", null, {
        yeni_data: { segment: d.segment, sayi: rows.length, format: "csv" },
        sebeb: `Müştəri CSV export: ${d.segment} (${rows.length} sətir)`,
      });
      return { ok: true, data: { csv, count: rows.length, filename } };
    } catch (e) {
      console.error("[exportCustomersCsv]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Export alınmadı: ${msg}` };
    }
  });
}

// ============================================================
// 2) ƏMƏKDAŞ PERFORMANS CSV EXPORT
// ============================================================

const StaffExportSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  preset: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export async function exportStaffPerformanceCsv(
  input: z.input<typeof StaffExportSchema>,
): Promise<ActionResult<{ csv: string; count: number; filename: string }>> {
  // İşçi PII + maaş datası → əlavə icaze tələbi
  const permCheck = await requireHesabatActionPerm(["isci.view", "maas.view"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = StaffExportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };

  return withTenant(async () => {
    try {
      const range = parseDateRange({
        from: parsed.data.from,
        to: parsed.data.to,
        preset: parsed.data.preset,
      });
      const rows = await getStaffPerformance(range, parsed.data.limit);
      const csv = rowsToCsv(
        ["ad_soyad", "vezife", "sifaris_sayi", "gelir", "marja", "hedef_faiz"],
        rows as unknown as Record<string, unknown>[],
      );
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `emekdas-performans-${stamp}.csv`;
      await audit("export", "emekdas_csv", null, {
        yeni_data: { sayi: rows.length, from: parsed.data.from, to: parsed.data.to },
        sebeb: `Əməkdaş performans CSV export (${rows.length} sətir)`,
      });
      return { ok: true, data: { csv, count: rows.length, filename } };
    } catch (e) {
      console.error("[exportStaffPerformanceCsv]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Export alınmadı: ${msg}` };
    }
  });
}

// ============================================================
// 3) SAXLANILMIŞ ŞABLON (FAVORITE FILTERS)
// ============================================================

const SaveTemplateSchema = z.object({
  name: z.string().min(2).max(60),
  report: z.string().min(2).max(40), // "satis", "maliyye", "musteri" və s.
  filters: z.record(z.string(), z.unknown()),
});

export async function saveReportTemplate(
  input: z.input<typeof SaveTemplateSchema>,
): Promise<ActionResult<{ key: string }>> {
  const permCheck = await requireHesabatActionPerm("hesabat.view");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = SaveTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const acar = reportTemplateKey(istifadeciId, parsed.data.name);
    const deyer = JSON.stringify({
      name: parsed.data.name,
      report: parsed.data.report,
      filters: parsed.data.filters,
      yaradildi: new Date().toISOString(),
    });
    await prisma.ayarlar.upsert({
      where: {
        sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "hesabat_sablon", acar },
      },
      create: { sahibkar_id: sahibkarId, qrup: "hesabat_sablon", acar, deyer, nov: "json" },
      update: { deyer, yenilendi: new Date() },
    });
    bustHesabatCache();
    await audit("yarat", "hesabat_sablon", acar, {
      yeni_data: { name: parsed.data.name, report: parsed.data.report },
      sebeb: `Hesabat şablonu saxlandı: ${parsed.data.name}`,
    });
    return { ok: true, data: { key: acar } };
  });
}

export type ReportTemplate = {
  key: string;
  name: string;
  report: string;
  filters: Record<string, unknown>;
  yaradildi: string;
};

export async function getReportTemplates(): Promise<
  ActionResult<{ templates: ReportTemplate[] }>
> {
  const permCheck = await requireHesabatActionPerm("hesabat.view");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: {
        sahibkar_id: sahibkarId,
        qrup: "hesabat_sablon",
        acar: { startsWith: `${istifadeciId}:` },
      },
      orderBy: { yenilendi: "desc" },
      take: 100,
    });
    const templates: ReportTemplate[] = [];
    for (const r of rows) {
      if (!r.deyer) continue;
      try {
        const p = JSON.parse(r.deyer);
        templates.push({
          key: r.acar,
          name: p.name ?? "—",
          report: p.report ?? "—",
          filters: p.filters ?? {},
          yaradildi: p.yaradildi ?? r.yenilendi?.toISOString() ?? "",
        });
      } catch { /* skip */ }
    }
    return { ok: true, data: { templates } };
  });
}

export async function deleteReportTemplate(key: string): Promise<ActionResult> {
  const permCheck = await requireHesabatActionPerm("hesabat.view");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    // Yalnız öz şablonunu silə bilər
    if (!key.startsWith(`${istifadeciId}:`)) {
      return { ok: false, error: "Bu şablon başqasına aiddir" };
    }
    await prisma.ayarlar.deleteMany({
      where: { sahibkar_id: sahibkarId, qrup: "hesabat_sablon", acar: key },
    });
    bustHesabatCache();
    await audit("sil", "hesabat_sablon", key, { sebeb: "Şablon silindi" });
    return { ok: true };
  });
}

// ============================================================
// 4) SEVİMLİ HESABATLAR (toggle)
// ============================================================

const ToggleFavoriteSchema = z.object({
  report: z.string().min(2).max(40),
});

export async function toggleReportFavorite(
  input: z.input<typeof ToggleFavoriteSchema>,
): Promise<ActionResult<{ favored: boolean }>> {
  const permCheck = await requireHesabatActionPerm("hesabat.view");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = ToggleFavoriteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const acar = `${istifadeciId}:favorites`;
    const existing = await prisma.ayarlar.findFirst({
      where: { sahibkar_id: sahibkarId, qrup: "hesabat_favoriler", acar },
      select: { deyer: true },
    });
    const favorites = new Set<string>();
    if (existing?.deyer) {
      try {
        const parsed_ = JSON.parse(existing.deyer);
        if (Array.isArray(parsed_)) {
          for (const v of parsed_) if (typeof v === "string") favorites.add(v);
        }
      } catch { /* skip */ }
    }
    const wasFav = favorites.has(parsed.data.report);
    if (wasFav) favorites.delete(parsed.data.report);
    else favorites.add(parsed.data.report);
    await prisma.ayarlar.upsert({
      where: {
        sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "hesabat_favoriler", acar },
      },
      create: {
        sahibkar_id: sahibkarId, qrup: "hesabat_favoriler", acar,
        deyer: JSON.stringify(Array.from(favorites)), nov: "json",
      },
      update: { deyer: JSON.stringify(Array.from(favorites)), yenilendi: new Date() },
    });
    revalidatePath("/hesabatlar");
    bustHesabatCache();
    return { ok: true, data: { favored: !wasFav } };
  });
}

export async function getReportFavorites(): Promise<ActionResult<{ favorites: string[] }>> {
  const permCheck = await requireHesabatActionPerm("hesabat.view");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const row = await prisma.ayarlar.findFirst({
      where: { sahibkar_id: sahibkarId, qrup: "hesabat_favoriler", acar: `${istifadeciId}:favorites` },
      select: { deyer: true },
    });
    if (!row?.deyer) return { ok: true, data: { favorites: [] } };
    try {
      const parsed = JSON.parse(row.deyer);
      return {
        ok: true,
        data: { favorites: Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [] },
      };
    } catch {
      return { ok: true, data: { favorites: [] } };
    }
  });
}

// ============================================================
// 5) HESABATI EMAİLLƏ GÖNDƏRMƏK ÜÇÜN PLAN SAXLA
// ============================================================

const ScheduleEmailSchema = z.object({
  report: z.string().min(2).max(40),
  frequency: z.enum(["gunluk", "heftelik", "ayliq"]),
  email: z.string().email(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export async function scheduleReportEmail(
  input: z.input<typeof ScheduleEmailSchema>,
): Promise<ActionResult<{ key: string }>> {
  const permCheck = await requireHesabatActionPerm(["hesabat.idare", "hesabat.view"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = ScheduleEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const acar = `${istifadeciId}:${parsed.data.report}:${parsed.data.frequency}`;
    const deyer = JSON.stringify({
      report: parsed.data.report,
      frequency: parsed.data.frequency,
      email: parsed.data.email,
      filters: parsed.data.filters ?? {},
      yaradildi: new Date().toISOString(),
    });
    await prisma.ayarlar.upsert({
      where: {
        sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "hesabat_email", acar },
      },
      create: { sahibkar_id: sahibkarId, qrup: "hesabat_email", acar, deyer, nov: "json" },
      update: { deyer, yenilendi: new Date() },
    });
    bustHesabatCache();
    await audit("yarat", "hesabat_email_plan", acar, {
      yeni_data: { report: parsed.data.report, frequency: parsed.data.frequency },
      sebeb: `Email planı yaradıldı: ${parsed.data.report} (${parsed.data.frequency})`,
    });
    return { ok: true, data: { key: acar } };
  });
}

// ============================================================
// 6) HESABATI PAYLAŞMA (read-only token)
// ============================================================

const ShareSchema = z.object({
  report: z.string().min(2).max(40),
  filters: z.record(z.string(), z.unknown()).optional(),
  expire_saat: z.coerce.number().int().min(1).max(720).default(24),
});

export async function shareReport(
  input: z.input<typeof ShareSchema>,
): Promise<ActionResult<{ token: string; expire_at: string; url: string }>> {
  const permCheck = await requireHesabatActionPerm(["hesabat.idare", "hesabat.view"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = ShareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const token = randomBytes(24).toString("base64url");
    const expireAt = new Date(Date.now() + parsed.data.expire_saat * 3600_000);
    const acar = token;
    const deyer = JSON.stringify({
      token,
      report: parsed.data.report,
      filters: parsed.data.filters ?? {},
      yaradan_id: istifadeciId,
      yaradildi: new Date().toISOString(),
      expire_at: expireAt.toISOString(),
    });
    await prisma.ayarlar.create({
      data: { sahibkar_id: sahibkarId, qrup: "hesabat_share", acar, deyer, nov: "json" },
    });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const url = `${baseUrl}/hesabatlar/share/${token}`;
    await audit("paylas", "hesabat_share", token, {
      yeni_data: { report: parsed.data.report, expire_saat: parsed.data.expire_saat },
      sebeb: `Hesabat paylaşıldı: ${parsed.data.report}`,
    });
    return { ok: true, data: { token, expire_at: expireAt.toISOString(), url } };
  });
}

/**
 * Paylaşılan token-ı oxu (public-safe). Yalnız expire-dən əvvəl, tenant filter ilə.
 */
export async function getSharedReport(
  token: string,
): Promise<ActionResult<{ report: string; filters: Record<string, unknown>; expire_at: string }>> {
  if (!token || token.length < 16) return { ok: false, error: "Yanlış token" };
  return withTenant(async () => {
    const row = await prisma.ayarlar.findFirst({
      where: { qrup: "hesabat_share", acar: token },
      select: { deyer: true },
    });
    if (!row?.deyer) return { ok: false, error: "Tapılmadı və ya vaxtı keçib" };
    try {
      const p = JSON.parse(row.deyer);
      if (p.expire_at && new Date(p.expire_at) < new Date()) {
        return { ok: false, error: "Token vaxtı keçib" };
      }
      return {
        ok: true,
        data: {
          report: p.report ?? "",
          filters: p.filters ?? {},
          expire_at: p.expire_at ?? "",
        },
      };
    } catch {
      return { ok: false, error: "Yanlış format" };
    }
  });
}

// ============================================================
// 7) PERIOD-OVER-PERIOD MÜQAYİSƏ
// ============================================================

const ComparePeriodsSchema = z.object({
  metric: z.enum(["satis_cemi", "marja", "mehsul_sayi", "musteri_sayi"]),
  from1: z.string(),
  to1: z.string(),
  from2: z.string(),
  to2: z.string(),
});

export async function compareReportPeriods(
  input: z.input<typeof ComparePeriodsSchema>,
): Promise<
  ActionResult<{
    metric: string;
    period1: { from: string; to: string; value: number };
    period2: { from: string; to: string; value: number };
    delta_pct: number;
  }>
> {
  const permCheck = await requireHesabatActionPerm("hesabat.view");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = ComparePeriodsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const p1from = new Date(d.from1);
      const p1to = new Date(d.to1);
      const p2from = new Date(d.from2);
      const p2to = new Date(d.to2);
      if ([p1from, p1to, p2from, p2to].some((dt) => Number.isNaN(dt.getTime()))) {
        return { ok: false, error: "Tarix yanlışdır" };
      }

      async function getValue(from: Date, to: Date): Promise<number> {
        if (d.metric === "satis_cemi") {
          const r = await prisma.satis_sifarisleri.aggregate({
            where: { tarix: { gte: from, lte: to }, status: { not: "legv" } },
            _sum: { son_mebleg: true },
          });
          return Number(r._sum.son_mebleg ?? 0);
        }
        if (d.metric === "mehsul_sayi") {
          const r = await prisma.satis_sifaris_satirlari.aggregate({
            where: {
              satis_sifarisleri: { tarix: { gte: from, lte: to }, status: { not: "legv" } },
            },
            _sum: { miqdar: true },
          });
          return Number(r._sum.miqdar ?? 0);
        }
        if (d.metric === "musteri_sayi") {
          const rows = await prisma.satis_sifarisleri.findMany({
            where: { tarix: { gte: from, lte: to }, status: { not: "legv" }, musteri_id: { not: null } },
            select: { musteri_id: true },
            distinct: ["musteri_id"],
          });
          return rows.length;
        }
        // marja
        const r = await prisma.$queryRaw<{ marja: number }[]>`
          SELECT COALESCE(
            (SUM(sls.cemi) - SUM(sls.miqdar * COALESCE(m.alish_qiymeti, 0))) /
            NULLIF(SUM(sls.cemi), 0) * 100, 0)::float AS marja
            FROM satis_sifaris_satirlari sls
            JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
            JOIN mehsullar m ON m.id = sls.mehsul_id
           WHERE sls.sahibkar_id = ${sahibkarId}::uuid
             AND ss.tarix >= ${from} AND ss.tarix <= ${to}
             AND ss.status != 'legv'
        `.catch(() => [{ marja: 0 }]);
        return Number(r[0]?.marja ?? 0);
      }

      const [v1, v2] = await Promise.all([
        getValue(p1from, p1to),
        getValue(p2from, p2to),
      ]);
      const delta_pct = v2 !== 0 ? Math.round(((v1 - v2) / Math.abs(v2)) * 1000) / 10 : 0;
      return {
        ok: true,
        data: {
          metric: d.metric,
          period1: { from: d.from1, to: d.to1, value: v1 },
          period2: { from: d.from2, to: d.to2, value: v2 },
          delta_pct,
        },
      };
    } catch (e) {
      console.error("[compareReportPeriods]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Müqayisə alınmadı: ${msg}` };
    }
  });
}

// ============================================================
// 8) HESABAT ŞABLON LISTESİ — ümumi şirkət şablonları
// ============================================================

export type CompanyReportTemplate = {
  key: string;
  ad: string;
  tesvir: string;
  href: string;
  icon: string;
};

const BUILT_IN_TEMPLATES: CompanyReportTemplate[] = [
  { key: "exec_summary", ad: "Yönətici icmalı", tesvir: "Aylıq gəlir, marja, top 5 məhsul", href: "/hesabatlar?preset=ay", icon: "Activity" },
  { key: "pl_summary", ad: "P&L (Gəlir/Xərc)", tesvir: "Mənfəət və zərər", href: "/hesabatlar/maliyye", icon: "Receipt" },
  { key: "cash_flow", ad: "Cash flow", tesvir: "30 gün pul axını", href: "/hesabatlar/pul", icon: "Banknote" },
  { key: "top_customers", ad: "Top müştərilər", tesvir: "LTV-ə görə top 50", href: "/hesabatlar/musteri", icon: "Users" },
  { key: "abc_analysis", ad: "ABC analiz", tesvir: "Məhsul kateqoriyası 80/20", href: "/hesabatlar/mehsul", icon: "BarChart3" },
  { key: "marja_summary", ad: "Marja", tesvir: "Maya vs satış marjası", href: "/hesabatlar/marja", icon: "Percent" },
];

export async function getBuiltInTemplates(): Promise<{ ok: true; templates: CompanyReportTemplate[] }> {
  return { ok: true, templates: BUILT_IN_TEMPLATES };
}
