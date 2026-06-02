"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { hashPassword } from "@/lib/auth/password";
import { parseLocalDate } from "@/lib/utils";
import { audit, diffObjects } from "@/lib/audit/log";

const EmployeeSchema = z.object({
  id: z.string().uuid().optional(),
  ad_soyad: z.string().min(2).max(100),
  email: z.string().email().max(150),
  telefon: z.string().max(20).optional().or(z.literal("")),
  vezife: z.string().max(100).optional().or(z.literal("")),
  rol_id: z.coerce.number().int().positive(),
  aylik_maas: z.coerce.number().min(0).default(0),
  ise_baslama: z.string().optional().or(z.literal("")),
  sifre: z.string().min(6).max(100).optional().or(z.literal("")),
  aktiv: z.coerce.boolean().default(true),
  fin_kod: z.string().max(20).optional().or(z.literal("")),
  dogum_tarixi: z.string().optional().or(z.literal("")),
  unvan: z.string().max(500).optional().or(z.literal("")),
  bank_ad: z.string().max(100).optional().or(z.literal("")),
  bank_hesab: z.string().max(40).optional().or(z.literal("")),
  default_filial_id: z.coerce.number().int().positive().optional(),
});

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function saveEmployee(input: FormData): Promise<ActionResult> {
  const parsed = EmployeeSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const baseData = {
        ad_soyad: d.ad_soyad.trim(),
        email: d.email.toLowerCase().trim(),
        telefon: d.telefon?.trim() || null,
        vezife: d.vezife?.trim() || null,
        rol_id: d.rol_id,
        aylik_maas: d.aylik_maas,
        ise_baslama: d.ise_baslama ? parseLocalDate(d.ise_baslama) : null,
        aktiv: d.aktiv,
        fin_kod: d.fin_kod?.trim() || null,
        dogum_tarixi: d.dogum_tarixi ? parseLocalDate(d.dogum_tarixi) : null,
        unvan: d.unvan?.trim() || null,
        bank_ad: d.bank_ad?.trim() || null,
        bank_hesab: d.bank_hesab?.trim() || null,
        default_filial_id: d.default_filial_id ?? null,
      };

      let id: string;
      if (d.id) {
        const before = await prisma.istifadeciler.findUnique({
          where: { id: d.id },
          select: { ad_soyad: true, email: true, telefon: true, vezife: true, rol_id: true, aylik_maas: true, aktiv: true, default_filial_id: true },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = { ...baseData };
        if (d.sifre) data.sifre_hash = await hashPassword(d.sifre);
        const updated = await prisma.istifadeciler.update({ where: { id: d.id }, data });
        id = updated.id;
        const diff = diffObjects(before as Record<string, unknown> | null, baseData as unknown as Record<string, unknown>);
        if (diff) {
          await audit("yenile", "iscilier", id, {
            evvelki_data: diff.before,
            yeni_data: diff.after,
            sebeb: d.sifre ? "İşçi məlumatları və şifrə yeniləndi" : "İşçi məlumatları yeniləndi",
          });
        }
      } else {
        if (!d.sifre) return { ok: false as const, error: "Yeni işçi üçün şifrə tələb olunur" };
        const created = await prisma.istifadeciler.create({
          data: {
            sahibkar_id: sahibkarId,
            ...baseData,
            sifre_hash: await hashPassword(d.sifre),
          },
        });
        id = created.id;
        await audit("yarat", "iscilier", id, {
          yeni_data: { ad_soyad: d.ad_soyad, email: d.email, rol_id: d.rol_id, vezife: d.vezife || null, aylik_maas: d.aylik_maas },
          sebeb: "Yeni işçi yaradıldı",
        });
      }
      revalidatePath("/iscilier");
      return { ok: true, id };
    } catch (e) {
      console.error("[saveEmployee]", e);
      if (e instanceof Error && e.message.includes("Unique")) {
        return { ok: false, error: "Bu email artıq istifadədədir" };
      }
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function deactivateEmployee(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    if (id === istifadeciId) return { ok: false, error: "Özünüzü deaktivləşdirə bilməzsiniz" };
    try {
      const before = await prisma.istifadeciler.findUnique({
        where: { id },
        select: { ad_soyad: true, email: true, vezife: true, aktiv: true },
      });
      await prisma.istifadeciler.update({
        where: { id },
        data: { aktiv: false, isden_cixdi: new Date() },
      });
      await audit("sil", "iscilier", id, {
        evvelki_data: before as Record<string, unknown> | null,
        yeni_data: { aktiv: false, isden_cixdi: new Date().toISOString() },
        sebeb: "İşçi deaktivləşdirildi",
      });
      revalidatePath("/iscilier");
      return { ok: true };
    } catch (e) {
      console.error("[deactivateEmployee]", e);
      return { ok: false, error: "Alınmadı" };
    }
  });
}
