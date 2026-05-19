"use server";

import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { searchProductIdsSpaceInsensitive } from "@/lib/db/space-insensitive-search";

/** Hit grouping used by the command palette to render section headings. */
export type GlobalSearchType =
  | "mehsul"
  | "kontragent"
  | "satis"
  | "alis"
  | "anbar"
  | "marka"
  | "kateqoriya"
  | "istifadeci"
  | "tapshiriq"
  | "audit";

export type GlobalSearchHit = {
  type: GlobalSearchType;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  /** Optional small badge (e.g. status / borc / sayı). */
  badge?: string;
};

export type GlobalSearchResult = {
  query: string;
  groups: Record<GlobalSearchType, GlobalSearchHit[]>;
  /** Total non-module hits — useful for "Nəticə yoxdur" detection on the client. */
  total: number;
};

/** Tiny helper: run a query and swallow any error (e.g. missing model) so the
 *  palette continues to work even when one source is unavailable. */
async function safe<T>(fn: () => Promise<T[]>, fallback: T[] = []): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/**
 * Server-side global search. Runs each source in parallel and groups results
 * by `type`. All queries are wrapped in `withTenant()` so they respect the
 * caller's `sahibkar_id` automatically via the Prisma extension.
 */
export async function globalSearch(
  query: string,
  opts: { limit?: number; types?: GlobalSearchType[] } = {},
): Promise<GlobalSearchResult> {
  const q = (query ?? "").trim();
  const empty: GlobalSearchResult = {
    query: q,
    total: 0,
    groups: {
      mehsul: [],
      kontragent: [],
      satis: [],
      alis: [],
      anbar: [],
      marka: [],
      kateqoriya: [],
      istifadeci: [],
      tapshiriq: [],
      audit: [],
    },
  };
  if (q.length < 2) return empty;

  const include = (t: GlobalSearchType) => !opts.types || opts.types.includes(t);

  return withTenant(async () => {
    const [
      mehsullar,
      kontragentler,
      satislar,
      alislar,
      anbarlar,
      markalar,
      kateqoriyalar,
      istifadeciler,
      tapshiriqlar,
      audit,
    ] = await Promise.all([
      include("mehsul")
        ? safe(async () => {
            // Space-insensitive axtarış — "buds3" ↔ "buds 3" hər iki istiqamətdə tapır
            const matchedIds = await searchProductIdsSpaceInsensitive(q, { limit: 8 });
            if (matchedIds.length === 0) return [];
            return prisma.mehsullar.findMany({
              where: { id: { in: matchedIds } },
              orderBy: { ad: "asc" },
              select: { id: true, ad: true, kod: true, barkod: true, marka: true },
            });
          })
        : Promise.resolve([]),
      include("kontragent")
        ? safe(() =>
            prisma.kontragentler.findMany({
              where: {
                aktiv: true,
                OR: [
                  { ad: { contains: q, mode: "insensitive" } },
                  { telefon: { contains: q } },
                  { voen: { contains: q } },
                  { fin_kod: { contains: q } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              },
              orderBy: { ad: "asc" },
              take: 8,
              select: {
                id: true,
                ad: true,
                telefon: true,
                voen: true,
                nov: true,
              },
            }),
          )
        : Promise.resolve([]),
      include("satis")
        ? safe(() =>
            prisma.satis_sifarisleri.findMany({
              where: { nomre: { contains: q, mode: "insensitive" } },
              orderBy: { yaradildi: "desc" },
              take: 5,
              select: {
                id: true,
                nomre: true,
                son_mebleg: true,
                status: true,
              },
            }),
          )
        : Promise.resolve([]),
      include("alis")
        ? safe(() =>
            prisma.alis_sifarisleri.findMany({
              where: { nomre: { contains: q, mode: "insensitive" } },
              orderBy: { yaradildi: "desc" },
              take: 5,
              select: {
                id: true,
                nomre: true,
                umumi_mebleg: true,
                status: true,
              },
            }),
          )
        : Promise.resolve([]),
      include("anbar")
        ? safe(() =>
            prisma.anbarlar.findMany({
              where: {
                aktiv: true,
                ad: { contains: q, mode: "insensitive" },
              },
              orderBy: { ad: "asc" },
              take: 5,
              select: { id: true, ad: true, unvan: true },
            }),
          )
        : Promise.resolve([]),
      include("marka")
        ? safe(() =>
            prisma.markalar.findMany({
              where: {
                aktiv: true,
                ad: { contains: q, mode: "insensitive" },
              },
              orderBy: { ad: "asc" },
              take: 5,
              select: { id: true, ad: true },
            }),
          )
        : Promise.resolve([]),
      include("kateqoriya")
        ? safe(() =>
            prisma.kateqoriyalar.findMany({
              where: { ad: { contains: q, mode: "insensitive" } },
              orderBy: { ad: "asc" },
              take: 5,
              select: { id: true, ad: true },
            }),
          )
        : Promise.resolve([]),
      include("istifadeci")
        ? safe(() =>
            prisma.istifadeciler.findMany({
              where: {
                aktiv: true,
                OR: [
                  { ad_soyad: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  { telefon: { contains: q } },
                ],
              },
              orderBy: { ad_soyad: "asc" },
              take: 5,
              select: {
                id: true,
                ad_soyad: true,
                email: true,
                vezife: true,
              },
            }),
          )
        : Promise.resolve([]),
      include("tapshiriq")
        ? safe(() =>
            prisma.tapshiriqlar.findMany({
              where: {
                OR: [
                  { basliq: { contains: q, mode: "insensitive" } },
                  { tesvir: { contains: q, mode: "insensitive" } },
                ],
              },
              orderBy: { yaradildi: "desc" },
              take: 5,
              select: {
                id: true,
                basliq: true,
                status: true,
                prioritet: true,
              },
            }),
          )
        : Promise.resolve([]),
      include("audit")
        ? safe(() =>
            prisma.audit_log.findMany({
              where: {
                OR: [
                  { emeliyyat: { contains: q, mode: "insensitive" } },
                  { resurs_nov: { contains: q, mode: "insensitive" } },
                  { sebeb: { contains: q, mode: "insensitive" } },
                ],
              },
              orderBy: { yaradildi: "desc" },
              take: 3,
              select: {
                id: true,
                emeliyyat: true,
                resurs_nov: true,
                istifadeci_ad: true,
                yaradildi: true,
              },
            }),
          )
        : Promise.resolve([]),
    ]);

    const groups: GlobalSearchResult["groups"] = {
      mehsul: mehsullar.map((m) => ({
        type: "mehsul",
        id: m.id,
        title: m.ad,
        subtitle: [m.kod, m.barkod, m.marka].filter(Boolean).join(" · "),
        href: `/anbar/mehsullar?q=${encodeURIComponent(m.ad)}`,
      })),
      kontragent: kontragentler.map((k) => {
        // Pick a sensible deep link by `nov`.
        let href = `/elaqe/musteriler/${k.id}`;
        if (k.nov === "techizatci") href = `/elaqe/techizatcilar`;
        return {
          type: "kontragent" as const,
          id: k.id,
          title: k.ad,
          subtitle: [k.telefon, k.voen].filter(Boolean).join(" · ") || undefined,
          href,
          badge: k.nov === "techizatci" ? "Təchizatçı" : "Müştəri",
        };
      }),
      satis: satislar.map((s) => ({
        type: "satis",
        id: s.id,
        title: `Satış ${s.nomre}`,
        subtitle: s.status ?? undefined,
        href: `/ticaret/satislar/${s.id}`,
        badge: s.son_mebleg != null ? `${Number(s.son_mebleg).toFixed(2)} ₼` : undefined,
      })),
      alis: alislar.map((a) => ({
        type: "alis",
        id: a.id,
        title: `Alış ${a.nomre}`,
        subtitle: a.status ?? undefined,
        href: `/ticaret/alislar/${a.id}`,
        badge:
          a.umumi_mebleg != null
            ? `${Number(a.umumi_mebleg).toFixed(2)} ₼`
            : undefined,
      })),
      anbar: anbarlar.map((a) => ({
        type: "anbar",
        id: String(a.id),
        title: a.ad,
        subtitle: a.unvan ?? undefined,
        href: `/anbar?anbar=${a.id}`,
      })),
      marka: markalar.map((m) => ({
        type: "marka",
        id: String(m.id),
        title: m.ad,
        href: `/anbar/markalar?id=${m.id}`,
      })),
      kateqoriya: kateqoriyalar.map((c) => ({
        type: "kateqoriya",
        id: String(c.id),
        title: c.ad,
        href: `/anbar/mehsullar?kateq=${c.id}`,
      })),
      istifadeci: istifadeciler.map((u) => ({
        type: "istifadeci",
        id: u.id,
        title: u.ad_soyad,
        subtitle: [u.vezife, u.email].filter(Boolean).join(" · ") || undefined,
        href: `/iscilier/${u.id}`,
      })),
      tapshiriq: tapshiriqlar.map((t) => ({
        type: "tapshiriq",
        id: t.id,
        title: t.basliq,
        subtitle: t.status ?? undefined,
        href: `/tapshiriqlar/${t.id}`,
        badge: t.prioritet ?? undefined,
      })),
      audit: audit.map((a) => ({
        type: "audit",
        id: String(a.id),
        title: `${a.emeliyyat} · ${a.resurs_nov}`,
        subtitle: [a.istifadeci_ad, a.yaradildi?.toISOString().slice(0, 10)]
          .filter(Boolean)
          .join(" · "),
        href: `/audit-log`,
      })),
    };

    const total = Object.values(groups).reduce((s, arr) => s + arr.length, 0);
    return { query: q, groups, total };
  });
}
