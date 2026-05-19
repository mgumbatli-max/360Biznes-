"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseLocalDate } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

const DOC_KATEQ = [
  "shexsiyyet",
  "kontrakt",
  "diplom",
  "tibbi",
  "banka",
  "vergi",
  "diger",
] as const;

const DocSchema = z.object({
  istifadeci_id: z.string().uuid(),
  ad: z.string().min(1).max(200),
  kateqoriya: z.enum(DOC_KATEQ),
  fayl_url: z.string().min(1).max(500),
  fayl_nov: z.string().max(50).optional().or(z.literal("")),
  fayl_olcu: z.coerce.number().int().min(0).optional(),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
  bitme_tarixi: z.string().optional().or(z.literal("")),
});

export async function addEmployeeDocument(input: FormData): Promise<Result> {
  const parsed = DocSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.isci_senedleri.create({
        data: {
          istifadeci_id: d.istifadeci_id,
          sahibkar_id: sahibkarId,
          ad: d.ad.trim(),
          kateqoriya: d.kateqoriya,
          fayl_url: d.fayl_url.trim(),
          fayl_nov: d.fayl_nov?.trim() || null,
          fayl_olcu: d.fayl_olcu ?? null,
          qeyd: d.qeyd?.trim() || null,
          bitme_tarixi: d.bitme_tarixi ? parseLocalDate(d.bitme_tarixi) : null,
          yaradan_id: istifadeciId,
        },
      });
      revalidatePath(`/iscilier/${d.istifadeci_id}`);
      return { ok: true };
    } catch (e) {
      console.error("[addEmployeeDocument]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function deleteEmployeeDocument(input: FormData): Promise<Result> {
  const id = Number(input.get("id"));
  const istifadeciId = String(input.get("istifadeci_id") ?? "");
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: "ID yanlışdır" };

  return withTenant(async () => {
    try {
      await prisma.isci_senedleri.delete({ where: { id } });
      revalidatePath(`/iscilier/${istifadeciId}`);
      return { ok: true };
    } catch (e) {
      console.error("[deleteEmployeeDocument]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

// ── Work schedule (qrafik) ────────────────────────────────────────────
const ScheduleRowSchema = z.object({
  hefte_gunu: z.number().int().min(1).max(7),
  baslama: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  bitme: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  istirahet: z.boolean(),
});

const ScheduleSchema = z.object({
  istifadeci_id: z.string().uuid(),
  rows: z.array(ScheduleRowSchema).length(7),
});

function timeToDate(t: string | null): Date | null {
  if (!t) return null;
  // Prisma @db.Time stores time; using fixed date 1970-01-01 base
  return new Date(`1970-01-01T${t}:00.000Z`);
}

export async function saveEmployeeSchedule(input: {
  istifadeci_id: string;
  rows: { hefte_gunu: number; baslama: string | null; bitme: string | null; istirahet: boolean }[];
}): Promise<Result> {
  const parsed = ScheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Qrafik məlumatı yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      // Upsert each row
      for (const r of d.rows) {
        const baslama = r.istirahet ? null : timeToDate(r.baslama);
        const bitme = r.istirahet ? null : timeToDate(r.bitme);
        await prisma.isci_grafik.upsert({
          where: { istifadeci_id_hefte_gunu: { istifadeci_id: d.istifadeci_id, hefte_gunu: r.hefte_gunu } },
          create: {
            istifadeci_id: d.istifadeci_id,
            sahibkar_id: sahibkarId,
            hefte_gunu: r.hefte_gunu,
            baslama,
            bitme,
            istirahet: r.istirahet,
          },
          update: {
            baslama,
            bitme,
            istirahet: r.istirahet,
            yenilendi: new Date(),
          },
        });
      }
      revalidatePath(`/iscilier/${d.istifadeci_id}`);
      return { ok: true };
    } catch (e) {
      console.error("[saveEmployeeSchedule]", e);
      return { ok: false, error: "Qrafik yadda saxlanmadı" };
    }
  });
}
