"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { createApprovalRequest, shouldRequireDocApproval } from "@/features/tesdiq/create";
import { safeStockDecrement } from "@/lib/db/stock-guards";
import { safeUserMessage } from "@/lib/error/user-message";

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
  const { requireAnbarActionPerm } = await import("../access-guard");
  const permCheck = await requireAnbarActionPerm(["stok.transfer", "anbar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
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
      return { ok: false, error: safeUserMessage(e, "Transfer yaradılmadı") };
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
        // Yalnız "tesdiqlenmemis" statuslu transfer qəbul edilə bilər (allowlist).
        // Əks halda lğv olunmuş və ya artıq (tam/hissəvi) qəbul edilmiş transfer
        // təkrar emal olunardı → ikiqat stok dəyişikliyi.
        if (t.status !== "tesdiqlenmemis") {
          if (t.status === "tesdiqlendi") throw new Error("Artıq qəbul edilib");
          if (t.status === "legv") throw new Error("Ləğv olunmuş transfer qəbul edilə bilməz");
          if (t.status === "qebul_qismi") throw new Error("Bu transfer artıq hissəvi qəbul edilib");
          throw new Error("Bu transfer qəbul edilə bilməz");
        }

        for (const line of t.transfer_satirlari) {
          // Atomic decrement at source — race-safe
          const dec = await safeStockDecrement(tx, {
            mehsulId: line.mehsul_id,
            anbarId: t.kaynak_anbar_id,
            miqdar: Number(line.miqdar),
          });
          if (!dec.ok) throw new Error(dec.error);
          // Need source row for son_qiymet (used in dest create below)
          const src = await tx.stok.findFirst({
            where: { mehsul_id: line.mehsul_id, anbar_id: t.kaynak_anbar_id },
            select: { son_qiymet: true },
          });

          // Increment dest — atomic upsert (race-safe).
          // Əgər concurrent transfer eyni hədəfə qəbul edirsə,
          // update OR create-də race olur; upsert bunu önləyir.
          await tx.stok.upsert({
            where: {
              mehsul_id_anbar_id: {
                mehsul_id: line.mehsul_id,
                anbar_id: t.hedef_anbar_id,
              },
            },
            update: {
              miqdar: { increment: line.miqdar },
              son_qiymet: src?.son_qiymet ?? undefined,
            },
            create: {
              sahibkar_id: sahibkarId,
              mehsul_id: line.mehsul_id,
              anbar_id: t.hedef_anbar_id,
              miqdar: line.miqdar,
              son_qiymet: src?.son_qiymet,
            },
          });

          // Movement records
          await tx.anbar_hereketleri.createMany({
            data: [
              {
                sahibkar_id: sahibkarId,
                anbar_id: t.kaynak_anbar_id,
                mehsul_id: line.mehsul_id,
                nov: "transfer_cixis",
                miqdar: line.miqdar,
                qiymet: src?.son_qiymet ?? null,
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
                qiymet: src?.son_qiymet ?? null,
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

      // Transfer qəbul edildikdə hər iki anbarda stok dəyişir — kanal-larına sync
      try {
        const t = await prisma.anbar_transferleri.findUnique({
          where: { id },
          include: { transfer_satirlari: { select: { mehsul_id: true } } },
        });
        if (t) {
          const { emitStockChange } = await import("@/lib/stock-change-emitter");
          emitStockChange(t.transfer_satirlari.map((s) => s.mehsul_id));
        }
      } catch (e) {
        console.error("[acceptTransfer.emitStockChange]", e);
      }

      return { ok: true };
    } catch (e) {
      console.error("[acceptTransfer]", e);
      const raw = e instanceof Error ? e.message : "";
      if (/tapılmadı|qəbul|stok|miqdar|anbar/i.test(raw)) {
        return { ok: false, error: raw };
      }
      return { ok: false, error: safeUserMessage(e, "Transfer qəbul edilmədi") };
    }
  });
}

/**
 * Transferin HİSSƏVİ qəbulu — sətir-sətir miqdarla qəbul.
 *
 * İstifadə: mənbə anbar 10 göndərib, qəbul edən 8 alır (2-si əskik/zədəli).
 * Sətirlərdə `qebul_edilen` doldurulur, status="qebul_qismi" olur.
 * Tam qəbul: bütün `qebul_edilen` = `miqdar` → status="tesdiqlendi".
 */
export async function partialAcceptTransfer(input: {
  id: string;
  lines: Array<{ satir_id: number; qebul_edilen: number; qeyd?: string }>;
}): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.$transaction(async (tx) => {
        const t = await tx.anbar_transferleri.findUnique({
          where: { id: input.id },
          include: { transfer_satirlari: true },
        });
        if (!t) throw new Error("Tapılmadı");
        if (t.status === "tesdiqlendi") throw new Error("Artıq tam qəbul edilib");
        if (t.status === "legv") throw new Error("Ləğv olunmuş transferi qəbul etmək olmaz");

        // Sətir tap-yox: map_id → received
        const receivedByLine = new Map(input.lines.map((l) => [l.satir_id, l]));

        let allFullyReceived = true;
        for (const line of t.transfer_satirlari) {
          const received = receivedByLine.get(line.id);
          // Əgər input-da göstərilməyibsə, sıfır qəbul olunmuş hesab et
          const qebulMiqdar = received ? Number(received.qebul_edilen) : 0;
          const planedMiqdar = Number(line.miqdar);

          if (qebulMiqdar < 0) throw new Error("Mənfi miqdar olmaz");
          if (qebulMiqdar > planedMiqdar) {
            throw new Error(`Qəbul (${qebulMiqdar}) sifariş miqdarından (${planedMiqdar}) çox ola bilməz`);
          }
          if (qebulMiqdar < planedMiqdar) allFullyReceived = false;

          if (qebulMiqdar > 0) {
            // Mənbə anbar — yalnız qəbul ediləcək hissə qədər çıx
            const dec = await safeStockDecrement(tx, {
              mehsulId: line.mehsul_id,
              anbarId: t.kaynak_anbar_id,
              miqdar: qebulMiqdar,
            });
            if (!dec.ok) throw new Error(dec.error);

            const src = await tx.stok.findFirst({
              where: { mehsul_id: line.mehsul_id, anbar_id: t.kaynak_anbar_id },
              select: { son_qiymet: true },
            });

            await tx.stok.upsert({
              where: {
                mehsul_id_anbar_id: {
                  mehsul_id: line.mehsul_id,
                  anbar_id: t.hedef_anbar_id,
                },
              },
              update: {
                miqdar: { increment: qebulMiqdar },
                son_qiymet: src?.son_qiymet ?? undefined,
              },
              create: {
                sahibkar_id: sahibkarId,
                mehsul_id: line.mehsul_id,
                anbar_id: t.hedef_anbar_id,
                miqdar: qebulMiqdar,
                son_qiymet: src?.son_qiymet,
              },
            });

            await tx.anbar_hereketleri.createMany({
              data: [
                {
                  sahibkar_id: sahibkarId,
                  anbar_id: t.kaynak_anbar_id,
                  mehsul_id: line.mehsul_id,
                  nov: "transfer_cixis",
                  miqdar: qebulMiqdar,
                  qiymet: src?.son_qiymet ?? null,
                  ref_nov: "transfer_qismi",
                  ref_id: t.id,
                  edilen_id: istifadeciId,
                },
                {
                  sahibkar_id: sahibkarId,
                  anbar_id: t.hedef_anbar_id,
                  mehsul_id: line.mehsul_id,
                  nov: "transfer_giris",
                  miqdar: qebulMiqdar,
                  qiymet: src?.son_qiymet ?? null,
                  ref_nov: "transfer_qismi",
                  ref_id: t.id,
                  edilen_id: istifadeciId,
                },
              ],
            });
          }

          // Sətrdə qəbul olunmuş miqdarı qeyd et
          await tx.transfer_satirlari.update({
            where: { id: line.id },
            data: {
              qebul_edilen: qebulMiqdar,
              qebul_qeyd: received?.qeyd ?? null,
            },
          });
        }

        // Status: hamısı tam qəbul → tesdiqlendi; əks halda qebul_qismi
        await tx.anbar_transferleri.update({
          where: { id: t.id },
          data: {
            status: allFullyReceived ? "tesdiqlendi" : "qebul_qismi",
          },
        });
      });
      revalidatePath("/anbar/transfer");
      revalidatePath("/anbar/hereketler");
      return { ok: true };
    } catch (e) {
      console.error("[partialAcceptTransfer]", e);
      return { ok: false, error: safeUserMessage(e, "Hissəvi qəbul alınmadı") };
    }
  });
}
