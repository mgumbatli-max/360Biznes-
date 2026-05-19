"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { deleteEntry, getEntry, listEntries, nextId, setEntry } from "./hr-store";
import type { Treninq, TreninqQeyd } from "./treninq-queries";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const TreninqSchema = z.object({
  id: z.string().optional().or(z.literal("")),
  ad: z.string().min(2).max(150),
  muddet_saat: z.coerce.number().min(0).max(2000),
  xerc: z.coerce.number().min(0),
  teleb_seviyye: z.string().max(60).optional().or(z.literal("")),
  tesvir: z.string().max(1000).optional().or(z.literal("")),
  mecburi: z.coerce.boolean().optional().default(false),
});

export async function saveTreninq(input: FormData): Promise<Result<string>> {
  const data = Object.fromEntries(input.entries());
  // Checkbox handling
  data.mecburi = (input.get("mecburi") ? "true" : "false") as unknown as FormDataEntryValue;
  const parsed = TreninqSchema.safeParse(data);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  return withTenant(async () => {
    const id = parsed.data.id || nextId();
    const treninq: Treninq = {
      id,
      ad: parsed.data.ad,
      muddet_saat: parsed.data.muddet_saat,
      xerc: parsed.data.xerc,
      teleb_seviyye: parsed.data.teleb_seviyye || "",
      tesvir: parsed.data.tesvir || "",
      mecburi: Boolean(parsed.data.mecburi),
    };
    await setEntry("hr_treninq", id, treninq, treninq.ad);
    revalidatePath("/iscilier/treninq");
    return { ok: true, data: id };
  });
}

const DeleteSchema = z.object({ id: z.string().min(1) });

export async function deleteTreninq(input: FormData): Promise<Result> {
  const parsed = DeleteSchema.safeParse({ id: input.get("id") });
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  return withTenant(async () => {
    // Cascade delete qeydler
    const qeydler = await listEntries<TreninqQeyd>("hr_treninq_qeyd");
    for (const q of qeydler) {
      if (q.data.treninq_id === parsed.data.id) {
        await deleteEntry("hr_treninq_qeyd", q.acar);
      }
    }
    await deleteEntry("hr_treninq", parsed.data.id);
    revalidatePath("/iscilier/treninq");
    return { ok: true };
  });
}

const AssignSchema = z.object({
  treninq_id: z.string().min(1),
  istifadeci_id: z.string().uuid(),
});

export async function assignTreninq(input: FormData): Promise<Result> {
  const parsed = AssignSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  return withTenant(async () => {
    const treninq = await getEntry<Treninq>("hr_treninq", parsed.data.treninq_id);
    if (!treninq) return { ok: false, error: "Treninq tapılmadı" };
    const emp = await prisma.istifadeciler.findUnique({
      where: { id: parsed.data.istifadeci_id },
      select: { ad_soyad: true },
    });
    if (!emp) return { ok: false, error: "İşçi tapılmadı" };
    const id = nextId();
    const qeyd: TreninqQeyd = {
      id,
      treninq_id: parsed.data.treninq_id,
      istifadeci_id: parsed.data.istifadeci_id,
      istifadeci_ad: emp.ad_soyad,
      status: "teyin",
      teyin_tarix: new Date().toISOString(),
      baslama_tarix: null,
      tamam_tarix: null,
      sertifikat_url: null,
    };
    await setEntry("hr_treninq_qeyd", id, qeyd, `${emp.ad_soyad} → ${treninq.ad}`);
    revalidatePath("/iscilier/treninq");
    return { ok: true };
  });
}

const UpdateQeydSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["teyin", "basladi", "tamam"]),
  sertifikat_url: z.string().max(500).optional().or(z.literal("")),
});

export async function updateTreninqQeyd(input: FormData): Promise<Result> {
  const parsed = UpdateQeydSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  return withTenant(async () => {
    const existing = await getEntry<TreninqQeyd>("hr_treninq_qeyd", parsed.data.id);
    if (!existing) return { ok: false, error: "Qeyd tapılmadı" };
    const now = new Date().toISOString();
    const updated: TreninqQeyd = {
      ...existing,
      status: parsed.data.status,
      baslama_tarix: parsed.data.status === "basladi" && !existing.baslama_tarix ? now : existing.baslama_tarix,
      tamam_tarix: parsed.data.status === "tamam" ? now : null,
      sertifikat_url: parsed.data.sertifikat_url || existing.sertifikat_url,
    };
    await setEntry("hr_treninq_qeyd", parsed.data.id, updated);
    revalidatePath("/iscilier/treninq");
    return { ok: true };
  });
}

export async function deleteTreninqQeyd(input: FormData): Promise<Result> {
  const parsed = DeleteSchema.safeParse({ id: input.get("id") });
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  return withTenant(async () => {
    await deleteEntry("hr_treninq_qeyd", parsed.data.id);
    revalidatePath("/iscilier/treninq");
    return { ok: true };
  });
}
