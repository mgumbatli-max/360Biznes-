"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { safeAuditLog } from "@/lib/audit/safe-log";
import { audit } from "@/lib/audit/log";
import { requireCrmActionPerm, bustCrmCache, getCrmScopeFilter } from "./access-guard";

const LeadSchema = z.object({
  id: z.string().uuid().optional(),
  ad: z.string().min(2).max(200),
  telefon: z.string().max(30).optional().or(z.literal("")),
  email: z.string().max(150).optional().or(z.literal("")),
  menbe: z.string().max(40).optional().or(z.literal("")),
  mehsul_maraq: z.string().max(2000).optional().or(z.literal("")),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
  budce: z.coerce.number().min(0).default(0),
  ehtimal: z.coerce.number().int().min(0).max(100).default(50),
  status: z.enum(["yeni", "elaqe", "muzakire", "teklif", "qazandi", "itirdi"]).default("yeni"),
  menecer_id: z.string().uuid().optional().or(z.literal("")),
  novbeti_elaqe: z.string().optional().or(z.literal("")),
});

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function saveLead(input: FormData): Promise<ActionResult> {
  const parsed = LeadSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const isEdit = !!parsed.data.id;
  const permCheck = await requireCrmActionPerm(isEdit ? ["lead.idare", "crm.idare"] : ["lead.yarat", "crm.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const data = {
        ad: d.ad.trim(),
        telefon: d.telefon?.trim() || null,
        email: d.email?.trim() || null,
        menbe: d.menbe?.trim() || null,
        mehsul_maraq: d.mehsul_maraq?.trim() || null,
        qeyd: d.qeyd?.trim() || null,
        budce: d.budce,
        ehtimal: d.ehtimal,
        status: d.status,
        menecer_id: d.menecer_id || null,
        novbeti_elaqe: d.novbeti_elaqe ? new Date(d.novbeti_elaqe) : null,
        yenilendi: new Date(),
      };
      let id: string;
      if (d.id) {
        // Mövcud lead-i yoxla — adi user yalnız öz menecer-i olduqlarına dəyişə bilər
        const scope = await getCrmScopeFilter();
        const existing = await prisma.leads.findFirst({
          where: { id: d.id },
          select: { menecer_id: true, status: true, ad: true },
        });
        if (!existing) return { ok: false, error: "Lead tapılmadı" };
        if (!scope.privileged && existing.menecer_id && existing.menecer_id !== istifadeciId) {
          return { ok: false, error: "Bu lead başqa menecerə təyin olunub" };
        }
        const updated = await prisma.leads.update({ where: { id: d.id }, data });
        id = updated.id;
        await audit("yenile", "lead", id, {
          evvelki_data: { status: existing.status, ad: existing.ad },
          yeni_data: { status: d.status, ad: d.ad, ehtimal: d.ehtimal, budce: d.budce },
          sebeb: "Lead yeniləndi",
        });
      } else {
        const created = await prisma.leads.create({
          data: { sahibkar_id: sahibkarId, yaradan_id: istifadeciId, ...data },
        });
        id = created.id;
        await audit("yarat", "lead", id, {
          yeni_data: { ad: d.ad, menbe: d.menbe || null, status: d.status, menecer_id: d.menecer_id || null },
          sebeb: "Yeni lead yaradıldı",
        });
      }
      revalidatePath("/crm/leadler");
      revalidatePath("/crm");
      bustCrmCache();
      return { ok: true, id };
    } catch (e) {
      console.error("[saveLead]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yadda saxlanmadı: ${msg}` };
    }
  });
}

export async function changeLeadStage(
  id: string,
  status: "yeni" | "elaqe" | "muzakire" | "teklif" | "qazandi" | "itirdi"
): Promise<ActionResult> {
  const permCheck = await requireCrmActionPerm(["lead.idare", "crm.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const before = await prisma.leads.findFirst({ where: { id }, select: { status: true, ad: true, menecer_id: true } });
      if (!before) return { ok: false, error: "Lead tapılmadı" };
      const scope = await getCrmScopeFilter();
      if (!scope.privileged && before.menecer_id && before.menecer_id !== scope.istifadeciId) {
        return { ok: false, error: "Bu lead başqa menecerə təyin olunub" };
      }
      await prisma.leads.update({ where: { id }, data: { status, yenilendi: new Date() } });
      revalidatePath("/crm/leadler");
      revalidatePath("/crm");
      revalidatePath("/crm/funnel");
      bustCrmCache();
      await audit("status_deyis", "lead", id, {
        evvelki_data: { status: before.status },
        yeni_data: { status, ad: before.ad },
        sebeb: `Lead statusu: ${before.status} → ${status}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[changeLeadStage]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Status dəyişmədi: ${msg}` };
    }
  });
}

export async function bulkChangeLeadStage(
  ids: string[],
  status: "yeni" | "elaqe" | "muzakire" | "teklif" | "qazandi" | "itirdi",
  sebeb?: string
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const permCheck = await requireCrmActionPerm(["lead.idare", "crm.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!ids?.length) return { ok: false, error: "Seçim yoxdur" };
  if (ids.length > 500) return { ok: false, error: "Bir dəfəyə 500-dən çox lead ola bilməz" };
  if (status === "itirdi" && (!sebeb || sebeb.trim().length < 2)) {
    return { ok: false, error: "İtirilmiş status üçün səbəb məcburidir" };
  }
  return withTenant(async () => {
    try {
      const data: Record<string, unknown> = { status, yenilendi: new Date() };
      if (status === "itirdi" && sebeb) data.imtina_sebeb = sebeb;
      const res = await prisma.leads.updateMany({
        where: { id: { in: ids } },
        data,
      });
      revalidatePath("/crm/leadler");
      revalidatePath("/crm/funnel");
      revalidatePath("/crm");
      bustCrmCache();
      await audit("bulk_status", "lead", null, {
        yeni_data: { status, count: res.count, ids_sayi: ids.length, sebeb: sebeb ?? null },
        sebeb: `Bulk lead status: ${status}`,
      });
      return { ok: true, count: res.count };
    } catch (e) {
      console.error("[bulkChangeLeadStage]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Toplu dəyişiklik alınmadı: ${msg}` };
    }
  });
}

/**
 * Soft delete — lead-i arxivlə (hard delete əvəzinə).
 */
export async function deleteLead(id: string): Promise<ActionResult> {
  const permCheck = await requireCrmActionPerm("lead.sil");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const before = await prisma.leads.findFirst({
        where: { id },
        select: { ad: true, status: true, telefon: true, email: true, menecer_id: true },
      });
      if (!before) return { ok: false, error: "Lead tapılmadı" };
      // Soft delete: status="silinib" + arxivlendi
      await prisma.leads.update({
        where: { id },
        data: { status: "silinib", yenilendi: new Date() },
      });
      revalidatePath("/crm/leadler");
      revalidatePath("/crm");
      revalidatePath("/crm/funnel");
      bustCrmCache();
      await audit("sil", "lead", id, {
        evvelki_data: { status: before.status, ad: before.ad, telefon: before.telefon, email: before.email, menecer_id: before.menecer_id },
        yeni_data: { status: "silinib" },
        sebeb: `Lead arxivləndi: ${before.ad}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[deleteLead]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Arxivlənmədi: ${msg}` };
    }
  });
}

export async function loseLead(id: string, sebeb: string): Promise<ActionResult> {
  const permCheck = await requireCrmActionPerm(["lead.idare", "crm.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!sebeb || sebeb.trim().length < 2) {
    return { ok: false, error: "Səbəb məcburidir" };
  }
  return withTenant(async () => {
    try {
      const before = await prisma.leads.findFirst({ where: { id }, select: { status: true, ad: true } });
      if (!before) return { ok: false, error: "Lead tapılmadı" };
      await prisma.leads.update({
        where: { id },
        data: { status: "itirdi", imtina_sebeb: sebeb || null, yenilendi: new Date() },
      });
      revalidatePath("/crm/leadler");
      revalidatePath("/crm");
      bustCrmCache();
      await audit("status_deyis", "lead", id, {
        evvelki_data: { status: before.status },
        yeni_data: { status: "itirdi", imtina_sebeb: sebeb, ad: before.ad },
        sebeb: `İtirildi: ${sebeb}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[loseLead]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}

export async function convertLeadToMusteri(id: string): Promise<ActionResult> {
  const permCheck = await requireCrmActionPerm(["lead.idare", "crm.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const lead = await prisma.leads.findFirst({ where: { id } });
      if (!lead) return { ok: false, error: "Lead tapılmadı" };
      if (lead.kontragent_id) {
        return { ok: true, id: lead.kontragent_id };
      }
      const getirdi = lead.menecer_id ?? istifadeciId;
      const created = await prisma.kontragentler.create({
        data: {
          sahibkar_id: sahibkarId,
          getirdi_id: getirdi,
          nov: "musteri",
          ad: lead.ad ?? "Müştəri",
          telefon: lead.telefon,
          email: lead.email,
          qaynaq: lead.menbe,
          menecer_id: lead.menecer_id,
          qiymet_tipi: "adi",
        },
      });
      await prisma.leads.update({
        where: { id },
        data: { kontragent_id: created.id, yenilendi: new Date() },
      });
      revalidatePath("/crm/leadler");
      revalidatePath("/elaqe/musteriler");
      bustCrmCache();
      await audit("konvert", "lead", id, {
        yeni_data: { kontragent_id: created.id, lead_ad: lead.ad },
        sebeb: "Lead müştəriyə çevrildi",
      });
      return { ok: true, id: created.id };
    } catch (e) {
      console.error("[convertLead]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Çevrilmə alınmadı: ${msg}` };
    }
  });
}

/**
 * Lead → satış qaralama avto-konversiya.
 */
export async function convertLeadToSale(id: string): Promise<{ ok: true; saleId: string; musteriId: string } | { ok: false; error: string }> {
  const permCheck = await requireCrmActionPerm(["lead.idare", "crm.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const lead = await prisma.leads.findFirst({ where: { id } });
      if (!lead) return { ok: false, error: "Lead tapılmadı" };
      if (lead.satish_id) {
        return { ok: true, saleId: lead.satish_id, musteriId: lead.kontragent_id ?? "" };
      }

      let musteriId = lead.kontragent_id;
      if (!musteriId) {
        const k = await prisma.kontragentler.create({
          data: {
            sahibkar_id: sahibkarId,
            getirdi_id: lead.menecer_id ?? istifadeciId,
            nov: "musteri",
            ad: lead.ad ?? "Müştəri",
            telefon: lead.telefon,
            email: lead.email,
            qaynaq: lead.menbe,
            menecer_id: lead.menecer_id,
            qiymet_tipi: "adi",
          },
        });
        musteriId = k.id;
      }

      const stamp = new Date();
      const yy = String(stamp.getFullYear()).slice(2);
      const mm = String(stamp.getMonth() + 1).padStart(2, "0");
      const rand = Math.floor(Math.random() * 9000 + 1000);
      const nomre = `LEAD-${yy}${mm}-${rand}`;

      const sale = await prisma.satis_sifarisleri.create({
        data: {
          sahibkar_id: sahibkarId,
          nomre,
          musteri_id: musteriId,
          status: "yeni",
          qaralama: true,
          umumi_mebleg: Number(lead.budce ?? 0),
          son_mebleg: Number(lead.budce ?? 0),
          odenilmis: 0,
          satis_meneceri_id: lead.menecer_id,
          yaradan_id: istifadeciId,
          qeyd: [lead.mehsul_maraq, lead.qeyd].filter(Boolean).join("\n---\n") || null,
          xeber_qeydi: `Lead-dən avto-yaradıldı (lead ${id})`,
        },
      });

      await prisma.leads.update({
        where: { id },
        data: {
          satish_id: sale.id,
          kontragent_id: musteriId,
          status: "qazandi",
          yenilendi: new Date(),
        },
      });

      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "yarat",
        resurs_nov: "lead_konversiya_satis",
        resurs_id: sale.id,
        evvelki_data: { lead_id: id, lead_status: lead.status, kontragent_id: lead.kontragent_id },
        yeni_data: { satis_id: sale.id, satis_nomre: nomre, musteri_id: musteriId, status: "qazandi" },
        status: "ugur",
      });

      revalidatePath("/crm/leadler");
      revalidatePath("/crm");
      revalidatePath(`/ticaret/satislar/${sale.id}`);
      revalidatePath("/elaqe/musteriler");
      bustCrmCache();
      return { ok: true, saleId: sale.id, musteriId };
    } catch (e) {
      console.error("[convertLeadToSale]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Satışa çevrilmə alınmadı: ${msg}` };
    }
  });
}

const NoteSchema = z.object({
  lead_id: z.string().uuid(),
  qeyd: z.string().min(1).max(2000),
});

export async function appendLeadNote(input: FormData): Promise<ActionResult> {
  const permCheck = await requireCrmActionPerm(["lead.idare", "crm.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = NoteSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Qeyd boşdur" };
  const d = parsed.data;
  return withTenant(async () => {
    try {
      const existing = await prisma.leads.findFirst({ where: { id: d.lead_id }, select: { qeyd: true, ad: true } });
      if (!existing) return { ok: false, error: "Lead tapılmadı" };
      const stamp = new Date().toLocaleString("az-AZ");
      const next = [existing.qeyd ?? "", `\n[${stamp}] ${d.qeyd}`].filter(Boolean).join("");
      await prisma.leads.update({
        where: { id: d.lead_id },
        data: { qeyd: next.trim(), yenilendi: new Date() },
      });
      revalidatePath("/crm/leadler");
      bustCrmCache();
      await audit("qeyd_elave", "lead", d.lead_id, {
        yeni_data: { lead_ad: existing.ad, qeyd_uzunluq: d.qeyd.length },
        sebeb: "Lead-ə qeyd əlavə edildi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[appendLeadNote]", e);
      return { ok: false, error: "Qeyd əlavə olunmadı" };
    }
  });
}

const FollowupSchema = z.object({
  lead_id: z.string().uuid(),
  tarix: z.string().min(1),
});

export async function scheduleFollowup(input: FormData): Promise<ActionResult> {
  const permCheck = await requireCrmActionPerm(["lead.idare", "crm.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = FollowupSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Tarix yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    try {
      await prisma.leads.update({
        where: { id: d.lead_id },
        data: { novbeti_elaqe: new Date(d.tarix), yenilendi: new Date() },
      });
      revalidatePath("/crm/leadler");
      revalidatePath("/crm");
      bustCrmCache();
      await audit("follow_up", "lead", d.lead_id, {
        yeni_data: { novbeti_elaqe: new Date(d.tarix).toISOString() },
        sebeb: "Növbəti əlaqə təyin edildi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[scheduleFollowup]", e);
      return { ok: false, error: "Saxlanmadı" };
    }
  });
}

// ============================================================
// YENİ FUNKSIONALLIQ
// ============================================================

export type LeadActivity = {
  ts: Date;
  emeliyyat: string;
  sebeb: string | null;
  istifadeci_id: string | null;
  istifadeci_ad: string | null;
};

/**
 * Lead-in tarixçə feed-i — audit_log-dan bütün hadisələri qaytarır.
 */
export async function getLeadActivityFeed(
  leadId: string,
): Promise<{ ok: true; events: LeadActivity[] } | { ok: false; error: string }> {
  const permCheck = await requireCrmActionPerm(["crm.oxu"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const rows = await prisma.audit_log.findMany({
        where: { resurs_nov: "lead", resurs_id: leadId },
        orderBy: { yaradildi: "desc" },
        take: 100,
        include: { istifadeciler: { select: { ad_soyad: true } } },
      });
      return {
        ok: true,
        events: rows.map((r) => ({
          ts: r.yaradildi ?? new Date(),
          emeliyyat: r.emeliyyat,
          sebeb: r.sebeb,
          istifadeci_id: r.istifadeci_id,
          istifadeci_ad: r.istifadeciler?.ad_soyad ?? null,
        })),
      };
    } catch (e) {
      console.error("[getLeadActivityFeed]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}

/**
 * Lead CSV export.
 */
export async function bulkExportLeads(
  status?: string,
): Promise<{ ok: true; csv: string; count: number } | { ok: false; error: string }> {
  const permCheck = await requireCrmActionPerm(["crm.oxu", "crm.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const scope = await getCrmScopeFilter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (status) where.status = status;
      if (!scope.privileged && scope.istifadeciId) {
        where.menecer_id = scope.istifadeciId;
      }
      const rows = await prisma.leads.findMany({
        where,
        select: { id: true, ad: true, telefon: true, email: true, menbe: true, budce: true, ehtimal: true, status: true, novbeti_elaqe: true, yaradildi: true },
        orderBy: { yaradildi: "desc" },
        take: 5000,
      });
      const header = ["id", "ad", "telefon", "email", "menbe", "budce", "ehtimal", "status", "novbeti_elaqe", "yaradildi"].join(",");
      const lines = rows.map((r) => [
        r.id,
        `"${(r.ad ?? "").replace(/"/g, '""')}"`,
        r.telefon ?? "",
        r.email ?? "",
        r.menbe ?? "",
        String(r.budce ?? 0),
        String(r.ehtimal ?? 0),
        r.status ?? "",
        r.novbeti_elaqe?.toISOString() ?? "",
        r.yaradildi?.toISOString() ?? "",
      ].join(","));
      const csv = [header, ...lines].join("\n");
      await audit("export", "lead", null, {
        yeni_data: { count: rows.length, status: status ?? null },
        sebeb: "Lead CSV export",
      });
      return { ok: true, csv, count: rows.length };
    } catch (e) {
      console.error("[bulkExportLeads]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Export alınmadı: ${msg}` };
    }
  });
}
