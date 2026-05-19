import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { searchProductIdsSpaceInsensitive } from "@/lib/db/space-insensitive-search";

export type ProductRow = {
  id: string;
  ad: string;
  kod: string | null;
  barkod: string | null;
  satis_qiymeti: number;
  alish_qiymeti: number;
  min_satis_qiymeti: number;
  topdan_qiymeti: number;
  partnyor_qiymeti: number;
  vip_qiymeti: number;
  stok_miqdari: number;
};

export type CustomerRow = {
  id: string;
  ad: string;
  telefon: string | null;
  email: string | null;
  borc: number;
};

function mapProduct(m: {
  id: string;
  ad: string;
  kod: string | null;
  barkod: string | null;
  satis_qiymeti: { toString(): string } | null;
  alish_qiymeti: { toString(): string } | null;
  min_satis_qiymeti: { toString(): string } | null;
  topdan_qiymeti: { toString(): string } | null;
  partnyor_qiymeti: { toString(): string } | null;
  vip_qiymeti: { toString(): string } | null;
  stok: { miqdar: { toString(): string } | null; anbar_id: number | null }[];
}, anbarId?: number): ProductRow {
  const filtered = anbarId ? m.stok.filter((s) => s.anbar_id === anbarId) : m.stok;
  const stok_miqdari = filtered.reduce((s, r) => s + Number(r.miqdar ?? 0), 0);
  return {
    id: m.id,
    ad: m.ad,
    kod: m.kod,
    barkod: m.barkod,
    satis_qiymeti: Number(m.satis_qiymeti ?? 0),
    alish_qiymeti: Number(m.alish_qiymeti ?? 0),
    min_satis_qiymeti: Number(m.min_satis_qiymeti ?? 0),
    topdan_qiymeti: Number(m.topdan_qiymeti ?? 0),
    partnyor_qiymeti: Number(m.partnyor_qiymeti ?? 0),
    vip_qiymeti: Number(m.vip_qiymeti ?? 0),
    stok_miqdari,
  };
}

export async function searchProducts(q: string, anbarId?: number, limit = 12): Promise<ProductRow[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];
  return withTenant(async () => {
    // Boşluqdan asılı olmayan axtarış: "buds3" ↔ "buds 3" hər iki halı tapır.
    const matchedIds = await searchProductIdsSpaceInsensitive(trimmed, { limit: 200, activeOnly: true });
    const rows = await prisma.mehsullar.findMany({
      where: {
        aktiv: true,
        OR: [
          ...(matchedIds.length > 0 ? [{ id: { in: matchedIds } }] : []),
          { barkod: trimmed },
          { mehsul_barkodlar: { some: { barkod: trimmed } } },
        ],
      },
      orderBy: [{ ad: "asc" }],
      take: limit,
      select: {
        id: true,
        ad: true,
        kod: true,
        barkod: true,
        satis_qiymeti: true,
        alish_qiymeti: true,
        min_satis_qiymeti: true,
        topdan_qiymeti: true,
        partnyor_qiymeti: true,
        vip_qiymeti: true,
        stok: { select: { miqdar: true, anbar_id: true } },
      },
    });
    return rows.map((r) => mapProduct(r, anbarId));
  });
}

export async function lookupByBarcode(barcode: string, anbarId?: number): Promise<ProductRow | null> {
  if (!barcode) return null;
  return withTenant(async () => {
    const row = await prisma.mehsullar.findFirst({
      where: {
        aktiv: true,
        OR: [{ barkod: barcode }, { mehsul_barkodlar: { some: { barkod: barcode } } }],
      },
      select: {
        id: true,
        ad: true,
        kod: true,
        barkod: true,
        satis_qiymeti: true,
        alish_qiymeti: true,
        min_satis_qiymeti: true,
        topdan_qiymeti: true,
        partnyor_qiymeti: true,
        vip_qiymeti: true,
        stok: { select: { miqdar: true, anbar_id: true } },
      },
    });
    return row ? mapProduct(row, anbarId) : null;
  });
}

export async function searchCustomers(q: string, limit = 10): Promise<CustomerRow[]> {
  if (!q || q.trim().length < 2) return [];
  return withTenant(async () => {
    const rows = await prisma.kontragentler.findMany({
      where: {
        aktiv: true,
        nov: { in: ["musteri", "her_ikisi"] },
        OR: [
          { ad: { contains: q, mode: "insensitive" } },
          { telefon: { contains: q } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { ad: "asc" },
      select: { id: true, ad: true, telefon: true, email: true, borc: true },
    });
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      telefon: r.telefon,
      email: r.email,
      borc: Number(r.borc ?? 0),
    }));
  });
}

export type SalespersonOption = { id: string; ad_soyad: string };

export async function getSalespersonOptions(): Promise<SalespersonOption[]> {
  return withTenant(async () => {
    const rows = await prisma.istifadeciler.findMany({
      where: { aktiv: true },
      orderBy: { ad_soyad: "asc" },
      select: { id: true, ad_soyad: true },
    });
    return rows;
  });
}

export async function getDefaultAnbar(): Promise<{ id: number; ad: string } | null> {
  return withTenant(async () => {
    const r = await prisma.anbarlar.findFirst({
      where: { aktiv: true },
      orderBy: { id: "asc" },
      select: { id: true, ad: true },
    });
    return r;
  });
}
