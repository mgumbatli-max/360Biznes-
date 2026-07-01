"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { requireTapshiriqPerm } from "./actions";


const Schema = z.object({
  basliq:       z.string().trim().min(1, "Başlıq mütləqdir").max(200),
  tesvir:       z.string().trim().max(2000).optional(),
  prioritet:    z.enum(["asagi", "normal", "yuksek", "tecili"]).default("normal"),
  mesul_id:     z.string().uuid().optional(),
  deadline:     z.string().optional(),     // YYYY-MM-DD or ISO
  obyekt_nov:   z.string().min(1).optional(),
  obyekt_id:    z.string().min(1).optional(),
  obyekt_basliq: z.string().max(300).optional(),
});

type Result = { ok: true; task_id: string } | { ok: false; error: string };

/**
 * Cross-module task creation. Any module (məhsul, müştəri, satış, servis…) can call
 * this to spawn a task linked to its entity. The link is stored in `tapshiriq_obyektleri`
 * so the task detail page can show the source and module pages can list related tasks.
 *
 * Example from a product page:
 *   await createTaskFor({
 *     basliq: "Yeni şəkil yüklə",
 *     obyekt_nov: "mehsul",
 *     obyekt_id: product.id,
 *     obyekt_basliq: product.ad,
 *     prioritet: "yuksek",
 *   });
 */
export async function createTaskFor(input: z.input<typeof Schema>): Promise<Result> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış məlumat" };
  const d = parsed.data;

  // İcazə: tapşırıq yarat (sahibkar/admin/owner bypass edir). Əvvəl bu action
  // guard-sız idi — istənilən istifadəçi obyekt-bağlı tapşırıq yarada bilirdi.
  const permCheck = await requireTapshiriqPerm("tapshiriq.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

    return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // Deadline validasiyası — Invalid Date DB-yə yazılmasın.
      const deadline = d.deadline ? new Date(d.deadline) : null;
      if (deadline && Number.isNaN(deadline.getTime())) {
        return { ok: false as const, error: "Deadline tarixi yanlışdır" };
      }
      const mesulId = d.mesul_id ?? istifadeciId;
      // Başqa işçiyə təyinat üçün tapshiriq.atayir icazəsi (öz-özünə istisnadır).
      if (d.mesul_id && d.mesul_id !== istifadeciId) {
        const assign = await requireTapshiriqPerm("tapshiriq.atayir");
        if (!assign.ok) return { ok: false as const, error: "Başqa işçiyə tapşırıq təyin etmək icazəniz yoxdur" };
      }

      const task = await prisma.$transaction(async (tx) => {
        const t = await tx.tapshiriqlar.create({
          data: {
            sahibkar_id: sahibkarId,
            yaradan_id: istifadeciId,
            mesul_id: mesulId,
            basliq: d.basliq,
            tesvir: d.tesvir || null,
            prioritet: d.prioritet,
            status: "yeni",
            deadline,
          },
          select: { id: true },
        });

        // tapshiriq_iscilier-ə mesul-u "icraci" rolu ilə əlavə et — bu olmadan
        // "mənim tapşırıqlarım" sorğusu icracilar tərəfi tapa bilmir.
        await tx.tapshiriq_iscilier.create({
          data: { tapshiriq_id: t.id, istifadeci_id: mesulId, rol: "icraci" },
        }).catch(() => null);

        // Cross-module link
        if (d.obyekt_nov && d.obyekt_id) {
          await tx.tapshiriq_obyektleri.create({
            data: {
              sahibkar_id: sahibkarId,
              tapshiriq_id: t.id,
              obyekt_nov: d.obyekt_nov,
              obyekt_id: d.obyekt_id,
              obyekt_basliq: d.obyekt_basliq ?? null,
            },
          });
        }

        // Bildiriş — yalnız mesul yaradandan fərqli olsa
        if (mesulId !== istifadeciId) {
          await tx.bildirisler.create({
            data: {
              istifadeci_id: mesulId,
              sahibkar_id: sahibkarId,
              basliq: `Yeni tapşırıq: ${d.basliq}`.slice(0, 200),
              metn: d.tesvir ?? null,
              nov: "tapshiriq_yeni",
              link: `/tapshiriqlar/${t.id}`,
              resurs_nov: "tapshiriq",
              resurs_id: t.id,
            },
          }).catch(() => null);
        }

        return t;
      });

      revalidatePath("/tapshiriqlar");
      if (mesulId !== istifadeciId) {
        revalidateTag(`bildirisler:${sahibkarId}:${mesulId}`, "max");
      }
      return { ok: true, task_id: task.id };
    } catch (e) {
      console.error("[createTaskFor]", e);
      return { ok: false, error: "Tapşırıq yaradılmadı" };
    }
  });
}

/** Tasks linked to a specific entity. Useful for module detail pages. */
export async function getTasksForObject(obyekt_nov: string, obyekt_id: string, limit = 20) {
  return withTenant(async () => {
    const links = await prisma.tapshiriq_obyektleri.findMany({
      where: { obyekt_nov, obyekt_id },
      include: {
        tapshiriqlar: {
          include: {
            istifadeciler_tapshiriqlar_mesul_idToistifadeciler: { select: { ad_soyad: true } },
          },
        },
      },
      orderBy: { yaradildi: "desc" },
      take: limit,
    });
    return links.map((l) => ({
      id: l.tapshiriqlar.id,
      basliq: l.tapshiriqlar.basliq,
      status: l.tapshiriqlar.status,
      prioritet: l.tapshiriqlar.prioritet,
      deadline: l.tapshiriqlar.deadline,
      mesul_ad: l.tapshiriqlar.istifadeciler_tapshiriqlar_mesul_idToistifadeciler?.ad_soyad ?? null,
      yaradildi: l.tapshiriqlar.yaradildi,
    }));
  });
}

/** Counts per module — used for the "Modul bağlantı" tab. */
export type ModuleTaskCounts = {
  obyekt_nov: string;
  total: number;
  open: number;
  overdue: number;
}[];

export async function getModuleTaskCounts(): Promise<ModuleTaskCounts> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<{ obyekt_nov: string; total: number; open: number; overdue: number }[]>`
      SELECT to_.obyekt_nov,
             COUNT(*)::int AS total,
             SUM(CASE WHEN t.status NOT IN ('tamamlandi','legv') THEN 1 ELSE 0 END)::int AS open,
             SUM(CASE WHEN t.deadline IS NOT NULL AND t.deadline < NOW() AND t.status NOT IN ('tamamlandi','legv') THEN 1 ELSE 0 END)::int AS overdue
        FROM tapshiriq_obyektleri to_
        JOIN tapshiriqlar t ON t.id = to_.tapshiriq_id
       WHERE to_.sahibkar_id = ${sahibkarId}::uuid
       GROUP BY to_.obyekt_nov
       ORDER BY total DESC
    `.catch(() => [] as { obyekt_nov: string; total: number; open: number; overdue: number }[]);
    return rows.map((r) => ({
      obyekt_nov: r.obyekt_nov,
      total: Number(r.total),
      open: Number(r.open),
      overdue: Number(r.overdue),
    }));
  });
}
