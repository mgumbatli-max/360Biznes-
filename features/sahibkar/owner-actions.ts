"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult = { ok: true; id?: string | number } | { ok: false; error: string };

const NoteSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  basliq: z.string().max(200).optional().or(z.literal("")),
  metn: z.string().max(20000).optional().or(z.literal("")),
  reng: z.string().max(20).optional().or(z.literal("")),
  pinned: z.coerce.boolean().optional(),
});

export async function saveNot(input: FormData): Promise<ActionResult> {
  const parsed = NoteSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const data = {
      basliq: d.basliq?.trim() || null,
      metn: d.metn?.trim() || null,
      reng: d.reng?.trim() || "sari",
      pinned: !!d.pinned,
      yenilendi: new Date(),
    };
    let row;
    if (d.id) {
      row = await prisma.sahibkar_qeyd.update({ where: { id: d.id }, data });
    } else {
      row = await prisma.sahibkar_qeyd.create({
        data: { ...data, sahibkar_id: sahibkarId, istifadeci_id: istifadeciId },
      });
    }
    revalidatePath("/sahibkar/not");
    revalidatePath("/sahibkar/qeyd");
    revalidatePath("/sahibkar");
    return { ok: true, id: row.id };
  });
}

export async function deleteNot(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    await prisma.sahibkar_qeyd.delete({ where: { id } });
    revalidatePath("/sahibkar/not");
    revalidatePath("/sahibkar/qeyd");
    revalidatePath("/sahibkar");
    return { ok: true };
  });
}

const TaskSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  basliq: z.string().min(2).max(200),
  tesvir: z.string().max(5000).optional().or(z.literal("")),
  tarix: z.string().optional().or(z.literal("")),
  prioritet: z.string().max(20).optional().or(z.literal("")),
  status: z.string().max(20).optional().or(z.literal("")),
  istifadeci_id: z.string().uuid().optional().or(z.literal("")),
});

export async function saveTapshiriq(input: FormData): Promise<ActionResult> {
  const parsed = TaskSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const data = {
      basliq: d.basliq.trim(),
      tesvir: d.tesvir?.trim() || null,
      tarix: d.tarix ? new Date(d.tarix) : null,
      prioritet: d.prioritet?.trim() || "orta",
      status: d.status?.trim() || "acig",
      istifadeci_id: d.istifadeci_id ? d.istifadeci_id : null,
      yenilendi: new Date(),
    };
    let row;
    if (d.id) {
      row = await prisma.sahibkar_tapshiriq.update({ where: { id: d.id }, data });
    } else {
      row = await prisma.sahibkar_tapshiriq.create({ data: { ...data, sahibkar_id: sahibkarId } });
    }
    revalidatePath("/sahibkar/tapshiriq");
    revalidatePath("/sahibkar");
    return { ok: true, id: row.id };
  });
}

export async function updateTaskStatus(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!id || !status) return { ok: false, error: "Forma yanlışdır" };
  return withTenant(async () => {
    await prisma.sahibkar_tapshiriq.update({ where: { id }, data: { status, yenilendi: new Date() } });
    revalidatePath("/sahibkar/tapshiriq");
    return { ok: true };
  });
}

const BranchSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  ad: z.string().min(2).max(100),
  unvan: z.string().max(500).optional().or(z.literal("")),
  telefon: z.string().max(20).optional().or(z.literal("")),
  seh_r: z.string().max(80).optional().or(z.literal("")),
  tip: z.string().max(30).optional().or(z.literal("")),
});

export async function saveFilial(input: FormData): Promise<ActionResult> {
  const parsed = BranchSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const data = {
      ad: d.ad.trim(),
      unvan: d.unvan?.trim() || null,
      telefon: d.telefon?.trim() || null,
      seh_r: d.seh_r?.trim() || null,
      tip: d.tip?.trim() || "magaza",
      yenilendi: new Date(),
    };
    let row;
    if (d.id) {
      row = await prisma.filiallar.update({ where: { id: d.id }, data });
    } else {
      row = await prisma.filiallar.create({ data: { ...data, sahibkar_id: sahibkarId } });
    }
    revalidatePath("/sahibkar/filiallar");
    revalidatePath("/sahibkar");
    return { ok: true, id: row.id };
  });
}

export async function takeSnapshot(): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [sales, openTasks] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { tarix: { gte: dayStart }, status: { not: "legv" } },
        _sum: { son_mebleg: true },
        _count: { _all: true },
      }),
      prisma.sahibkar_tapshiriq.count({ where: { sahibkar_id: sahibkarId, status: { in: ["acig", "isleyir"] } } }),
    ]);
    const revenue = Number(sales._sum.son_mebleg ?? 0);
    const snap = {
      revenue,
      orders: sales._count._all,
      open_tasks: openTasks,
    };
    const row = await prisma.sahibkar_snapshot.create({
      data: {
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        obyekt_nov: "gunluk",
        basliq: `Gündəlik snapshot — ${now.toLocaleDateString("az-AZ")}`,
        tarix: dayStart,
        mebleg: revenue,
        snapshot_json: snap,
      },
    });
    revalidatePath("/sahibkar/snapshot");
    return { ok: true, id: row.id.toString() };
  });
}

const PartiyaSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  ad: z.string().min(2).max(200),
  olke: z.string().max(50).optional().or(z.literal("")),
  valyuta: z.string().max(10).optional().or(z.literal("")),
  status: z.string().max(20).optional().or(z.literal("")),
});

export async function savePartiya(input: FormData): Promise<ActionResult> {
  const parsed = PartiyaSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const data = {
      ad: d.ad.trim(),
      olke: d.olke?.trim() || null,
      valyuta: d.valyuta?.trim() || "USD",
      status: d.status?.trim() || "qaralama",
      yenilendi: new Date(),
    };
    let row;
    if (d.id) {
      row = await prisma.sahibkar_partiya.update({ where: { id: d.id }, data });
    } else {
      row = await prisma.sahibkar_partiya.create({
        data: { ...data, sahibkar_id: sahibkarId, yaradan_id: istifadeciId },
      });
    }
    revalidatePath("/sahibkar/partiya");
    return { ok: true, id: row.id };
  });
}

export async function runDataHealth(): Promise<ActionResult> {
  return withTenant(async () => {
    revalidatePath("/sahibkar/data-saglamligi");
    return { ok: true };
  });
}

/** Toggle daily auto-snapshot via ayarlar (qrup=snapshot_cron, acar=aktiv). */
export async function setSnapshotCron(aktiv: boolean): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    await prisma.ayarlar.upsert({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "snapshot_cron", acar: "aktiv" } },
      update: { deyer: String(aktiv), nov: "boolean", yenilendi: new Date() },
      create: { sahibkar_id: sahibkarId, qrup: "snapshot_cron", acar: "aktiv", deyer: String(aktiv), nov: "boolean" },
    });
    revalidatePath("/sahibkar/snapshot");
    return { ok: true };
  });
}

/** Add a comment to an owner task by appending to the JSON in `qeyd` field. */
const TaskCommentSchema = z.object({
  id: z.coerce.number().int().positive(),
  text: z.string().min(1).max(2000),
});
export async function addTaskComment(input: FormData): Promise<ActionResult> {
  const parsed = TaskCommentSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Şərh yanlışdır" };
  const { id, text } = parsed.data;
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    const row = await prisma.sahibkar_tapshiriq.findUnique({ where: { id }, include: { istifadeciler: { select: { ad_soyad: true } } } });
    if (!row) return { ok: false, error: "Tapşırıq tapılmadı" };

    let list: Array<{ at: string; user_id: string | null; user: string | null; text: string }> = [];
    if (row.qeyd) {
      try {
        const parsedJson = JSON.parse(row.qeyd);
        if (Array.isArray(parsedJson)) list = parsedJson;
      } catch {
        list = [];
      }
    }
    list.push({
      at: new Date().toISOString(),
      user_id: istifadeciId,
      user: row.istifadeciler?.ad_soyad ?? null,
      text: text.trim(),
    });
    await prisma.sahibkar_tapshiriq.update({
      where: { id },
      data: { qeyd: JSON.stringify(list), yenilendi: new Date() },
    });
    revalidatePath("/sahibkar/tapshiriq");
    return { ok: true, id };
  });
}
