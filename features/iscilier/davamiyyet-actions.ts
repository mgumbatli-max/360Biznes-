"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseLocalDate } from "@/lib/utils";
import { encodeMeta, SHIFTS, type ShiftKey } from "./davamiyyet-queries";

type Result = { ok: true; count?: number } | { ok: false; error: string };

const ManualSchema = z.object({
  istifadeci_id: z.string().uuid(),
  tarix: z.string().min(1), // yyyy-mm-dd
  giris: z.string().optional().or(z.literal("")), // HH:mm
  cixis: z.string().optional().or(z.literal("")),
  status: z.enum(["qaydasinda", "gecikib", "qaib", "istirahet", "mezuniyyet"]).default("qaydasinda"),
  shift: z.enum(["seher", "axsam", "gece"]).optional().or(z.literal("")),
  fasile_dq: z.coerce.number().int().min(0).max(600).optional().default(0),
  overtime_dq: z.coerce.number().int().min(0).max(600).optional().default(0),
  qeyd: z.string().max(500).optional().or(z.literal("")),
});

function timeToDate(date: string, time: string): Date | null {
  if (!time) return null;
  const [hh, mm] = time.split(":").map(Number);
  if (isNaN(hh) || isNaN(mm)) return null;
  const d = parseLocalDate(date);
  if (!d) return null;
  d.setHours(hh, mm, 0, 0);
  return d;
}

function expectedStartForShift(date: string, shift?: ShiftKey | null): Date {
  const time = shift && SHIFTS[shift] ? SHIFTS[shift].start : "09:00";
  return timeToDate(date, time)!;
}

export async function saveAttendance(input: FormData): Promise<Result> {
  const parsed = ManualSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const tarix = parseLocalDate(d.tarix);
      if (!tarix) return { ok: false, error: "Tarix yanlışdır" };
      tarix.setHours(0, 0, 0, 0);
      const giris = timeToDate(d.tarix, d.giris ?? "");
      const cixis = timeToDate(d.tarix, d.cixis ?? "");
      const shift = (d.shift || null) as ShiftKey | null;

      const expected = expectedStartForShift(d.tarix, shift);
      const gec_dq = giris && giris > expected ? Math.round((giris.getTime() - expected.getTime()) / 60000) : 0;

      // Worked hours = (cixis - giris) - fasile
      let ish_saatlari: number | null = null;
      if (giris && cixis) {
        const diffMin = Math.max(0, Math.round((cixis.getTime() - giris.getTime()) / 60000) - Number(d.fasile_dq ?? 0));
        ish_saatlari = Math.round((diffMin / 60) * 100) / 100;
      }

      const meta = encodeMeta({ qeyd: d.qeyd || null, shift, fasile_dq: d.fasile_dq, overtime_dq: d.overtime_dq });

      await prisma.davamiyyet.upsert({
        where: {
          istifadeci_id_tarix: { istifadeci_id: d.istifadeci_id, tarix },
        },
        update: {
          giris_saat: giris,
          cixis_saat: cixis,
          gec_dq,
          ish_saatlari: ish_saatlari ?? undefined,
          status: d.status,
          qeyd: meta || null,
        },
        create: {
          sahibkar_id: sahibkarId,
          istifadeci_id: d.istifadeci_id,
          tarix,
          giris_saat: giris,
          cixis_saat: cixis,
          gozlenen_giris: expected,
          gec_dq,
          ish_saatlari: ish_saatlari ?? undefined,
          status: d.status,
          qeyd: meta || null,
          yaradan_id: istifadeciId,
        },
      });

      // Auto-disciplinary: 5+ consecutive late days → flag warning in a settings JSON (no schema change)
      await maybeAutoWarn(d.istifadeci_id);

      revalidatePath("/iscilier/davamiyyet");
      return { ok: true };
    } catch (e) {
      console.error("[saveAttendance]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

/**
 * Quick attendance set: one-click "Gəldi / Gecikdi / Qaib" for a single user on
 * a given date. Used by the grid-row sürətli düymə UX.
 */
const QuickSchema = z.object({
  istifadeci_id: z.string().uuid(),
  tarix: z.string().min(1),
  status: z.enum(["qaydasinda", "gecikib", "qaib"]),
  gec_dq: z.coerce.number().int().min(0).max(600).optional().default(0),
});

export async function quickMarkAttendance(input: FormData): Promise<Result> {
  const parsed = QuickSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const tarix = parseLocalDate(d.tarix);
      if (!tarix) return { ok: false, error: "Tarix yanlışdır" };
      tarix.setHours(0, 0, 0, 0);
      const expected = new Date(tarix);
      expected.setHours(9, 0, 0, 0);

      let giris: Date | null = null;
      let gec_dq = 0;
      if (d.status === "qaydasinda") {
        giris = new Date(expected);
      } else if (d.status === "gecikib") {
        gec_dq = Number(d.gec_dq ?? 15) || 15;
        giris = new Date(expected.getTime() + gec_dq * 60000);
      }

      await prisma.davamiyyet.upsert({
        where: { istifadeci_id_tarix: { istifadeci_id: d.istifadeci_id, tarix } },
        update: {
          status: d.status,
          giris_saat: giris,
          gec_dq,
        },
        create: {
          sahibkar_id: sahibkarId,
          istifadeci_id: d.istifadeci_id,
          tarix,
          giris_saat: giris,
          gozlenen_giris: expected,
          gec_dq,
          status: d.status,
          yaradan_id: istifadeciId,
        },
      });
      revalidatePath("/iscilier/davamiyyet");
      return { ok: true };
    } catch (e) {
      console.error("[quickMarkAttendance]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function markAllPresentToday(): Promise<Result> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const employees = await prisma.istifadeciler.findMany({
        where: { aktiv: true, isden_cixdi: null, sahibkar_id: sahibkarId },
        select: { id: true },
      });
      const expected = new Date(today);
      expected.setHours(9, 0, 0, 0);
      let count = 0;
      for (const e of employees) {
        await prisma.davamiyyet.upsert({
          where: { istifadeci_id_tarix: { istifadeci_id: e.id, tarix: today } },
          update: {},
          create: {
            sahibkar_id: sahibkarId,
            istifadeci_id: e.id,
            tarix: today,
            giris_saat: expected,
            gozlenen_giris: expected,
            gec_dq: 0,
            status: "qaydasinda",
            yaradan_id: istifadeciId,
          },
        });
        count++;
      }
      revalidatePath("/iscilier/davamiyyet");
      return { ok: true, count };
    } catch (e) {
      console.error("[markAllPresentToday]", e);
      return { ok: false, error: "Alınmadı" };
    }
  });
}

/** Stores warning records as ayarlar-JSON; returns silently on errors. */
async function maybeAutoWarn(istifadeci_id: string): Promise<void> {
  try {
    const { sahibkarId } = requireTenant();
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const lateRows = await prisma.davamiyyet.findMany({
      where: { sahibkar_id: sahibkarId, istifadeci_id, tarix: { gte: since } },
      orderBy: { tarix: "asc" },
    });
    let streak = 0;
    for (const r of lateRows) {
      if ((r.gec_dq ?? 0) > 0) streak++;
      else streak = 0;
    }
    if (streak < 5) return;

    // Append warning to ayarlar JSON (grup=hr_warning, acar=istifadeci_id)
    const key = `warn:${istifadeci_id}`;
    const existing = await prisma.ayarlar.findUnique({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "hr_warning", acar: key } },
    });
    const list = existing ? safeJsonArray(existing.deyer) : [];
    const tag = `auto-late-${new Date().toISOString().slice(0, 10)}`;
    if (list.some((w) => w.tag === tag)) return;
    list.push({
      tag,
      nov: "gecikme",
      tarix: new Date().toISOString(),
      sebeb: `Ardıcıl ${streak} gün gecikmə`,
      auto: true,
    });
    await prisma.ayarlar.upsert({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "hr_warning", acar: key } },
      update: { deyer: JSON.stringify(list), nov: "json" },
      create: {
        sahibkar_id: sahibkarId,
        qrup: "hr_warning",
        acar: key,
        deyer: JSON.stringify(list),
        nov: "json",
      },
    });
  } catch (e) {
    console.error("[maybeAutoWarn]", e);
  }
}

function safeJsonArray(s: string | null): Array<{ tag: string; nov: string; tarix: string; sebeb: string; auto?: boolean; by?: string | null }> {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/* ----------------- Disciplinary: manual warning ----------------- */

const WarnSchema = z.object({
  istifadeci_id: z.string().uuid(),
  nov: z.enum(["gecikme", "qaiblik", "intizam", "diger"]),
  sebeb: z.string().min(2).max(500),
});

export async function addWarning(input: FormData): Promise<Result> {
  const parsed = WarnSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const key = `warn:${parsed.data.istifadeci_id}`;
      const existing = await prisma.ayarlar.findUnique({
        where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "hr_warning", acar: key } },
      });
      const list = existing ? safeJsonArray(existing.deyer) : [];
      list.push({
        tag: `manual-${Date.now()}`,
        nov: parsed.data.nov,
        tarix: new Date().toISOString(),
        sebeb: parsed.data.sebeb,
        auto: false,
        by: istifadeciId,
      });
      await prisma.ayarlar.upsert({
        where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "hr_warning", acar: key } },
        update: { deyer: JSON.stringify(list), nov: "json" },
        create: {
          sahibkar_id: sahibkarId,
          qrup: "hr_warning",
          acar: key,
          deyer: JSON.stringify(list),
          nov: "json",
        },
      });
      revalidatePath(`/iscilier/${parsed.data.istifadeci_id}`);
      return { ok: true };
    } catch (e) {
      console.error("[addWarning]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}
