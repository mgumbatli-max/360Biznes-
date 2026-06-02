"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, Prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { checkAndCreateStockAlertBatch } from "@/features/anbar/alert-helpers";
import { createApprovalRequest, shouldRequireDocApproval } from "@/features/tesdiq/create";
import { nextDocNumber } from "@/lib/db/sened-nomre";
import { requireTicaretActionPerm } from "./access-guard";
import { audit } from "@/lib/audit/log";
import { stockIncrement } from "@/lib/db/stock-guards";

const LineSchema = z.object({
  mehsul_id: z.string().uuid(),
  miqdar: z.coerce.number().positive(),
  qiymet: z.coerce.number().min(0),
});

const CreatePurchaseSchema = z.object({
  techizatci_id: z.string().uuid(),
  anbar_id: z.coerce.number().int().positive(),
  qaime_nomre: z.string().max(50).optional().or(z.literal("")),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
  receive_now: z.coerce.boolean().default(false), // if true, increment stock immediately
  lines: z.array(LineSchema).min(1),
});

export type CreatePurchaseInput = z.input<typeof CreatePurchaseSchema>;
export type CreatePurchaseResult =
  | { ok: true; id: string; nomre: string }
  | { ok: false; error: string };

const PURCHASE_PREFIX = "ALS";

export async function createPurchase(input: CreatePurchaseInput): Promise<CreatePurchaseResult> {
  const permCheck = await requireTicaretActionPerm("alis.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = CreatePurchaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  // 4-eyes təsdiqi yoxla — admin "alış qaiməsi təsdiq tələbi" funksiyasını aktiv
  // edibsə, qaimə "tesdiq_gozleyir" statusunda yaradılır və receive_now ignore
  // olunur (təsdiqdən əvvəl stoka tıxılmamalıdır).
  const needsApproval = await shouldRequireDocApproval("alis_qaime");

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const result = await prisma.$transaction(async (tx) => {
        const umumi = d.lines.reduce((s, l) => s + l.miqdar * l.qiymet, 0);

        const year = new Date().getFullYear();
        const last = await tx.alis_sifarisleri.findFirst({
          where: { nomre: { startsWith: `${PURCHASE_PREFIX}-${year}-` } },
          orderBy: { nomre: "desc" },
          select: { nomre: true },
        });
        const lastNum = last ? Number(last.nomre.split("-").pop()) || 0 : 0;
        const nomre = `${PURCHASE_PREFIX}-${year}-${String(lastNum + 1).padStart(5, "0")}`;

        const purchase = await tx.alis_sifarisleri.create({
          data: {
            sahibkar_id: sahibkarId,
            nomre,
            techiazatci_id: d.techizatci_id,
            anbar_id: d.anbar_id,
            tarix: new Date(),
            status: needsApproval
              ? "tesdiq_gozleyir"
              : d.receive_now
                ? "qebul_edildi"
                : "gozlemede",
            umumi_mebleg: umumi,
            odenilmis: 0,
            qaime_nomre: d.qaime_nomre || null,
            qeyd: d.qeyd || null,
            yaradan_id: istifadeciId,
            menecer_id: istifadeciId,
          },
        });

        for (const line of d.lines) {
          await tx.alis_sifaris_satirlari.create({
            data: {
              sahibkar_id: sahibkarId,
              sifaris_id: purchase.id,
              mehsul_id: line.mehsul_id,
              miqdar: line.miqdar,
              vahid_qiymet: line.qiymet,
              endirim_faiz: 0,
            },
          });

          // Təsdiq gözləyirsə, stoka heç bir hərəkət yoxdur — təsdiqdən sonra
          // approveRequest helper-i receivePurchase çağıracaq.
          if (d.receive_now && !needsApproval) {
            // Race-safe upsert — paralel alış qəbulları unique constraint-ə düşmür
            await stockIncrement(tx, {
              sahibkarId,
              mehsulId: line.mehsul_id,
              anbarId: d.anbar_id,
              miqdar: line.miqdar,
              sonQiymet: line.qiymet,
            });

            await tx.anbar_hereketleri.create({
              data: {
                sahibkar_id: sahibkarId,
                anbar_id: d.anbar_id,
                mehsul_id: line.mehsul_id,
                nov: "medaxil",
                miqdar: line.miqdar,
                qiymet: line.qiymet,
                ref_nov: "alis_sifarisi",
                ref_id: purchase.id,
                edilen_id: istifadeciId,
              },
            });
          }
        }

        // Təchizatçı borcu — alış qaiməsi → biz təchizatçıya borclu (borc artır).
        // Təsdiq gözlədiyi müddətdə də artırılmır, sənəd hələ aktiv hesab olunmur.
        if (!needsApproval) {
          await tx.kontragentler.update({
            where: { id: d.techizatci_id },
            data: { borc: { increment: new Prisma.Decimal(umumi) } },
          });
        }

        return { id: purchase.id, nomre, umumi };
      });

      // Təsdiq tələbini yarat (sənəd artıq DB-də var, yalnız tesdiq_gozleyir
      // statusundadır). approveRequest sonra status-u aktivə çevirəcək.
      if (needsApproval) {
        await createApprovalRequest({
          emeliyyat_nov: "alis_qaime",
          resurs_nov: "alis_sifarisi",
          resurs_id: result.id,
          basliq: `Alış qaiməsi ${result.nomre}`,
          risk_sebeb: "Alış qaiməsi yaradanda təsdiq tələb olunur",
          mebleg: Number(result.umumi),
          prioritet: Number(result.umumi) > 5000 ? "yuxsek" : "orta",
          detay_json: {
            qaime_nomre: d.qaime_nomre,
            anbar_id: d.anbar_id,
            techizatci_id: d.techizatci_id,
            line_count: d.lines.length,
          },
        });
      }

      revalidatePath("/ticaret/alislar");
      revalidatePath("/tesdiq");

      // Audit: alış yaradılması — təchizatçı, məbləğ, sətir sayı, təsdiq tələbi
      await audit("yarat", "alis_sifarisi", result.id, {
        yeni_data: {
          nomre: result.nomre,
          techizatci_id: d.techizatci_id,
          anbar_id: d.anbar_id,
          umumi_mebleg: Number(result.umumi),
          line_count: d.lines.length,
          receive_now: d.receive_now,
          needs_approval: needsApproval,
        },
        sebeb: needsApproval ? "Alış qaiməsi təsdiq gözləyir" : (d.receive_now ? "Alış qaiməsi yaradıldı və qəbul edildi" : "Alış qaiməsi yaradıldı (gözləmədə)"),
      });

      // Alış qəbul edildikdə stok artır — auto-push kanal-larına yenilik göndər
      const { emitStockChange } = await import("@/lib/stock-change-emitter");
      emitStockChange(d.lines.map((l) => l.mehsul_id));

      return { ok: true, id: result.id, nomre: result.nomre };
    } catch (e) {
      console.error("[createPurchase]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

export async function receivePurchase(purchaseId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const receivedMehsulIds: string[] = [];
    try {
      await prisma.$transaction(async (tx) => {
        const purchase = await tx.alis_sifarisleri.findUnique({
          where: { id: purchaseId },
          include: { alis_sifaris_satirlari: true },
        });
        if (!purchase) throw new Error("Alış tapılmadı");
        if (purchase.status !== "gozlemede") throw new Error("Yalnız 'gözləmədə' alışlar qəbul edilə bilər");
        if (!purchase.anbar_id) throw new Error("Anbar göstərilməyib");

        for (const line of purchase.alis_sifaris_satirlari) {
          if (line.mehsul_id) receivedMehsulIds.push(line.mehsul_id);
          if (!line.mehsul_id) continue;
          await stockIncrement(tx, {
            sahibkarId,
            mehsulId: line.mehsul_id,
            anbarId: purchase.anbar_id,
            miqdar: Number(line.miqdar),
            sonQiymet: Number(line.vahid_qiymet),
          });
          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              anbar_id: purchase.anbar_id,
              mehsul_id: line.mehsul_id,
              nov: "medaxil",
              miqdar: Number(line.miqdar),
              qiymet: Number(line.vahid_qiymet),
              ref_nov: "alis_sifarisi",
              ref_id: purchase.id,
              edilen_id: istifadeciId,
            },
          });
        }
        await tx.alis_sifarisleri.update({
          where: { id: purchase.id },
          data: { status: "qebul_edildi" },
        });
      });
      // Stock alert auto-clear (stock increased → may resolve open kritik alerts)
      if (receivedMehsulIds.length > 0) {
        await checkAndCreateStockAlertBatch(receivedMehsulIds);
      }
      revalidatePath("/ticaret/alislar");
      revalidatePath("/anbar");
      revalidatePath("/xeberdarliqlar");
      // Audit: alış qəbulu — stok artımı və status keçidi
      await audit("yenile", "alis_sifarisi", purchaseId, {
        yeni_data: { status: "qebul_edildi", mehsul_count: receivedMehsulIds.length },
        sebeb: "Alış qaiməsi qəbul edildi — stoka medaxil",
      });
      return { ok: true };
    } catch (e) {
      console.error("[receivePurchase]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

/* ====================================================================== */
/* Task linking — used by /ticaret/alislar/[id] detail page               */
/* ====================================================================== */

/**
 * Create a follow-up task linked to a purchase (təchizatçı kontaktı,
 * gömrük sənədi, qaimə təsdiqi və s.) Link stored in `tapshiriq_obyektleri`
 * with obyekt_nov="alis_sifarisi".
 */
export async function createTaskForPurchase(
  purchaseId: string,
  basliq: string,
  deadline: string | null,
  prioritet: "asagi" | "normal" | "yuksek" | "tecili",
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const title = basliq.trim();
  if (title.length < 3) return { ok: false, error: "Başlıq ən az 3 simvol olmalıdır" };
  if (!["asagi", "normal", "yuksek", "tecili"].includes(prioritet))
    return { ok: false, error: "Prioritet yanlışdır" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const purchase = await prisma.alis_sifarisleri.findUnique({
        where: { id: purchaseId },
        select: { nomre: true, sahibkar_id: true },
      });
      if (!purchase || purchase.sahibkar_id !== sahibkarId)
        return { ok: false, error: "Alış tapılmadı" };

      const task = await prisma.tapshiriqlar.create({
        data: {
          sahibkar_id: sahibkarId,
          basliq: title,
          tesvir: `Alışla bağlı: ${purchase.nomre}`,
          prioritet,
          status: "yeni",
          deadline: deadline ? new Date(deadline) : null,
          yaradan_id: istifadeciId,
          mesul_id: istifadeciId,
        },
        select: { id: true },
      });
      await prisma.tapshiriq_obyektleri.create({
        data: {
          sahibkar_id: sahibkarId,
          tapshiriq_id: task.id,
          obyekt_nov: "alis_sifarisi",
          obyekt_id: purchaseId,
          obyekt_basliq: purchase.nomre,
        },
      });
      revalidatePath(`/ticaret/alislar/${purchaseId}`);
      revalidatePath("/tapshiriqlar");
      return { ok: true, data: { id: task.id } };
    } catch (e) {
      console.error("[createTaskForPurchase]", e);
      return { ok: false, error: "Tapşırıq yaradılmadı" };
    }
  });
}

/**
 * Get tasks linked to a purchase order via tapshiriq_obyektleri.
 */
export async function getLinkedTasksForPurchase(purchaseId: string) {
  return withTenant(async () => {
    const links = await prisma.tapshiriq_obyektleri.findMany({
      where: { obyekt_nov: "alis_sifarisi", obyekt_id: purchaseId },
      orderBy: { yaradildi: "desc" },
      select: {
        tapshiriqlar: {
          select: {
            id: true,
            basliq: true,
            status: true,
            prioritet: true,
            deadline: true,
            yaradildi: true,
          },
        },
      },
    });
    return links
      .map((l) => l.tapshiriqlar)
      .filter((t): t is NonNullable<typeof t> => t !== null);
  });
}

/* ====================================================================== */
/* Task linking — used by /maliyye/emeliyyat drawer                       */
/* ====================================================================== */

/**
 * Create a follow-up task linked to a finance operation. Link stored in
 * `tapshiriq_obyektleri` with obyekt_nov="finance_operations".
 */
export async function createTaskForFinanceOp(
  opId: string,
  basliq: string,
  deadline: string | null,
  prioritet: "asagi" | "normal" | "yuksek" | "tecili",
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const title = basliq.trim();
  if (title.length < 3) return { ok: false, error: "Başlıq ən az 3 simvol olmalıdır" };
  if (!["asagi", "normal", "yuksek", "tecili"].includes(prioritet))
    return { ok: false, error: "Prioritet yanlışdır" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const op = await prisma.finance_operations.findFirst({
        where: { id: opId, sahibkar_id: sahibkarId },
        select: { id: true, type_kod: true, sened_nomresi: true },
      });
      if (!op) return { ok: false, error: "Əməliyyat tapılmadı" };
      const label = op.sened_nomresi ?? op.type_kod ?? "Əməliyyat";

      const task = await prisma.tapshiriqlar.create({
        data: {
          sahibkar_id: sahibkarId,
          basliq: title,
          tesvir: `Maliyyə əməliyyatı ilə bağlı: ${label}`,
          prioritet,
          status: "yeni",
          deadline: deadline ? new Date(deadline) : null,
          yaradan_id: istifadeciId,
          mesul_id: istifadeciId,
        },
        select: { id: true },
      });
      await prisma.tapshiriq_obyektleri.create({
        data: {
          sahibkar_id: sahibkarId,
          tapshiriq_id: task.id,
          obyekt_nov: "finance_operations",
          obyekt_id: opId,
          obyekt_basliq: label,
        },
      });
      revalidatePath("/maliyye/emeliyyat");
      revalidatePath("/tapshiriqlar");
      return { ok: true, data: { id: task.id } };
    } catch (e) {
      console.error("[createTaskForFinanceOp]", e);
      return { ok: false, error: "Tapşırıq yaradılmadı" };
    }
  });
}

/**
 * Get tasks linked to a finance operation via tapshiriq_obyektleri.
 */
export async function getLinkedTasksForFinanceOp(opId: string) {
  return withTenant(async () => {
    const links = await prisma.tapshiriq_obyektleri.findMany({
      where: { obyekt_nov: "finance_operations", obyekt_id: opId },
      orderBy: { yaradildi: "desc" },
      select: {
        tapshiriqlar: {
          select: {
            id: true,
            basliq: true,
            status: true,
            prioritet: true,
            deadline: true,
            yaradildi: true,
          },
        },
      },
    });
    return links
      .map((l) => l.tapshiriqlar)
      .filter((t): t is NonNullable<typeof t> => t !== null);
  });
}
