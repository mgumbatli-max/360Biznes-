"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

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
        const updated = await prisma.leads.update({ where: { id: d.id }, data });
        id = updated.id;
      } else {
        const created = await prisma.leads.create({
          data: { sahibkar_id: sahibkarId, yaradan_id: istifadeciId, ...data },
        });
        id = created.id;
      }
      revalidatePath("/crm/leadler");
      revalidatePath("/crm");
      return { ok: true, id };
    } catch (e) {
      console.error("[saveLead]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function changeLeadStage(
  id: string,
  status: "yeni" | "elaqe" | "muzakire" | "teklif" | "qazandi" | "itirdi"
): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      await prisma.leads.update({ where: { id }, data: { status, yenilendi: new Date() } });
      revalidatePath("/crm/leadler");
      revalidatePath("/crm");
      revalidatePath("/crm/funnel");
      return { ok: true };
    } catch (e) {
      console.error("[changeLeadStage]", e);
      return { ok: false, error: "Status dəyişmədi" };
    }
  });
}

export async function bulkChangeLeadStage(
  ids: string[],
  status: "yeni" | "elaqe" | "muzakire" | "teklif" | "qazandi" | "itirdi",
  sebeb?: string
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!ids?.length) return { ok: false, error: "Seçim yoxdur" };
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
      return { ok: true, count: res.count };
    } catch (e) {
      console.error("[bulkChangeLeadStage]", e);
      return { ok: false, error: "Toplu dəyişiklik alınmadı" };
    }
  });
}

export async function deleteLead(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      await prisma.leads.delete({ where: { id } });
      revalidatePath("/crm/leadler");
      revalidatePath("/crm");
      revalidatePath("/crm/funnel");
      return { ok: true };
    } catch (e) {
      console.error("[deleteLead]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

export async function loseLead(id: string, sebeb: string): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      await prisma.leads.update({
        where: { id },
        data: { status: "itirdi", imtina_sebeb: sebeb || null, yenilendi: new Date() },
      });
      revalidatePath("/crm/leadler");
      return { ok: true };
    } catch (e) {
      console.error("[loseLead]", e);
      return { ok: false, error: "Alınmadı" };
    }
  });
}

export async function convertLeadToMusteri(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const lead = await prisma.leads.findFirst({ where: { id } });
      if (!lead) return { ok: false, error: "Lead tapılmadı" };
      if (lead.kontragent_id) {
        return { ok: true, id: lead.kontragent_id };
      }
      const created = await prisma.kontragentler.create({
        data: {
          sahibkar_id: sahibkarId,
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
      return { ok: true, id: created.id };
    } catch (e) {
      console.error("[convertLead]", e);
      return { ok: false, error: "Çevrilmə alınmadı" };
    }
  });
}

/**
 * Lead → satış qaralama avto-konversiya.
 * - Mövcud kontragent_id varsa istifadə edir, əks halda yeni müştəri yaradır.
 * - Boş satış qaralaması yaradır (qaralama=true). Məhsulları lead.qeyd / mehsul_maraq sahəsindən parse edə bilər.
 * - Lead.satish_id yenilənir + status="qazandi".
 * - Audit log atılır.
 */
export async function convertLeadToSale(id: string): Promise<{ ok: true; saleId: string; musteriId: string } | { ok: false; error: string }> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const lead = await prisma.leads.findFirst({ where: { id } });
      if (!lead) return { ok: false, error: "Lead tapılmadı" };
      if (lead.satish_id) {
        return { ok: true, saleId: lead.satish_id, musteriId: lead.kontragent_id ?? "" };
      }

      // 1) Müştəri tap və ya yarat
      let musteriId = lead.kontragent_id;
      if (!musteriId) {
        const k = await prisma.kontragentler.create({
          data: {
            sahibkar_id: sahibkarId,
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

      // 2) Satış nömrəsi (qaralama)
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

      // 3) Lead-i yenilə
      await prisma.leads.update({
        where: { id },
        data: {
          satish_id: sale.id,
          kontragent_id: musteriId,
          status: "qazandi",
          yenilendi: new Date(),
        },
      });

      // 4) Audit
      try {
        await prisma.audit_log.create({
          data: {
            sahibkar_id: sahibkarId,
            istifadeci_id: istifadeciId,
            emeliyyat: "yarat",
            resurs_nov: "lead_konversiya_satis",
            resurs_id: sale.id,
            evvelki_data: { lead_id: id, lead_status: lead.status, kontragent_id: lead.kontragent_id },
            yeni_data: { satis_id: sale.id, satis_nomre: nomre, musteri_id: musteriId, status: "qazandi" },
            status: "ugur",
          },
        });
      } catch (e) {
        console.warn("[convertLeadToSale] audit skipped:", e);
      }

      revalidatePath("/crm/leadler");
      revalidatePath("/crm");
      revalidatePath(`/ticaret/satislar/${sale.id}`);
      revalidatePath("/elaqe/musteriler");
      return { ok: true, saleId: sale.id, musteriId };
    } catch (e) {
      console.error("[convertLeadToSale]", e);
      return { ok: false, error: "Satışa çevrilmə alınmadı" };
    }
  });
}

const NoteSchema = z.object({
  lead_id: z.string().uuid(),
  qeyd: z.string().min(1).max(2000),
});

export async function appendLeadNote(input: FormData): Promise<ActionResult> {
  const parsed = NoteSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Qeyd boşdur" };
  const d = parsed.data;
  return withTenant(async () => {
    try {
      const existing = await prisma.leads.findFirst({ where: { id: d.lead_id }, select: { qeyd: true } });
      const stamp = new Date().toLocaleString("az-AZ");
      const next = [existing?.qeyd ?? "", `\n[${stamp}] ${d.qeyd}`].filter(Boolean).join("");
      await prisma.leads.update({
        where: { id: d.lead_id },
        data: { qeyd: next.trim(), yenilendi: new Date() },
      });
      revalidatePath("/crm/leadler");
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
      return { ok: true };
    } catch (e) {
      console.error("[scheduleFollowup]", e);
      return { ok: false, error: "Saxlanmadı" };
    }
  });
}
