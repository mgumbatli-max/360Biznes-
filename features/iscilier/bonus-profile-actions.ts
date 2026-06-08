"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import type { BonusProfil } from "./bonus-profile";

export type ExcludedKontragent = { id: string; ad: string; nov: string };

/**
 * Bonus blacklist üçün müştəri axtarışı (kompakt nəticə).
 * — Aktiv kontragentlər, sahibkar tenant filtrlənib
 * — Ad / telefon / voen üzrə case-insensitive prefix axtarış
 * — Maks 20 nəticə
 */
export async function searchKontragentForBonusBlacklist(
  query: string,
): Promise<ExcludedKontragent[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.kontragentler.findMany({
      where: {
        sahibkar_id: sahibkarId,
        aktiv: true,
        OR: [
          { ad: { contains: q, mode: "insensitive" } },
          { telefon: { contains: q } },
          { voen: { contains: q } },
        ],
      },
      select: { id: true, ad: true, nov: true },
      take: 20,
      orderBy: { ad: "asc" },
    });
    return rows.map((r) => ({ id: r.id, ad: r.ad, nov: r.nov }));
  });
}

/**
 * Default kontragent siyahısı — axtarışsız dialog açılanda son aktiv 20 müştəri.
 */
export async function getTopKontragents(novFilter: "musteri" | "techizatci" | "any" = "musteri"): Promise<ExcludedKontragent[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const where: Record<string, unknown> = { sahibkar_id: sahibkarId, aktiv: true };
    if (novFilter === "musteri") {
      where.OR = [{ nov: "musteri" }, { nov: "her_ikisi" }];
    } else if (novFilter === "techizatci") {
      where.OR = [{ nov: "techizatci" }, { nov: "her_ikisi" }];
    }
    const rows = await prisma.kontragentler.findMany({
      where,
      select: { id: true, ad: true, nov: true },
      take: 30,
      orderBy: [{ yenilendi: "desc" }, { ad: "asc" }],
    });
    return rows.map((r) => ({ id: r.id, ad: r.ad, nov: r.nov }));
  });
}

/**
 * Verilmiş id-lərə görə kontragentləri qaytarır — UI-də saxlanmış blacklist-i
 * chip-lər kimi göstərmək üçün.
 */
export async function getKontragentNamesByIds(ids: string[]): Promise<ExcludedKontragent[]> {
  if (ids.length === 0) return [];
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.kontragentler.findMany({
      where: { sahibkar_id: sahibkarId, id: { in: ids.slice(0, 500) } },
      select: { id: true, ad: true, nov: true },
    });
    return rows.map((r) => ({ id: r.id, ad: r.ad, nov: r.nov }));
  });
}

const PaylanmaSchema = z.object({
  kateqoriya: z.enum(["davamiyyet", "tapsiriq", "sehv_yoxlugu", "borc_yigim", "satis_hedef"]),
  tip: z.enum(["mebleg", "faiz"]),
  deyer: z.coerce.number().min(0).max(1_000_000),
  hedef: z.coerce.number().min(0).max(1_000_000),
});

const ProfilSchema = z.object({
  istifadeciId: z.string().uuid(),
  metod: z.enum(["fixed", "percent_satis", "percent_menfaat"]),
  fixed_mebleg: z.coerce.number().min(0).max(1_000_000),
  percent: z.coerce.number().min(0).max(100),
  paylanma: z.array(PaylanmaSchema),
  musteri_filter: z.enum(["hamisi", "mene_aid", "getirdi", "mene_aid_ve_getirdi"]).default("hamisi"),
  excluded_kontragent_ids: z.array(z.string().uuid()).max(500).default([]),
});

type Result = { ok: true } | { ok: false; error: string };

export async function saveBonusProfil(input: z.input<typeof ProfilSchema>): Promise<Result> {
  const parsed = ProfilSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const data = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, rolAd, icazeler } = requireTenant();
    // İcazə yoxlanışı — yalnız sahibkar/admin/direktor və ya `hr.bonus_idare`
    const r = (rolAd ?? "").toLowerCase();
    const allowed =
      r.includes("sahibkar") ||
      r.includes("owner") ||
      r.includes("admin") ||
      r.includes("direktor") ||
      (icazeler ?? []).includes("hr.bonus_idare");
    if (!allowed) {
      return { ok: false, error: "Bonus qaydalarını dəyişdirmək icazəniz yoxdur (hr.bonus_idare lazımdır)" };
    }
    try {
      const profil: BonusProfil = {
        metod: data.metod,
        fixed_mebleg: data.fixed_mebleg,
        percent: data.percent,
        paylanma: data.paylanma,
        musteri_filter: data.musteri_filter,
        excluded_kontragent_ids: Array.from(new Set(data.excluded_kontragent_ids)),
      };
      await prisma.ayarlar.upsert({
        where: {
          sahibkar_id_qrup_acar: {
            sahibkar_id: sahibkarId,
            qrup: "bonus_profil",
            acar: data.istifadeciId,
          },
        },
        create: {
          sahibkar_id: sahibkarId,
          qrup: "bonus_profil",
          acar: data.istifadeciId,
          deyer: JSON.stringify(profil),
          nov: "string",
        },
        update: {
          deyer: JSON.stringify(profil),
          yenilendi: new Date(),
        },
      });
      revalidatePath(`/iscilier/${data.istifadeciId}`);
      try {
        const { revalidateTag } = await import("next/cache");
        revalidateTag(`iscilier:${sahibkarId}`, "max");
        revalidateTag(`dashboard:${sahibkarId}`, "max");
      } catch { /* non-fatal */ }
      const { audit } = await import("@/lib/audit/log");
      await audit("yenile", "bonus_profil", data.istifadeciId, {
        yeni_data: { metod: data.metod, paylanma: data.paylanma, excluded: data.excluded_kontragent_ids.length },
        sebeb: "Bonus profili yeniləndi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[saveBonusProfil]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yadda saxlanmadı: ${msg}` };
    }
  });
}
