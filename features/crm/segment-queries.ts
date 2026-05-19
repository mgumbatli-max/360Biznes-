import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export type SegmentItem = {
  kod: string;
  ad: string;
  tesvir: string;
  reng: string;
  count: number;
};

export type SegmentCustomer = {
  id: string;
  ad: string;
  telefon: string | null;
  email: string | null;
  borc: number;
  son_alish: Date | null;
};

export async function getBuiltInSegments(): Promise<SegmentItem[]> {
  return withTenant(async () => {
    const days30Ago = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const days90Ago = new Date(Date.now() - 90 * 24 * 3600 * 1000);

    const [yeni, borclu, cixanCount, yuksekCek] = await Promise.all([
      prisma.kontragentler.count({ where: { nov: "musteri", yaradildi: { gte: days30Ago } } }),
      prisma.kontragentler.count({ where: { nov: "musteri", borc: { gt: 0 } } }),
      prisma.kontragentler.count({
        where: {
          nov: "musteri",
          OR: [
            { son_temas: { lt: days90Ago } },
            { son_temas: null, yaradildi: { lt: days90Ago } },
          ],
        },
      }),
      prisma.kontragentler.count({ where: { nov: "musteri", qiymet_tipi: { in: ["topdan", "vip"] } } }),
    ]);

    // Calculate VIP - top 10% by historical sales (estimated via funnel_status muntezem)
    const vipCount = await prisma.kontragentler.count({
      where: { nov: "musteri", OR: [{ qiymet_tipi: "vip" }, { funnel_status: "muntezem" }] },
    });

    return [
      { kod: "vip", ad: "VIP müştərilər", tesvir: "VIP qiymət tipi və ya müntəzəm alıcılar", reng: "#a78bfa", count: vipCount },
      { kod: "yeni_musteri", ad: "Yeni müştəri", tesvir: "Son 30 gündə əlavə olunmuş müştərilər", reng: "#22d3ee", count: yeni },
      { kod: "cixan", ad: "Çıxan müştəri", tesvir: "90+ gündür təması olmayan", reng: "#f87171", count: cixanCount },
      { kod: "borclu", ad: "Borclu müştəri", tesvir: "Açıq borcu olan müştərilər", reng: "#f59e0b", count: borclu },
      { kod: "yuksek_cek", ad: "Yüksək çek", tesvir: "Topdan və VIP qiymət tipləri", reng: "#34d399", count: yuksekCek },
    ];
  });
}

export async function getSegmentCustomers(kod: string): Promise<SegmentCustomer[]> {
  return withTenant(async () => {
    const days30Ago = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const days90Ago = new Date(Date.now() - 90 * 24 * 3600 * 1000);

    let where: Record<string, unknown> = { nov: "musteri" };
    switch (kod) {
      case "vip":
        where = { nov: "musteri", OR: [{ qiymet_tipi: "vip" }, { funnel_status: "muntezem" }] };
        break;
      case "yeni_musteri":
        where = { nov: "musteri", yaradildi: { gte: days30Ago } };
        break;
      case "cixan":
        where = {
          nov: "musteri",
          OR: [
            { son_temas: { lt: days90Ago } },
            { AND: [{ son_temas: null }, { yaradildi: { lt: days90Ago } }] },
          ],
        };
        break;
      case "borclu":
        where = { nov: "musteri", borc: { gt: 0 } };
        break;
      case "yuksek_cek":
        where = { nov: "musteri", qiymet_tipi: { in: ["topdan", "vip"] } };
        break;
      default:
        // custom — return empty for now
        return [];
    }

    const rows = await prisma.kontragentler.findMany({
      where,
      orderBy: { yaradildi: "desc" },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      telefon: r.telefon,
      email: r.email,
      borc: Number(r.borc ?? 0),
      son_alish: r.son_temas,
    }));
  });
}

export async function getCustomSegments() {
  return withTenant(async () => {
    const rows = await prisma.musteri_seqment.findMany({ orderBy: { ad: "asc" } });
    return rows.map((r) => ({
      id: r.id,
      kod: r.kod,
      ad: r.ad,
      tesvir: r.tesvir,
      reng: r.reng ?? "#3b82f6",
      sistem: r.sistem ?? false,
    }));
  });
}
