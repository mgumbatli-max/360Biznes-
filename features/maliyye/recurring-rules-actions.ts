"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { safeUserMessage } from "@/lib/error/user-message";

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const TEZLIK = ["gunluk", "heftelik", "ayliq", "illik"] as const;

const CreateSchema = z.object({
  ad: z.string().min(2).max(200),
  type_kod: z.string().min(2).max(40),
  y_n: z.enum(["daxil", "mexaric"]),
  mebleg: z.coerce.number().positive(),
  tezlik: z.enum(TEZLIK),
  hesab_id: z.string().uuid().optional().or(z.literal("")),
  kontragent_id: z.string().uuid().optional().or(z.literal("")),
  isci_id: z.string().uuid().optional().or(z.literal("")),
  expense_kateq_id: z.coerce.number().int().positive().optional().or(z.literal("")),
  baslama: z.string().min(8),
  son_tarix: z.string().min(8).optional().or(z.literal("")),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
});

function calcNext(baslama: Date, tezlik: string, sonIcra?: Date | null): Date {
  const base = sonIcra ?? baslama;
  const next = new Date(base);
  if (tezlik === "gunluk") next.setDate(next.getDate() + 1);
  else if (tezlik === "heftelik") next.setDate(next.getDate() + 7);
  else if (tezlik === "ayliq") next.setMonth(next.getMonth() + 1);
  else if (tezlik === "illik") next.setFullYear(next.getFullYear() + 1);
  return next;
}

export async function createRecurringRule(input: FormData): Promise<Result<{ id: string }>> {
  const raw = Object.fromEntries(input.entries());
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId, rolAd } = requireTenant();
    const r = (rolAd ?? "").toLowerCase();
    if (!(r.includes("sahibkar") || r.includes("owner") || r.includes("admin") || r.includes("muhasib"))) {
      return { ok: false, error: "Yalnız sahibkar/admin/muhasib təkrar qayda yarada bilər" };
    }
    try {
      const baslama = new Date(d.baslama);
      const sonraki = calcNext(baslama, d.tezlik);
      const row = await prisma.finance_recurring_rules.create({
        data: {
          sahibkar_id: sahibkarId,
          ad: d.ad,
          type_kod: d.type_kod,
          y_n: d.y_n,
          mebleg: d.mebleg,
          tezlik: d.tezlik,
          hesab_id: d.hesab_id || null,
          kontragent_id: d.kontragent_id || null,
          isci_id: d.isci_id || null,
          expense_kateq_id: d.expense_kateq_id || null,
          sonraki_icra: sonraki,
          son_tarix: d.son_tarix ? new Date(d.son_tarix) : null,
          aktiv: true,
          qeyd: d.qeyd || null,
          yaradan_id: istifadeciId,
        },
        select: { id: true },
      });
      await audit("yarat", "recurring_rule", row.id, {
        yeni_data: { ad: d.ad, type_kod: d.type_kod, tezlik: d.tezlik, mebleg: d.mebleg },
      });
      revalidatePath("/maliyye/recurring");
      return { ok: true, data: { id: row.id } };
    } catch (e) {
      console.error("[createRecurringRule]", e);
      return { ok: false, error: safeUserMessage(e, "Qayda yaradılmadı") };
    }
  });
}

export async function toggleRecurringRule(id: string, aktiv: boolean): Promise<Result> {
  return withTenant(async () => {
    const { sahibkarId, rolAd } = requireTenant();
    const r = (rolAd ?? "").toLowerCase();
    if (!(r.includes("sahibkar") || r.includes("owner") || r.includes("admin") || r.includes("muhasib"))) {
      return { ok: false, error: "İcazə yoxdur" };
    }
    try {
      const upd = await prisma.finance_recurring_rules.updateMany({
        where: { id, sahibkar_id: sahibkarId },
        data: { aktiv, yenilendi: new Date() },
      });
      if (upd.count === 0) return { ok: false, error: "Qayda tapılmadı" };
      await audit("yenile", "recurring_rule", id, {
        yeni_data: { aktiv },
        sebeb: aktiv ? "Aktivləşdirildi" : "Söndürüldü",
      });
      revalidatePath("/maliyye/recurring");
      return { ok: true };
    } catch (e) {
      console.error("[toggleRecurringRule]", e);
      return { ok: false, error: safeUserMessage(e, "Status dəyişdirilmədi") };
    }
  });
}

export async function deleteRecurringRule(id: string): Promise<Result> {
  return withTenant(async () => {
    const { sahibkarId, rolAd } = requireTenant();
    const r = (rolAd ?? "").toLowerCase();
    if (!(r.includes("sahibkar") || r.includes("owner") || r.includes("admin"))) {
      return { ok: false, error: "Yalnız sahibkar/admin silə bilər" };
    }
    try {
      const upd = await prisma.finance_recurring_rules.deleteMany({
        where: { id, sahibkar_id: sahibkarId },
      });
      if (upd.count === 0) return { ok: false, error: "Qayda tapılmadı" };
      await audit("sil", "recurring_rule", id, {});
      revalidatePath("/maliyye/recurring");
      return { ok: true };
    } catch (e) {
      console.error("[deleteRecurringRule]", e);
      return { ok: false, error: safeUserMessage(e, "Silinmədi") };
    }
  });
}

/** Cron tərəfindən çağırılır — vaxtı çatmış qaydaları icra edir. */
export async function runRecurringRules(): Promise<Result<{ executed: number }>> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let executed = 0;

    const rules = await prisma.finance_recurring_rules.findMany({
      where: {
        sahibkar_id: sahibkarId,
        aktiv: true,
        sonraki_icra: { lte: today },
        OR: [{ son_tarix: null }, { son_tarix: { gte: today } }],
      },
      take: 200,
    });

    for (const rule of rules) {
      try {
        await prisma.$transaction(async (tx) => {
          // type_id tap
          const type = await tx.finance_operation_types.findUnique({
            where: { kod: rule.type_kod },
            select: { id: true },
          });
          if (!type) return;

          // finance_operations qeyd yarat
          await tx.finance_operations.create({
            data: {
              sahibkar_id: sahibkarId,
              type_id: type.id,
              type_kod: rule.type_kod,
              y_n: rule.y_n,
              meblegh: rule.mebleg,
              azn_meblegh: rule.mebleg,
              hesab_id: rule.hesab_id,
              kontragent_id: rule.kontragent_id,
              isci_id: rule.isci_id,
              expense_kateq_id: rule.expense_kateq_id,
              status: "aktiv",
              qeyd: `[RECUR:${rule.tezlik}] ${rule.ad}`,
              yaradan_id: istifadeciId,
            },
          });

          // Hesab balansı
          if (rule.hesab_id) {
            const delta = rule.y_n === "daxil" ? Number(rule.mebleg) : -Number(rule.mebleg);
            await tx.maliye_hesablari.updateMany({
              where: { id: rule.hesab_id, sahibkar_id: sahibkarId },
              data: { qaliq: { increment: delta } },
            });
          }

          // Növbəti icra tarixini hesabla
          const sonraki = calcNext(today, rule.tezlik, today);
          await tx.finance_recurring_rules.update({
            where: { id: rule.id },
            data: {
              son_icra: today,
              sonraki_icra: sonraki,
              yenilendi: new Date(),
            },
          });
          executed++;
        });
      } catch (e) {
        console.warn(`[runRecurringRules] rule ${rule.id}:`, e);
      }
    }

    return { ok: true, data: { executed } };
  });
}
