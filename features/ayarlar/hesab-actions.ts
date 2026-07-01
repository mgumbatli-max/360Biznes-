"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireAyarActionPerm } from "./access-guard";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const HesabSchema = z.object({
  id: z.string().uuid().optional(),
  ad: z.string().min(2, "Ad ən az 2 simvol").max(100),
  nov: z.enum(["negd", "bank", "kart"]).default("negd"),
  valyuta: z.string().min(3).max(3).default("AZN"),
  bank_adi: z.string().max(100).optional().or(z.literal("")),
  iban: z.string().max(50).optional().or(z.literal("")),
  kart_son4: z.string().regex(/^\d{0,4}$/, "Yalnız 4 rəqəm").optional().or(z.literal("")),
  pos_kodu: z.string().max(50).optional().or(z.literal("")),
  filial_id: z.coerce.number().int().positive().optional().or(z.literal("")),
  acilis_qaligi: z.coerce.number().min(0).default(0),
  qeyd: z.string().max(500).optional().or(z.literal("")),
  aktiv: z.union([z.string(), z.boolean()]).optional(),
});

export async function saveMaliyyeHesab(input: FormData): Promise<ActionResult> {
  // 🔒 Backend icazə guard-ı (audit #4) — əvvəl yalnız səhifə-gate qoruyurdu,
  // server action POST-ları isə birbaşa çağrıla bilir (kassir/satıcı bank/nağd
  // hesab yarada bilirdi).
  const __g = await requireAyarActionPerm("ayar.idare");
  if (!__g.ok) return { ok: false, error: __g.error };
  const parsed = HesabSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const aktiv = d.aktiv === "on" || d.aktiv === "true" || d.aktiv === true;
    // 🔒 filial_id tenant-a aid olmalı (audit #5) — əks halda cross-tenant
    // dangling FK yaranır. Yalnız verildikdə yoxla (opsional sahə).
    if (typeof d.filial_id === "number") {
      const f = await prisma.filiallar.findFirst({
        where: { id: d.filial_id, sahibkar_id: sahibkarId },
        select: { id: true },
      });
      if (!f) return { ok: false, error: "Filial tapılmadı" };
    }
    try {
      if (d.id) {
        const before = await prisma.maliye_hesablari.findFirst({
          where: { id: d.id, sahibkar_id: sahibkarId },
          select: { ad: true, nov: true, bank_adi: true, iban: true, kart_son4: true, aktiv: true, filial_id: true, qeyd: true },
        });
        if (!before) return { ok: false, error: "Hesab tapılmadı" };
        const updated = await prisma.maliye_hesablari.updateMany({
          where: { id: d.id, sahibkar_id: sahibkarId },
          data: {
            ad: d.ad.trim(),
            nov: d.nov,
            valyuta: d.valyuta,
            bank_adi: d.bank_adi?.trim() || null,
            iban: d.iban?.trim() || null,
            kart_son4: d.kart_son4 || null,
            pos_kodu: d.pos_kodu?.trim() || null,
            filial_id: typeof d.filial_id === "number" ? d.filial_id : null,
            qeyd: d.qeyd?.trim() || null,
            aktiv,
            yenilendi: new Date(),
          },
        });
        if (updated.count === 0) return { ok: false, error: "Yenilənmədi" };
        try {
          await audit("yenile", "maliye_hesabi", d.id, {
            evvelki_data: before as Record<string, unknown>,
            yeni_data: { ad: d.ad, nov: d.nov, aktiv },
            sebeb: "Hesab redaktə olundu",
          });
        } catch { /* non-fatal */ }
        revalidatePath("/ayarlar/bank");
        revalidatePath("/maliyye");
        return { ok: true, id: d.id };
      } else {
        const created = await prisma.maliye_hesablari.create({
          data: {
            sahibkar_id: sahibkarId,
            ad: d.ad.trim(),
            nov: d.nov,
            valyuta: d.valyuta,
            bank_adi: d.bank_adi?.trim() || null,
            iban: d.iban?.trim() || null,
            kart_son4: d.kart_son4 || null,
            pos_kodu: d.pos_kodu?.trim() || null,
            filial_id: typeof d.filial_id === "number" ? d.filial_id : null,
            qaliq: new Prisma.Decimal(d.acilis_qaligi.toFixed(2)),
            qeyd: d.qeyd?.trim() || null,
            aktiv,
            yaradan_id: istifadeciId,
          },
          select: { id: true },
        });
        try {
          await audit("yarat", "maliye_hesabi", created.id, {
            yeni_data: { ad: d.ad, nov: d.nov, valyuta: d.valyuta, qaliq: d.acilis_qaligi },
            sebeb: "Yeni hesab yaradıldı",
          });
        } catch { /* non-fatal */ }
        revalidatePath("/ayarlar/bank");
        revalidatePath("/maliyye");
        return { ok: true, id: created.id };
      }
    } catch (e) {
      console.error("[saveMaliyyeHesab]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Yaddasaxlama alınmadı" };
    }
  });
}

export async function deleteMaliyyeHesab(id: string): Promise<
  | { ok: true }
  | {
      ok: false;
      error: string;
      blockers?: import("@/lib/blockers/types").Blocker[];
      hint?: string;
    }
> {
  // 🔒 Backend icazə guard-ı (audit #4).
  const __g = await requireAyarActionPerm("ayar.idare");
  if (!__g.ok) return { ok: false, error: __g.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const hesab = await prisma.maliye_hesablari.findFirst({
        where: { id, sahibkar_id: sahibkarId },
        select: { ad: true, qaliq: true },
      });
      if (!hesab) return { ok: false, error: "Hesab tapılmadı" };

      // 🛑 Qalıq və ya açıq əməliyyatlar varsa strukturlu blocker cavabı
      const qaliq = Number(hesab.qaliq ?? 0);
      if (Math.abs(qaliq) > 0.01) {
        const { findAccountBlockers } = await import("@/lib/blockers/find-account-blockers");
        const blockers = await findAccountBlockers(id, sahibkarId);
        return {
          ok: false,
          error: `${hesab.ad} hesabının qalığı ${qaliq.toFixed(2)} AZN-dir. Sıfırlanmadan deaktivləşdirilə bilməz.`,
          blockers,
          hint: "Qaliqi başqa hesaba transfer edin və ya geri çıxarın. Sonra yenidən cəhd edin.",
        };
      }

      // Real silinmə təhlükəlidir — finance_operations FK var. Yalnız aktiv = false et.
      await prisma.maliye_hesablari.updateMany({
        where: { id, sahibkar_id: sahibkarId },
        data: { aktiv: false, yenilendi: new Date() },
      });
      try {
        await audit("sil", "maliye_hesabi", id, {
          evvelki_data: { ad: hesab.ad, qaliq: Number(hesab.qaliq ?? 0) },
          sebeb: "Hesab deaktivləşdirildi (soft delete)",
        });
      } catch { /* non-fatal */ }
      revalidatePath("/ayarlar/bank");
      return { ok: true };
    } catch (e) {
      console.error("[deleteMaliyyeHesab]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Silinmədi" };
    }
  });
}
