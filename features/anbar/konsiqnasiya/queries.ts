import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { searchProductIdsSpaceInsensitive } from "@/lib/db/space-insensitive-search";

export type KonsRow = {
  id: number;
  verilme_tarixi: Date;
  qaytarilma_tarixi: Date | null;
  yaradildi: Date | null;
  istiqamet: "verilen" | "alinan";
  kontragent_ad: string;
  mehsul_id: string;
  mehsul_ad: string;
  mehsul_kod: string | null;
  sekil_url: string | null;
  sayi: number;
  satilan_say: number;
  qaliq_say: number;
  qiymet: number | null;
  status: string;
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

export type KonsFilter = {
  q?: string;
  istiqamet?: string;
  kontragentId?: string;
  status?: string;
};

export async function getKonsList(filter: KonsFilter = {}): Promise<KonsRow[]> {
  return withTenant(async () => {
    const where: Record<string, unknown> = {};
    if (filter.istiqamet) where.istiqamet = filter.istiqamet;
    if (filter.kontragentId) where.kontragent_id = filter.kontragentId;
    if (filter.status) where.hesablashma_status = filter.status;
    if (filter.q && filter.q.trim()) {
      const q = filter.q.trim();
      // Boşluqdan asılı olmayan məhsul axtarışı: "buds3" ↔ "buds 3".
      const matchedIds = await searchProductIdsSpaceInsensitive(q, { limit: 500, activeOnly: false });
      where.OR = [
        ...(matchedIds.length > 0 ? [{ mehsul_id: { in: matchedIds } }] : []),
        { kontragentler: { is: { ad: { contains: q, mode: "insensitive" } } } },
      ];
    }
    const rows = await prisma.konsiqnasiya.findMany({
      where,
      orderBy: { yaradildi: "desc" },
      take: 300,
      include: {
        kontragentler: { select: { ad: true } },
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
      },
    });
    return rows.map((r) => ({
      id: r.id,
      verilme_tarixi: r.verilme_tarixi,
      qaytarilma_tarixi: r.qaytarilma_tarixi,
      yaradildi: r.yaradildi ?? null,
      istiqamet: (r.istiqamet ?? "verilen") as "verilen" | "alinan",
      kontragent_ad: r.kontragentler?.ad ?? "—",
      mehsul_id: r.mehsul_id,
      mehsul_ad: r.mehsullar?.ad ?? "—",
      mehsul_kod: r.mehsullar?.kod ?? null,
      sekil_url: r.mehsullar?.sekil_url ?? null,
      sayi: Number(r.sayi),
      satilan_say: Number(r.satilan_say ?? 0),
      qaliq_say: Number(r.qaliq_say ?? r.sayi),
      qiymet: r.qiymet ? Number(r.qiymet) : null,
      status: r.hesablashma_status ?? "aciq",
      qeyd: r.qeyd,
      mehsul_sekil_url: r.mehsullar?.sekil_url ?? null,
      mehsul_barkod: r.mehsullar?.barkod ?? null,
      kateqoriya_ad: r.mehsullar?.kateqoriyalar?.ad ?? null,
      kateqoriya_ust_ad: r.mehsullar?.kateqoriyalar?.kateqoriyalar?.ad ?? null,
      marka_ad: r.mehsullar?.markalar?.ad ?? null,
      model: r.mehsullar?.model ?? null,
      rang: r.mehsullar?.rang ?? null,
      istehsalci: r.mehsullar?.istehsalci ?? null,
      olcu_ad: r.mehsullar?.olcu_vahidleri?.qisa_ad ?? r.mehsullar?.olcu_vahidleri?.ad ?? null,
      valyuta: r.mehsullar?.valyuta ?? "AZN",
      edv_status: r.mehsullar?.edv_status ?? null,
      zemanet_ay: Number(r.mehsullar?.zemanet_ay ?? 0),
      mehsul_aciqlamaq: r.mehsullar?.aciqlamaq ?? null,
      mehsul_qisaca_tesvir: r.mehsullar?.qisaca_tesvir ?? null,
      mehsul_servis_sayi: r.mehsullar?._count?.servis_qeydleri ?? 0,
      mehsul_aktiv: r.mehsullar?.aktiv ?? false,
      mehsul_satis_qiymeti: Number(r.mehsullar?.satis_qiymeti ?? 0),
    }));
  });
}

export async function getKonsOptions() {
  return withTenant(async () => {
    const [kontragents, products] = await Promise.all([
      prisma.kontragentler.findMany({
        select: { id: true, ad: true, nov: true },
        orderBy: { ad: "asc" },
        take: 500,
      }),
      prisma.mehsullar.findMany({
        where: { aktiv: true },
        select: { id: true, ad: true },
        orderBy: { ad: "asc" },
        take: 500,
      }),
    ]);
    return { kontragents, products };
  });
}
