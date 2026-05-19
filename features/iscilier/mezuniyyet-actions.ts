"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseLocalDate } from "@/lib/utils";

type Result = { ok: true; id?: number } | { ok: false; error: string };

const LeaveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  istifadeci_id: z.string().uuid(),
  nov: z.string().min(1).max(20),
  baslama: z.string().min(1),
  bitme: z.string().min(1),
  sebeb: z.string().max(500).optional().or(z.literal("")),
  evezleyici_id: z.string().uuid().optional().or(z.literal("")),
  fayl_url: z.string().max(500).optional().or(z.literal("")),
});

function dayDiff(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

export async function saveLeaveRequest(input: FormData): Promise<Result> {
  const parsed = LeaveSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const baslama = parseLocalDate(d.baslama);
      const bitme = parseLocalDate(d.bitme);
      if (!baslama || !bitme) return { ok: false, error: "Tarix yanlışdır" };
      if (bitme < baslama) return { ok: false, error: "Bitmə tarixi başlama tarixindən kiçik ola bilməz" };
      const gun_sayi = dayDiff(baslama, bitme);

      // Conflict check: replacement (əvəzləyici) must not be on leave during this window
      if (d.evezleyici_id) {
        const conflict = await prisma.isci_mezuniyyet.findFirst({
          where: {
            sahibkar_id: sahibkarId,
            istifadeci_id: d.evezleyici_id,
            status: "tesdiq",
            OR: [
              { AND: [{ baslama: { lte: bitme } }, { bitme: { gte: baslama } }] },
            ],
          },
        });
        if (conflict) {
          return { ok: false, error: "Əvəzləyici işçi həmin tarixlərdə məzuniyyətdədir" };
        }
      }

      // Save sebeb + evezleyici as JSON inside sebeb field (no schema change)
      const enrichedSebeb = JSON.stringify({
        text: d.sebeb || null,
        evezleyici_id: d.evezleyici_id || null,
      });

      if (d.id) {
        await prisma.isci_mezuniyyet.update({
          where: { id: d.id },
          data: {
            nov: d.nov,
            baslama,
            bitme,
            gun_sayi,
            sebeb: enrichedSebeb,
            fayl_url: d.fayl_url || null,
          },
        });
        revalidatePath("/iscilier/mezuniyyet");
        return { ok: true, id: d.id };
      }
      const created = await prisma.isci_mezuniyyet.create({
        data: {
          sahibkar_id: sahibkarId,
          istifadeci_id: d.istifadeci_id,
          nov: d.nov,
          baslama,
          bitme,
          gun_sayi,
          sebeb: enrichedSebeb,
          fayl_url: d.fayl_url || null,
          status: "gozleyir",
          yaradan_id: istifadeciId,
        },
      });
      revalidatePath("/iscilier/mezuniyyet");
      return { ok: true, id: created.id };
    } catch (e) {
      console.error("[saveLeaveRequest]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

const DecisionSchema = z.object({
  id: z.coerce.number().int().positive(),
  decision: z.enum(["tesdiq", "red"]),
  qeyd: z.string().max(500).optional().or(z.literal("")),
});

export async function decideLeaveRequest(input: FormData): Promise<Result> {
  const parsed = DecisionSchema.safeParse({
    id: input.get("id"),
    decision: input.get("decision"),
    qeyd: input.get("qeyd"),
  });
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      await prisma.isci_mezuniyyet.update({
        where: { id: parsed.data.id },
        data: {
          status: parsed.data.decision,
          tesdiq_eden_id: istifadeciId,
          tesdiq_tarixi: new Date(),
          tesdiq_qeyd: parsed.data.qeyd || null,
        },
      });
      revalidatePath("/iscilier/mezuniyyet");
      return { ok: true };
    } catch (e) {
      console.error("[decideLeaveRequest]", e);
      return { ok: false, error: "Alınmadı" };
    }
  });
}
