"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { createApprovalRequest, shouldRequireDocApproval } from "@/features/tesdiq/create";

const LineSchema = z.object({
  mehsul_id: z.string().uuid(),
  miqdar: z.number().positive(),
});

const CreateTransferSchema = z.object({
  kaynak_anbar_id: z.coerce.number().int().positive(),
  hedef_anbar_id: z.coerce.number().int().positive(),
  qeyd: z.string().max(500).optional().nullable(),
  satirlar: z.array(LineSchema).min(1),
});

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function nextTransferNo(sahibkarId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.anbar_transferleri.count({
    where: { sahibkar_id: sahibkarId, tarix: { gte: new Date(`${year}-01-01`) } },
  });
  return `TR-${year}-${String(count + 1).padStart(5, "0")}`;
}

export async function createTransfer(input: z.input<typeof CreateTransferSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateTransferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  if (d.kaynak_anbar_id === d.hedef_anbar_id)
    return { ok: false, error: "Mənbə və hədəf anbar eyni ola bilməz" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const nomre = await nextTransferNo(sahibkarId);
      const transfer = await prisma.anbar_transferleri.create({
        data: {
          sahibkar_id: sahibkarId,
          nomre,
          kaynak_anbar_id: d.kaynak_anbar_id,
          hedef_anbar_id: d.hedef_anbar_id,
          status: "tesdiqlenmemis",
          qeyd: d.qeyd || null,
          yaradan_id: istifadeciId,
          transfer_satirlari: {
            create: d.satirlar.map((s) => ({
              sahibkar_id: sahibkarId,
              mehsul_id: s.mehsul_id,
              miqdar: s.miqdar,
            })),
          },
        },
      });
      // Təsdiq tələbi — "ticaret_emeliyyat" aktivdirsə
      const needsApproval = await shouldRequireDocApproval("ticaret_emeliyyat");
      if (needsApproval) {
        await createApprovalRequest({
          emeliyyat_nov: "ticaret_emeliyyat",
          resurs_nov: "anbar_transferi",
          resurs_id: transfer.id,
          basliq: `Anbar transferi ${nomre}`,
          risk_sebeb: "Anbar transferi təsdiq tələb edir",
          prioritet: "orta",
          detay_json: {
            tip: "transfer",
            kaynak_anbar_id: d.kaynak_anbar_id,
            hedef_anbar_id: d.hedef_anbar_id,
            satir_sayi: d.satirlar.length,
          },
        });
        revalidatePath("/tesdiq");
      }
      revalidatePath("/anbar/transfer");
      return { ok: true, data: { id: transfer.id } };
    } catch (e) {
      console.error("[createTransfer]", e);
      return { ok: false, error: "Yaradılmadı" };
    }
  });
}

export async function acceptTransfer(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.$transaction(async (tx) => {
        const t = await tx.anbar_transferleri.findUnique({
          where: { id },
          include: { transfer_satirlari: true },
        });
        if (!t) throw new Error("Tapılmadı");
        if (t.status === "tesdiqlendi") throw new Error("Artıq qəbul edilib");

        for (const line of t.transfer_satirlari) {
          // Decrement source
          const src = await tx.stok.findFirst({
            where: { mehsul_id: line.mehsul_id, anbar_id: t.kaynak_anbar_id },
          });
          if (!src || Number(src.miqdar ?? 0) < Number(line.miqdar)) {
            throw new Error(`Stok kifayət deyil: məhsul ${line.mehsul_id}`);
          }
          await tx.stok.update({
            where: { id: src.id },
            data: { miqdar: { decrement: line.miqdar } },
          });

          // Increment dest
          const dst = await tx.stok.findFirst({
            where: { mehsul_id: line.mehsul_id, anbar_id: t.hedef_anbar_id },
          });
          if (dst) {
            await tx.stok.update({
              where: { id: dst.id },
              data: { miqdar: { increment: line.miqdar }, son_qiymet: src.son_qiymet ?? undefined },
            });
          } else {
            await tx.stok.create({
              data: {
                sahibkar_id: sahibkarId,
                mehsul_id: line.mehsul_id,
                anbar_id: t.hedef_anbar_id,
                miqdar: line.miqdar,
                son_qiymet: src.son_qiymet,
              },
            });
          }

          // Movement records
          await tx.anbar_hereketleri.createMany({
            data: [
              {
                sahibkar_id: sahibkarId,
                anbar_id: t.kaynak_anbar_id,
                mehsul_id: line.mehsul_id,
                nov: "transfer_cixis",
                miqdar: line.miqdar,
                qiymet: src.son_qiymet ?? null,
                ref_nov: "transfer",
                ref_id: t.id,
                edilen_id: istifadeciId,
              },
              {
                sahibkar_id: sahibkarId,
                anbar_id: t.hedef_anbar_id,
                mehsul_id: line.mehsul_id,
                nov: "transfer_giris",
                miqdar: line.miqdar,
                qiymet: src.son_qiymet ?? null,
                ref_nov: "transfer",
                ref_id: t.id,
                edilen_id: istifadeciId,
              },
            ],
          });
        }

        await tx.anbar_transferleri.update({
          where: { id: t.id },
          data: { status: "tesdiqlendi" },
        });
      });
      revalidatePath("/anbar/transfer");
      revalidatePath("/anbar/hereketler");
      return { ok: true };
    } catch (e) {
      console.error("[acceptTransfer]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}
