"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/audit/log";
import { deleteEntry, getEntry, listEntries, nextId, setEntry } from "./hr-store";
import type { Namized, Vakansiya } from "./vakansiya-queries";
import { requireHrActionPerm, bustHrCache } from "./access-guard";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const VakansiyaSchema = z.object({
  id: z.string().optional().or(z.literal("")),
  vezife: z.string().min(2).max(100),
  sobe: z.string().min(1).max(60),
  maas_min: z.coerce.number().min(0),
  maas_max: z.coerce.number().min(0),
  teleb_tecrube_il: z.coerce.number().min(0).max(40),
  telebler: z.string().max(2000).optional().or(z.literal("")),
  status: z.enum(["acig", "baglandi", "dayandirildi"]).default("acig"),
});

export async function saveVakansiya(input: FormData): Promise<Result<string>> {
  const permCheck = await requireHrActionPerm("vakansiya.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = VakansiyaSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  if (d.maas_max < d.maas_min) return { ok: false, error: "Max ≥ Min olmalıdır" };

  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    const id = d.id || nextId();
    const existing = d.id ? await getEntry<Vakansiya>("hr_vakansiya", id) : null;
    const user = await prisma.istifadeciler.findUnique({ where: { id: istifadeciId }, select: { ad_soyad: true } });
    const v: Vakansiya = {
      id,
      vezife: d.vezife,
      sobe: d.sobe,
      maas_min: d.maas_min,
      maas_max: d.maas_max,
      teleb_tecrube_il: d.teleb_tecrube_il,
      telebler: d.telebler || "",
      status: d.status,
      yaradan_id: existing?.yaradan_id ?? istifadeciId,
      yaradan_ad: existing?.yaradan_ad ?? user?.ad_soyad ?? null,
      yaradildi: existing?.yaradildi ?? new Date().toISOString(),
    };
    await setEntry("hr_vakansiya", id, v, `${v.vezife} (${v.sobe})`);
    revalidatePath("/iscilier/vakansiya");
    bustHrCache();
    await audit(existing ? "yenile" : "yarat", "hr_vakansiya", id, {
      yeni_data: { vezife: d.vezife, sobe: d.sobe, status: d.status, maas_diapazon: `${d.maas_min}-${d.maas_max}` },
      sebeb: existing ? "Vakansiya yeniləndi" : "Yeni vakansiya yaradıldı",
    });
    return { ok: true, data: id };
  });
}

const DeleteSchema = z.object({ id: z.string().min(1) });
export async function deleteVakansiya(input: FormData): Promise<Result> {
  const permCheck = await requireHrActionPerm("vakansiya.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = DeleteSchema.safeParse({ id: input.get("id") });
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  return withTenant(async () => {
    // Cascade: delete all related namizedler
    const ents = await listEntries<Namized>("hr_namized");
    let cascade = 0;
    for (const e of ents) {
      if (e.data.vakansiya_id === parsed.data.id) {
        await deleteEntry("hr_namized", e.acar);
        cascade++;
      }
    }
    await deleteEntry("hr_vakansiya", parsed.data.id);
    revalidatePath("/iscilier/vakansiya");
    bustHrCache();
    await audit("sil", "hr_vakansiya", parsed.data.id, {
      yeni_data: { namized_silindi: cascade },
      sebeb: "Vakansiya silindi (cascade ilə namizədlər)",
    });
    return { ok: true };
  });
}

/* -------------------- Namizedler -------------------- */

const NamizedSchema = z.object({
  id: z.string().optional().or(z.literal("")),
  vakansiya_id: z.string().min(1),
  ad_soyad: z.string().min(2).max(100),
  telefon: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  cv_url: z.string().max(500).optional().or(z.literal("")),
  hazirki_vezife: z.string().max(100).optional().or(z.literal("")),
  status: z.enum(["yeni", "musahibe", "teklif", "qebul", "redd"]).default("yeni"),
  musahibe_tarix: z.string().optional().or(z.literal("")),
  qeyd: z.string().max(1000).optional().or(z.literal("")),
});

export async function saveNamized(input: FormData): Promise<Result<string>> {
  const permCheck = await requireHrActionPerm("vakansiya.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = NamizedSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const id = d.id || nextId();
    const existing = d.id ? await getEntry<Namized>("hr_namized", id) : null;

    // Check vakansiya exists
    const vak = await getEntry<Vakansiya>("hr_vakansiya", d.vakansiya_id);
    if (!vak) return { ok: false, error: "Vakansiya tapılmadı" };

    const namized: Namized = {
      id,
      vakansiya_id: d.vakansiya_id,
      ad_soyad: d.ad_soyad,
      telefon: d.telefon || null,
      email: d.email || null,
      cv_url: d.cv_url || null,
      hazirki_vezife: d.hazirki_vezife || null,
      status: d.status,
      musahibe_tarix: d.musahibe_tarix || null,
      qeyd: d.qeyd || null,
      yaradildi: existing?.yaradildi ?? new Date().toISOString(),
    };
    await setEntry("hr_namized", id, namized, namized.ad_soyad);

    // If interview scheduled → create tapshiriq
    if (d.musahibe_tarix && (!existing || existing.musahibe_tarix !== d.musahibe_tarix)) {
      try {
        await prisma.tapshiriqlar.create({
          data: {
            sahibkar_id: sahibkarId,
            yaradan_id: istifadeciId,
            mesul_id: istifadeciId,
            basliq: `Müsahibə: ${namized.ad_soyad} (${vak.vezife})`,
            tesvir: `Namizəd ilə müsahibə planlandı`,
            deadline: new Date(d.musahibe_tarix),
            prioritet: "normal",
            status: "yeni",
          },
        });
      } catch (e) {
        console.error("[saveNamized.tapshiriq]", e);
      }
    }

    revalidatePath("/iscilier/vakansiya");
    bustHrCache();
    await audit(existing ? "yenile" : "yarat", "hr_namized", id, {
      yeni_data: { ad_soyad: d.ad_soyad, vakansiya_id: d.vakansiya_id, status: d.status, musahibe_tarix: d.musahibe_tarix || null },
      sebeb: existing ? "Namizəd yeniləndi" : "Yeni namizəd əlavə edildi",
    });
    return { ok: true, data: id };
  });
}

export async function deleteNamized(input: FormData): Promise<Result> {
  const permCheck = await requireHrActionPerm("vakansiya.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = DeleteSchema.safeParse({ id: input.get("id") });
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  return withTenant(async () => {
    await deleteEntry("hr_namized", parsed.data.id);
    revalidatePath("/iscilier/vakansiya");
    bustHrCache();
    await audit("sil", "hr_namized", parsed.data.id, { sebeb: "Namizəd silindi" });
    return { ok: true };
  });
}
