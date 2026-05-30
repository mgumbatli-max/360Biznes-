import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { LabelPrintClient } from "./client";

export const metadata: Metadata = { title: "Etiket çapı" };

type SearchParams = { ids?: string };

export type LabelProduct = {
  id: string;
  ad: string;
  kod: string | null;
  barkod: string | null;
  satis_qiymeti: number;
  endirimli_qiymet: number | null;
  valyuta: string;
  marka_ad: string | null;
  kateqoriya_ad: string | null;
  vahid: string | null;
};

async function loadProducts(ids: string[]): Promise<LabelProduct[]> {
  if (ids.length === 0) return [];
  return withTenant(async () => {
    const rows = await prisma.mehsullar.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        ad: true,
        kod: true,
        barkod: true,
        satis_qiymeti: true,
        endirimli_qiymet: true,
        valyuta: true,
        markalar: { select: { ad: true } },
        kateqoriyalar: { select: { ad: true } },
        olcu_vahidleri: { select: { qisa_ad: true, ad: true } },
      },
      orderBy: { ad: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      kod: r.kod,
      barkod: r.barkod,
      satis_qiymeti: Number(r.satis_qiymeti ?? 0),
      endirimli_qiymet: r.endirimli_qiymet ? Number(r.endirimli_qiymet) : null,
      valyuta: r.valyuta ?? "AZN",
      marka_ad: r.markalar?.ad ?? null,
      kateqoriya_ad: r.kateqoriyalar?.ad ?? null,
      vahid: r.olcu_vahidleri?.qisa_ad ?? r.olcu_vahidleri?.ad ?? null,
    }));
  });
}

async function loadCatalog(): Promise<LabelProduct[]> {
  return withTenant(async () => {
    const rows = await prisma.mehsullar.findMany({
      where: { aktiv: true },
      take: 500,
      orderBy: { ad: "asc" },
      select: {
        id: true,
        ad: true,
        kod: true,
        barkod: true,
        satis_qiymeti: true,
        endirimli_qiymet: true,
        valyuta: true,
        markalar: { select: { ad: true } },
        kateqoriyalar: { select: { ad: true } },
        olcu_vahidleri: { select: { qisa_ad: true, ad: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      kod: r.kod,
      barkod: r.barkod,
      satis_qiymeti: Number(r.satis_qiymeti ?? 0),
      endirimli_qiymet: r.endirimli_qiymet ? Number(r.endirimli_qiymet) : null,
      valyuta: r.valyuta ?? "AZN",
      marka_ad: r.markalar?.ad ?? null,
      kateqoriya_ad: r.kateqoriyalar?.ad ?? null,
      vahid: r.olcu_vahidleri?.qisa_ad ?? r.olcu_vahidleri?.ad ?? null,
    }));
  });
}

export default async function EtiketCapPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const ids = sp.ids ? sp.ids.split(",").filter(Boolean) : [];
  const [preselected, catalog] = await Promise.all([loadProducts(ids), loadCatalog()]);

  return <LabelPrintClient preselected={preselected} catalog={catalog} />;
}
