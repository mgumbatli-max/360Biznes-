"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseLocalDate } from "@/lib/utils";
import { audit } from "@/lib/audit/log";
import { requireHrActionPerm, bustHrCache } from "./access-guard";

type Result = { ok: true; id?: number; qalan?: number } | { ok: false; error: string };

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

/**
 * Cari ilin başlanğıcından bu vaxta qədər istifadəçinin TƏSDİQ olunmuş və
 * gözləyən sorğularda istifadə etdiyi məzuniyyət günü cəmi.
 */
async function consumedLeaveDays(istifadeciId: string): Promise<number> {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const rows = await prisma.isci_mezuniyyet.findMany({
    where: {
      istifadeci_id: istifadeciId,
      status: { in: ["tesdiq", "gozleyir"] },
      baslama: { gte: yearStart },
    },
    select: { gun_sayi: true },
  });
  return rows.reduce((s, r) => s + Number(r.gun_sayi ?? 0), 0);
}

const DEFAULT_ILLIK_LIMIT = 21; // İş Məcəlləsi minimum

export async function saveLeaveRequest(input: FormData): Promise<Result> {
  const parsed = LeaveSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    // İcazə: özü üçün istəyə bilər (mezuniyyet.istek), başqası üçün mezuniyyet.tesdiq
    if (d.istifadeci_id !== istifadeciId) {
      const permCheck = await requireHrActionPerm("mezuniyyet.tesdiq");
      if (!permCheck.ok) return { ok: false, error: permCheck.error };
    } else {
      const permCheck = await requireHrActionPerm(["mezuniyyet.istek", "mezuniyyet.tesdiq"]);
      if (!permCheck.ok) return { ok: false, error: permCheck.error };
    }
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

      // YENI: Balans yoxlaması — illik limit + artıq istifadə olunmuş
      // Yalnız "illik" nov üçün balans tutulur.
      let qalanSonra = -1;
      if (d.nov === "illik") {
        const consumed = await consumedLeaveDays(d.istifadeci_id);
        // İstifadəçi-yə görə ayrı limit ola bilər — istifadeciler.illik_mezuniyyet_limiti
        const u = await prisma.istifadeciler.findUnique({
          where: { id: d.istifadeci_id },
          select: { illik_mezuniyyet_limiti: true } as never,
        }).catch(() => null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const limit = Number((u as any)?.illik_mezuniyyet_limiti ?? DEFAULT_ILLIK_LIMIT);
        // Redaktə halında köhnə sorğunun günü çıxarılır
        let consumedAdj = consumed;
        if (d.id) {
          const existing = await prisma.isci_mezuniyyet.findUnique({
            where: { id: d.id },
            select: { gun_sayi: true },
          });
          consumedAdj -= Number(existing?.gun_sayi ?? 0);
        }
        if (consumedAdj + gun_sayi > limit) {
          return { ok: false, error: `Məzuniyyət balansı kifayət deyil: qalan ${Math.max(0, limit - consumedAdj)} gün, istənən ${gun_sayi}` };
        }
        qalanSonra = limit - consumedAdj - gun_sayi;
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
        bustHrCache();
        await audit("yenile", "isci_mezuniyyet", d.id, {
          yeni_data: { istifadeci_id: d.istifadeci_id, nov: d.nov, baslama: d.baslama, bitme: d.bitme, gun_sayi },
          sebeb: "Məzuniyyət sorğusu redaktə",
        });
        return { ok: true, id: d.id, qalan: qalanSonra >= 0 ? qalanSonra : undefined };
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
      bustHrCache();
      await audit("yarat", "isci_mezuniyyet", created.id, {
        yeni_data: { istifadeci_id: d.istifadeci_id, nov: d.nov, baslama: d.baslama, bitme: d.bitme, gun_sayi },
        sebeb: "Yeni məzuniyyət sorğusu",
      });
      return { ok: true, id: created.id, qalan: qalanSonra >= 0 ? qalanSonra : undefined };
    } catch (e) {
      console.error("[saveLeaveRequest]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yadda saxlanmadı: ${msg}` };
    }
  });
}

const DecisionSchema = z.object({
  id: z.coerce.number().int().positive(),
  decision: z.enum(["tesdiq", "red"]),
  qeyd: z.string().max(500).optional().or(z.literal("")),
});

export async function decideLeaveRequest(input: FormData): Promise<Result> {
  const permCheck = await requireHrActionPerm("mezuniyyet.tesdiq");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = DecisionSchema.safeParse({
    id: input.get("id"),
    decision: input.get("decision"),
    qeyd: input.get("qeyd"),
  });
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      // YENI: özünün yaratdığı sorğunu özü təsdiq edə bilməz
      const before = await prisma.isci_mezuniyyet.findUnique({
        where: { id: parsed.data.id },
        select: { istifadeci_id: true, status: true, gun_sayi: true, nov: true, yaradan_id: true },
      });
      if (!before) return { ok: false, error: "Sorğu tapılmadı" };
      if (before.istifadeci_id === istifadeciId) {
        return { ok: false, error: "Öz məzuniyyət sorğunuzu təsdiq/rədd edə bilməzsiniz" };
      }
      if (before.status !== "gozleyir") {
        return { ok: false, error: "Bu sorğu artıq qərar verilib" };
      }
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
      bustHrCache();
      await audit(parsed.data.decision === "tesdiq" ? "tesdiq" : "redd", "isci_mezuniyyet", parsed.data.id, {
        evvelki_data: { status: before.status },
        yeni_data: { status: parsed.data.decision, istifadeci_id: before.istifadeci_id, gun_sayi: Number(before.gun_sayi ?? 0) },
        sebeb: parsed.data.qeyd || (parsed.data.decision === "tesdiq" ? "Məzuniyyət təsdiq edildi" : "Məzuniyyət rədd edildi"),
      });
      return { ok: true };
    } catch (e) {
      console.error("[decideLeaveRequest]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}
