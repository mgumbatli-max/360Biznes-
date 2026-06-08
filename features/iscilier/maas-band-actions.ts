"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireHrActionPerm, bustHrCache } from "./access-guard";

type Result = { ok: true } | { ok: false; error: string };

const BandSchema = z.object({
  vezife: z.string().min(1).max(100),
  min: z.coerce.number().min(0),
  ortalama: z.coerce.number().min(0),
  max: z.coerce.number().min(0),
});

export async function saveMaasBand(input: FormData): Promise<Result> {
  const permCheck = await requireHrActionPerm("maas.skala");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = BandSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const { vezife, min, ortalama, max } = parsed.data;
  if (min > ortalama || ortalama > max) return { ok: false, error: "Min ≤ Ortalama ≤ Max olmalıdır" };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const deyer = JSON.stringify({ min, ortalama, max });
      await prisma.ayarlar.upsert({
        where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "maas_band", acar: vezife } },
        update: { deyer, nov: "json" },
        create: {
          sahibkar_id: sahibkarId,
          qrup: "maas_band",
          acar: vezife,
          deyer,
          nov: "json",
          tesvir: `${vezife} vəzifəsi üçün maaş aralığı`,
        },
      });
      revalidatePath("/ayarlar/maas-band");
      bustHrCache();
      await audit("yenile", "maas_band", vezife, {
        yeni_data: { vezife, min, ortalama, max },
        sebeb: `Maaş aralığı: ${vezife}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[saveMaasBand]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yadda saxlanmadı: ${msg}` };
    }
  });
}

const DeleteSchema = z.object({ vezife: z.string().min(1).max(100) });

export async function deleteMaasBand(input: FormData): Promise<Result> {
  const permCheck = await requireHrActionPerm("maas.skala");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = DeleteSchema.safeParse({ vezife: input.get("vezife") });
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.ayarlar.deleteMany({
        where: { sahibkar_id: sahibkarId, qrup: "maas_band", acar: parsed.data.vezife },
      });
      revalidatePath("/ayarlar/maas-band");
      bustHrCache();
      await audit("sil", "maas_band", parsed.data.vezife, { sebeb: `Maaş aralığı silindi: ${parsed.data.vezife}` });
      return { ok: true };
    } catch (e) {
      console.error("[deleteMaasBand]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Silinmədi: ${msg}` };
    }
  });
}
