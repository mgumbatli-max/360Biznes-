"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

const OpenSchema = z.object({
  ad: z.string().min(1).max(100),
  filial_id: z.coerce.number().int().positive().optional(),
  acilis_qaligi: z.coerce.number().min(0).default(0),
});

const CloseSchema = z.object({
  hesablanan_qaliq: z.coerce.number().min(0),
  qeyd: z.string().max(2000).optional(),
});

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function openKassa(input: FormData | z.infer<typeof OpenSchema>): Promise<ActionResult<{ id: string }>> {
  const raw = input instanceof FormData ? Object.fromEntries(input.entries()) : input;
  const parsed = OpenSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };

  return withTenant(async () => {
    const { istifadeciId } = requireTenant();

    // Already an open kassa for this user?
    const existing = await prisma.kassalar.findFirst({
      where: { status: "acig", acan_id: istifadeciId },
    });
    if (existing) {
      return { ok: false as const, error: "Sizdə artıq açıq kassa var. Əvvəl bağlayın." };
    }

    const created = await prisma.kassalar.create({
      data: {
        sahibkar_id: requireTenant().sahibkarId,
        ad: parsed.data.ad,
        filial_id: parsed.data.filial_id ?? null,
        acan_id: istifadeciId,
        acilis_qaligi: parsed.data.acilis_qaligi,
        status: "acig",
      },
    });
    revalidatePath("/pos");
    return { ok: true as const, data: { id: created.id } };
  });
}

export async function closeKassa(
  kassaId: string,
  input: FormData | z.infer<typeof CloseSchema>
): Promise<ActionResult> {
  const raw = input instanceof FormData ? Object.fromEntries(input.entries()) : input;
  const parsed = CloseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };

  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    const kassa = await prisma.kassalar.findFirst({
      where: { id: kassaId, status: "acig" },
    });
    if (!kassa) return { ok: false as const, error: "Açıq kassa tapılmadı" };
    if (kassa.acan_id !== istifadeciId) {
      return { ok: false as const, error: "Bu kassanı başqa istifadəçi açıb" };
    }

    // Compute expected balance: opening + sum of cash inflow - sum of cash outflow
    const cashAgg = await prisma.kassa_emeliyyatlari.aggregate({
      where: { kassa_id: kassa.id, odenis_nov: "negd" },
      _sum: { mebleg: true },
    });
    const negdNet = Number(cashAgg._sum.mebleg ?? 0);
    const expected = Number(kassa.acilis_qaligi ?? 0) + negdNet;

    await prisma.kassalar.update({
      where: { id: kassa.id },
      data: {
        status: "bagli",
        baglayan_id: istifadeciId,
        baglanis_tarixi: new Date(),
        hesablanan_qaliq: expected,
        baglanis_qaligi: parsed.data.hesablanan_qaliq,
        fark: parsed.data.hesablanan_qaliq - expected,
        qeyd: parsed.data.qeyd ?? null,
      },
    });
    revalidatePath("/pos");
    return { ok: true as const };
  });
}
