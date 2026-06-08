"use server";

import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Məhsul yaratma forması üçün canlı dublikat yoxlaması.
 * İstifadəçi ad/barkod/kod yazdıqca arxa fonda çağırılır.
 */

export type DuplicateMatch = {
  id: string;
  ad: string;
  kod: string | null;
  barkod: string | null;
  marka_ad: string | null;
  sekil_url: string | null;
  match_type: "ad" | "barkod" | "kod" | "ad_marka";
};

export async function checkProductDuplicates(input: {
  ad?: string;
  barkod?: string;
  kod?: string;
  marka_id?: number;
  excludeId?: string;
}): Promise<{ ok: true; matches: DuplicateMatch[] } | { ok: false; error: string }> {
  const ad = input.ad?.trim().toLowerCase();
  const barkod = input.barkod?.trim();
  const kod = input.kod?.trim();
  if (!ad && !barkod && !kod) return { ok: true, matches: [] };
  if (ad && ad.length < 3 && !barkod && !kod) return { ok: true, matches: [] };

  return withTenant(async () => {
    try {
      const { sahibkarId } = requireTenant();
      const matches: DuplicateMatch[] = [];

      // Eyni barkod
      if (barkod) {
        const rows = await prisma.mehsullar.findMany({
          where: {
            sahibkar_id: sahibkarId,
            deleted_at: null,
            barkod,
            ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
          },
          select: {
            id: true, ad: true, kod: true, barkod: true, sekil_url: true,
            markalar: { select: { ad: true } },
          },
          take: 5,
        });
        for (const r of rows) {
          matches.push({
            id: r.id, ad: r.ad, kod: r.kod, barkod: r.barkod,
            marka_ad: r.markalar?.ad ?? null, sekil_url: r.sekil_url,
            match_type: "barkod",
          });
        }
      }

      // Eyni kod
      if (kod && matches.length < 5) {
        const rows = await prisma.mehsullar.findMany({
          where: {
            sahibkar_id: sahibkarId,
            deleted_at: null,
            kod,
            ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
            ...(matches.length > 0 ? { id: { notIn: matches.map((m) => m.id) } } : {}),
          },
          select: {
            id: true, ad: true, kod: true, barkod: true, sekil_url: true,
            markalar: { select: { ad: true } },
          },
          take: 5 - matches.length,
        });
        for (const r of rows) {
          matches.push({
            id: r.id, ad: r.ad, kod: r.kod, barkod: r.barkod,
            marka_ad: r.markalar?.ad ?? null, sekil_url: r.sekil_url,
            match_type: "kod",
          });
        }
      }

      // Oxşar ad (case-insensitive contains)
      if (ad && ad.length >= 3 && matches.length < 5) {
        const rows = await prisma.mehsullar.findMany({
          where: {
            sahibkar_id: sahibkarId,
            deleted_at: null,
            ad: { contains: ad, mode: "insensitive" },
            ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
            ...(matches.length > 0 ? { id: { notIn: matches.map((m) => m.id) } } : {}),
          },
          select: {
            id: true, ad: true, kod: true, barkod: true, sekil_url: true, marka_id: true,
            markalar: { select: { ad: true } },
          },
          take: 5 - matches.length,
        });
        for (const r of rows) {
          matches.push({
            id: r.id, ad: r.ad, kod: r.kod, barkod: r.barkod,
            marka_ad: r.markalar?.ad ?? null, sekil_url: r.sekil_url,
            match_type: input.marka_id && r.marka_id === input.marka_id ? "ad_marka" : "ad",
          });
        }
      }

      return { ok: true, matches };
    } catch (e) {
      console.error("[checkProductDuplicates]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Yoxlama alınmadı" };
    }
  });
}
