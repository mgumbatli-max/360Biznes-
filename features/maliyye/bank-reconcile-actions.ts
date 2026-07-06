"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { safeUserMessage } from "@/lib/error/user-message";

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const MatchSchema = z.object({
  item_id: z.coerce.number().int().positive(),
  op_id: z.string().uuid(),
});

/**
 * Manual match — bank statement sətrini mövcud finance_operations-a bağla.
 */
export async function matchBankItem(input: FormData): Promise<Result> {
  const parsed = MatchSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  const { requireMaliyyeActionPerm } = await import("./access-guard");
  const permCheck = await requireMaliyyeActionPerm(["bank.emeliyyat", "bank.import", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const [item, op] = await Promise.all([
        prisma.finance_bank_statement_items.findFirst({
          where: { id: d.item_id, sahibkar_id: sahibkarId },
          select: { id: true, meblegh: true, y_n: true, status: true },
        }),
        prisma.finance_operations.findFirst({
          where: { id: d.op_id, sahibkar_id: sahibkarId },
          select: { id: true, meblegh: true, y_n: true },
        }),
      ]);
      if (!item) return { ok: false, error: "Bank sətri tapılmadı" };
      if (!op) return { ok: false, error: "Maliyyə əməliyyatı tapılmadı" };
      if (item.status === "eslesdi") return { ok: false, error: "Artıq match olunub" };
      // QA-audit: op_id-nin BAŞQA bank sətrinə artıq bağlı olub-olmadığı yoxlanmırdı → bir maliyyə
      // əməliyyatı çoxlu bank sətrinə əl ilə match edilə, hesabatı təhrif edə bilirdi.
      const opAlreadyMatched = await prisma.finance_bank_statement_items.findFirst({
        where: { sahibkar_id: sahibkarId, matched_op_id: d.op_id, status: "eslesdi", NOT: { id: d.item_id } },
        select: { id: true },
      });
      if (opAlreadyMatched) return { ok: false, error: "Bu maliyyə əməliyyatı artıq başqa bank sətri ilə uyğunlaşdırılıb" };

      const meblegFerq = Math.abs(Number(item.meblegh) - Number(op.meblegh));
      const yonUyumlu = item.y_n === op.y_n;
      const confidence = yonUyumlu && meblegFerq < 0.01 ? 100 : yonUyumlu ? 70 : 40;

      await prisma.finance_bank_statement_items.update({
        where: { id: d.item_id },
        data: {
          matched_op_id: d.op_id,
          match_confidence: confidence,
          match_kind: "manual",
          matched_by: istifadeciId,
          matched_at: new Date(),
          status: "eslesdi",
        },
      });

      await audit("yenile", "bank_statement_item", String(d.item_id), {
        yeni_data: { op_id: d.op_id, confidence, kind: "manual" },
      });
      revalidatePath("/maliyye/bank");
      return { ok: true };
    } catch (e) {
      console.error("[matchBankItem]", e);
      return { ok: false, error: safeUserMessage(e, "Match alınmadı") };
    }
  });
}

/** Match-i ləğv et — sətri "eslesmiyib" statusuna qaytarır. */
export async function unmatchBankItem(itemId: number): Promise<Result> {
  const { requireMaliyyeActionPerm } = await import("./access-guard");
  const permCheck = await requireMaliyyeActionPerm(["bank.emeliyyat", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const upd = await prisma.finance_bank_statement_items.updateMany({
        where: { id: itemId, sahibkar_id: sahibkarId },
        data: {
          matched_op_id: null,
          match_confidence: null,
          match_kind: null,
          matched_by: null,
          matched_at: null,
          status: "eslesmiyib",
        },
      });
      if (upd.count === 0) return { ok: false, error: "Sətir tapılmadı" };
      await audit("yenile", "bank_statement_item", String(itemId), {
        sebeb: "Match ləğv edildi",
        yeni_data: { user: istifadeciId },
      });
      revalidatePath("/maliyye/bank");
      return { ok: true };
    } catch (e) {
      console.error("[unmatchBankItem]", e);
      return { ok: false, error: safeUserMessage(e, "Ləğv alınmadı") };
    }
  });
}

/**
 * Auto-match — bank çıxarışındakı sətrləri tarix±3 gün + ±1 qəpik uyğunluğu
 * ilə avtomatik bağlayır. Birdən çox kandidat varsa skip edilir (manual hövzəyə qalır).
 */
export async function autoMatchStatement(statementId: number): Promise<Result<{ matched: number; ambiguous: number }>> {
  const { requireMaliyyeActionPerm } = await import("./access-guard");
  const permCheck = await requireMaliyyeActionPerm(["bank.emeliyyat", "bank.import", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const items = await prisma.finance_bank_statement_items.findMany({
        where: {
          statement_id: statementId,
          sahibkar_id: sahibkarId,
          status: "eslesmiyib",
        },
        select: { id: true, tarix: true, meblegh: true, y_n: true },
      });

      let matched = 0;
      let ambiguous = 0;
      const DAY = 24 * 60 * 60 * 1000;

      for (const item of items) {
        const tarix = new Date(item.tarix);
        const minDate = new Date(tarix.getTime() - 3 * DAY);
        const maxDate = new Date(tarix.getTime() + 3 * DAY);
        const minMeb = Number(item.meblegh) - 0.01;
        const maxMeb = Number(item.meblegh) + 0.01;

        const candidates = await prisma.finance_operations.findMany({
          where: {
            sahibkar_id: sahibkarId,
            status: "aktiv",
            y_n: item.y_n,
            tarix: { gte: minDate, lte: maxDate },
            meblegh: { gte: minMeb, lte: maxMeb },
            // Hələ match olunmamış əməliyyat
            finance_bank_statement_items: { none: { sahibkar_id: sahibkarId, status: "eslesdi" } },
          },
          select: { id: true },
          take: 2,
        });

        if (candidates.length === 1) {
          // QA-audit: candidate seçimi ilə update arası paralel çağırış eyni op-u iki sətrə match edə
          // bilir (tx yox). Update-dən əvvəl op-un artıq başqa sətrə bağlı olmadığını RE-CHECK et +
          // update-i yalnız sətir hələ match olunmamışkən (status guard).
          const opAlreadyMatched = await prisma.finance_bank_statement_items.findFirst({
            where: { sahibkar_id: sahibkarId, matched_op_id: candidates[0].id, status: "eslesdi" },
            select: { id: true },
          });
          if (opAlreadyMatched) { ambiguous++; continue; }
          const upd = await prisma.finance_bank_statement_items.updateMany({
            where: { id: item.id, status: { not: "eslesdi" } },
            data: {
              matched_op_id: candidates[0].id,
              match_confidence: 95,
              match_kind: "auto",
              matched_by: istifadeciId,
              matched_at: new Date(),
              status: "eslesdi",
            },
          });
          if (upd.count > 0) matched++;
        } else if (candidates.length > 1) {
          ambiguous++;
        }
      }

      await audit("icra", "bank_auto_match", String(statementId), {
        yeni_data: { matched, ambiguous, total: items.length },
        sebeb: `Auto-match: ${matched}/${items.length} bağlandı, ${ambiguous} ikili`,
      });
      revalidatePath("/maliyye/bank");
      return { ok: true, data: { matched, ambiguous } };
    } catch (e) {
      console.error("[autoMatchStatement]", e);
      return { ok: false, error: safeUserMessage(e, "Auto-match alınmadı") };
    }
  });
}
