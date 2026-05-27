"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import type { BonusProfil } from "./bonus-profile";

const PaylanmaSchema = z.object({
  kateqoriya: z.enum(["davamiyyet", "tapsiriq", "sehv_yoxlugu", "borc_yigim", "satis_hedef"]),
  tip: z.enum(["mebleg", "faiz"]),
  deyer: z.coerce.number().min(0).max(1_000_000),
  hedef: z.coerce.number().min(0).max(1_000_000),
});

const ProfilSchema = z.object({
  istifadeciId: z.string().uuid(),
  metod: z.enum(["fixed", "percent_satis", "percent_menfaat"]),
  fixed_mebleg: z.coerce.number().min(0).max(1_000_000),
  percent: z.coerce.number().min(0).max(100),
  paylanma: z.array(PaylanmaSchema),
  musteri_filter: z.enum(["hamisi", "mene_aid"]).default("hamisi"),
});

type Result = { ok: true } | { ok: false; error: string };

export async function saveBonusProfil(input: z.input<typeof ProfilSchema>): Promise<Result> {
  const parsed = ProfilSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const data = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, rolId, icazeler } = requireTenant();
    // İcazə yoxlanışı — admin (1), sahibkar (9) və ya `isci.bonus_idare` icazəsi
    const allowed =
      rolId === 1 ||
      rolId === 9 ||
      (icazeler ?? []).includes("isci.bonus_idare") ||
      (icazeler ?? []).includes("istifadeci.idare") ||
      (icazeler ?? []).includes("sahibkar.access");
    if (!allowed) {
      return { ok: false, error: "Bonus qaydalarını dəyişdirmək icazəniz yoxdur" };
    }
    try {
      const profil: BonusProfil = {
        metod: data.metod,
        fixed_mebleg: data.fixed_mebleg,
        percent: data.percent,
        paylanma: data.paylanma,
        musteri_filter: data.musteri_filter,
      };
      await prisma.ayarlar.upsert({
        where: {
          sahibkar_id_qrup_acar: {
            sahibkar_id: sahibkarId,
            qrup: "bonus_profil",
            acar: data.istifadeciId,
          },
        },
        create: {
          sahibkar_id: sahibkarId,
          qrup: "bonus_profil",
          acar: data.istifadeciId,
          deyer: JSON.stringify(profil),
          nov: "string",
        },
        update: {
          deyer: JSON.stringify(profil),
          yenilendi: new Date(),
        },
      });
      revalidatePath(`/iscilier/${data.istifadeciId}`);
      return { ok: true };
    } catch (e) {
      console.error("[saveBonusProfil]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}
