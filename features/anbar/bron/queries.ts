import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { searchProductIdsSpaceInsensitive } from "@/lib/db/space-insensitive-search";

export type BronRow = {
  id: number;
  baslama_tarixi: Date;
  bitme_tarixi: Date | null;
  yaradildi: Date | null;
  mehsul_id: string;
  mehsul_ad: string;
  mehsul_kod: string | null;
  barkod: string | null;
  sekil_url: string | null;
  kontragent_ad: string | null;
  musteri_ad: string | null;
  musteri_telefon: string | null;
  sayi: number;
  anbar_id: number | null;
  anbar_ad: string | null;
  status: string;
  qiymet: number | null;
  qeyd: string | null;
  // extended product fields (for toggle columns)
  mehsul_sekil_url: string | null;
  mehsul_barkod: string | null;
  kateqoriya_ad: string | null;
  kateqoriya_ust_ad: string | null;
  marka_ad: string | null;
  model: string | null;
  rang: string | null;
  istehsalci: string | null;
  olcu_ad: string | null;
  valyuta: string;
  edv_status: string | null;
  zemanet_ay: number;
  mehsul_aciqlamaq: string | null;
  mehsul_qisaca_tesvir: string | null;
  mehsul_servis_sayi: number;
  mehsul_aktiv: boolean;
  mehsul_satis_qiymeti: number;
};

export type BronStatus = "" | "aktiv" | "vaxti_bitdi" | "satish_oldu" | "legv";

export type BronFilter = {
  status?: BronStatus;
  q?: string;
  anbarId?: number;
  musteriId?: string;
  mehsulId?: string;
  from?: string;
  to?: string;
};

export async function getBronList(filter: BronFilter | BronStatus = {}): Promise<BronRow[]> {
  const f: BronFilter = typeof filter === "string" ? { status: filter } : filter;
  return withTenant(async () => {
    const where: Record<string, unknown> = {};
    if (f.status) where.status = f.status;
    if (f.anbarId) where.anbar_id = f.anbarId;
    if (f.musteriId) where.musteri_id = f.musteriId;
    if (f.mehsulId) where.mehsul_id = f.mehsulId;
    if (f.from || f.to) {
      const r: Record<string, Date> = {};
      if (f.from) r.gte = new Date(f.from);
      if (f.to) {
        const end = new Date(f.to);
        end.setHours(23, 59, 59, 999);
        r.lte = end;
      }
      where.baslama_tarixi = r;
    }
    if (f.q && f.q.trim()) {
      const q = f.q.trim();
      // Boşluqdan asılı olmayan məhsul axtarışı: "buds3" ↔ "buds 3".
      const matchedIds = await searchProductIdsSpaceInsensitive(q, { limit: 500, activeOnly: false });
      where.OR = [
        ...(matchedIds.length > 0 ? [{ mehsul_id: { in: matchedIds } }] : []),
        { kontragentler: { is: { ad: { contains: q, mode: "insensitive" } } } },
        { musteri_ad: { contains: q, mode: "insensitive" } },
        { musteri_telefon: { contains: q, mode: "insensitive" } },
      ];
    }
    const rows = await prisma.stok_bron.findMany({
      where,
      orderBy: { yaradildi: "desc" },
      take: 200,
      include: {
        mehsullar: {
          select: {
            id: true,
            ad: true,
            kod: true,
            barkod: true,
            sekil_url: true,
            aciqlamaq: true,
            qisaca_tesvir: true,
            aktiv: true,
            model: true,
            rang: true,
            istehsalci: true,
            valyuta: true,
            edv_status: true,
            zemanet_ay: true,
            satis_qiymeti: true,
            kateqoriyalar: {
              select: {
                ad: true,
                kateqoriyalar: { select: { ad: true } },
              },
            },
            markalar: { select: { ad: true } },
            olcu_vahidleri: { select: { qisa_ad: true, ad: true } },
            _count: { select: { servis_qeydleri: true } },
          },
        },
        kontragentler: { select: { ad: true } },
        anbarlar: { select: { id: true, ad: true } },
      },
    });
    return rows.map((b) => ({
      id: b.id,
      baslama_tarixi: b.baslama_tarixi,
      bitme_tarixi: b.bitme_tarixi,
      yaradildi: b.yaradildi ?? null,
      mehsul_id: b.mehsul_id,
      mehsul_ad: b.mehsullar?.ad ?? "—",
      mehsul_kod: b.mehsullar?.kod ?? null,
      barkod: b.mehsullar?.barkod ?? null,
      sekil_url: b.mehsullar?.sekil_url ?? null,
      kontragent_ad: b.kontragentler?.ad ?? null,
      musteri_ad: b.musteri_ad,
      musteri_telefon: b.musteri_telefon,
      sayi: Number(b.sayi),
      anbar_id: b.anbar_id,
      anbar_ad: b.anbarlar?.ad ?? null,
      status: b.status ?? "aktiv",
      qiymet: b.qiymet ? Number(b.qiymet) : null,
      qeyd: b.qeyd,
      mehsul_sekil_url: b.mehsullar?.sekil_url ?? null,
      mehsul_barkod: b.mehsullar?.barkod ?? null,
      kateqoriya_ad: b.mehsullar?.kateqoriyalar?.ad ?? null,
      kateqoriya_ust_ad: b.mehsullar?.kateqoriyalar?.kateqoriyalar?.ad ?? null,
      marka_ad: b.mehsullar?.markalar?.ad ?? null,
      model: b.mehsullar?.model ?? null,
      rang: b.mehsullar?.rang ?? null,
      istehsalci: b.mehsullar?.istehsalci ?? null,
      olcu_ad: b.mehsullar?.olcu_vahidleri?.qisa_ad ?? b.mehsullar?.olcu_vahidleri?.ad ?? null,
      valyuta: b.mehsullar?.valyuta ?? "AZN",
      edv_status: b.mehsullar?.edv_status ?? null,
      zemanet_ay: Number(b.mehsullar?.zemanet_ay ?? 0),
      mehsul_aciqlamaq: b.mehsullar?.aciqlamaq ?? null,
      mehsul_qisaca_tesvir: b.mehsullar?.qisaca_tesvir ?? null,
      mehsul_servis_sayi: b.mehsullar?._count?.servis_qeydleri ?? 0,
      mehsul_aktiv: b.mehsullar?.aktiv ?? false,
      mehsul_satis_qiymeti: Number(b.mehsullar?.satis_qiymeti ?? 0),
    }));
  });
}

/**
 * Bitmə tarixi keçmiş aktiv bronları "vaxti_bitdi" statusuna keçirir.
 * Idempotent — uyğun olmayan sətirə toxunmur. Səhifə yüklənəndə çağırılır,
 * cron-a ehtiyac yoxdur.
 */
export async function expireOverdueBrons(): Promise<number> {
  return withTenant(async () => {
    const r = await prisma.stok_bron.updateMany({
      where: {
        status: "aktiv",
        bitme_tarixi: { lt: new Date() },
      },
      data: { status: "vaxti_bitdi" },
    });
    return r.count;
  });
}

export async function getBronStats() {
  return withTenant(async () => {
    // Auto-expire çağırılışdan əvvəl
    await expireOverdueBrons();
    const grouped = await prisma.stok_bron.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const map: Record<string, number> = {};
    let total = 0;
    for (const g of grouped) {
      map[g.status ?? "aktiv"] = g._count._all;
      total += g._count._all;
    }
    return { total, ...map };
  });
}

export async function getBronOptions() {
  return withTenant(async () => {
    const [products, customers, warehouses] = await Promise.all([
      prisma.mehsullar.findMany({
        where: { aktiv: true },
        select: { id: true, ad: true, barkod: true },
        orderBy: { ad: "asc" },
        take: 500,
      }),
      prisma.kontragentler.findMany({
        where: { nov: "musteri" },
        select: { id: true, ad: true, telefon: true },
        orderBy: { ad: "asc" },
        take: 300,
      }),
      prisma.anbarlar.findMany({
        where: { aktiv: true },
        select: { id: true, ad: true },
        orderBy: { ad: "asc" },
      }),
    ]);
    return { products, customers, warehouses };
  });
}
