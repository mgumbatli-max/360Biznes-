import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type ActivityKind =
  | "satis"
  | "alis"
  | "odenis_daxil"
  | "odenis_xaric"
  | "musteri_yeni"
  | "tapshiriq_tamamlandi"
  | "qaytarma";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle: string | null;
  amount: number | null;
  user: string | null;
  at: string; // ISO
  href: string | null;
};

/**
 * Son fəaliyyət axını — dashboard widget üçün.
 * Birdən çox cədvəldən paralel oxuyub xronoloji sıraya düzür.
 */
export async function getDashboardActivityFeed(limit = 20): Promise<ActivityItem[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const half = Math.ceil(limit * 0.6);

    const [satislar, alislar, odenisDaxil, odenisXaric, yeniMusteriler, tamTapsiriq] =
      await Promise.all([
        prisma.satis_sifarisleri.findMany({
          where: { sahibkar_id: sahibkarId, status: { notIn: ["legv", "qaralama"] } },
          orderBy: { yaradildi: "desc" },
          take: half,
          select: {
            id: true,
            tarix: true,
            yaradildi: true,
            son_mebleg: true,
            kontragentler: { select: { ad: true } },
            istifadeciler_satis_sifarisleri_yaradan_idToistifadeciler: {
              select: { ad_soyad: true },
            },
          },
        }),
        prisma.alis_sifarisleri.findMany({
          where: { sahibkar_id: sahibkarId, status: { notIn: ["legv", "qaralama"] } },
          orderBy: { yaradildi: "desc" },
          take: half,
          select: {
            id: true,
            tarix: true,
            yaradildi: true,
            umumi_mebleg: true,
            kontragentler: { select: { ad: true } },
          },
        }),
        prisma.finance_operations.findMany({
          where: { sahibkar_id: sahibkarId, y_n: "daxil" },
          orderBy: { yaradildi: "desc" },
          take: half,
          select: {
            id: true,
            yaradildi: true,
            meblegh: true,
            qeyd: true,
            kontragentler: { select: { ad: true } },
          },
        }),
        prisma.finance_operations.findMany({
          where: { sahibkar_id: sahibkarId, y_n: "xaric" },
          orderBy: { yaradildi: "desc" },
          take: half,
          select: {
            id: true,
            yaradildi: true,
            meblegh: true,
            qeyd: true,
            kontragentler: { select: { ad: true } },
          },
        }),
        prisma.kontragentler.findMany({
          where: { sahibkar_id: sahibkarId, nov: { in: ["musteri", "her_ikisi"] } },
          orderBy: { yaradildi: "desc" },
          take: half,
          select: { id: true, ad: true, yaradildi: true, sirket_adi: true },
        }),
        prisma.tapshiriqlar.findMany({
          where: {
            sahibkar_id: sahibkarId,
            status: "tamamlandi",
            tamamlandi_de: { not: null },
          },
          orderBy: { tamamlandi_de: "desc" },
          take: half,
          select: {
            id: true,
            basliq: true,
            tamamlandi_de: true,
            istifadeciler_tapshiriqlar_mesul_idToistifadeciler: {
              select: { ad_soyad: true },
            },
          },
        }),
      ]);

    const items: ActivityItem[] = [];

    for (const s of satislar) {
      const at = s.yaradildi ?? s.tarix;
      if (!at) continue;
      items.push({
        id: `satis-${s.id}`,
        kind: "satis",
        title: `Satış — ${s.kontragentler?.ad ?? "naməlum müştəri"}`,
        subtitle: null,
        amount: Number(s.son_mebleg ?? 0),
        user: s.istifadeciler_satis_sifarisleri_yaradan_idToistifadeciler?.ad_soyad ?? null,
        at: at.toISOString(),
        href: `/ticaret/satislar/${s.id}`,
      });
    }
    for (const a of alislar) {
      const at = a.yaradildi ?? a.tarix;
      if (!at) continue;
      items.push({
        id: `alis-${a.id}`,
        kind: "alis",
        title: `Alış — ${a.kontragentler?.ad ?? "naməlum təchizatçı"}`,
        subtitle: null,
        amount: Number(a.umumi_mebleg ?? 0),
        user: null,
        at: at.toISOString(),
        href: `/ticaret/alislar/${a.id}`,
      });
    }
    for (const o of odenisDaxil) {
      if (!o.yaradildi) continue;
      items.push({
        id: `odenis_in-${o.id}`,
        kind: "odenis_daxil",
        title: o.kontragentler?.ad
          ? `${o.kontragentler.ad}-dan ödəniş daxil oldu`
          : "Ödəniş daxil oldu",
        subtitle: o.qeyd,
        amount: Number(o.meblegh ?? 0),
        user: null,
        at: o.yaradildi.toISOString(),
        href: null,
      });
    }
    for (const o of odenisXaric) {
      if (!o.yaradildi) continue;
      items.push({
        id: `odenis_out-${o.id}`,
        kind: "odenis_xaric",
        title: o.kontragentler?.ad
          ? `${o.kontragentler.ad}-a ödəniş edildi`
          : "Ödəniş edildi",
        subtitle: o.qeyd,
        amount: Number(o.meblegh ?? 0),
        user: null,
        at: o.yaradildi.toISOString(),
        href: null,
      });
    }
    for (const m of yeniMusteriler) {
      if (!m.yaradildi) continue;
      items.push({
        id: `musteri-${m.id}`,
        kind: "musteri_yeni",
        title: `Yeni müştəri — ${m.ad}`,
        subtitle: m.sirket_adi,
        amount: null,
        user: null,
        at: m.yaradildi.toISOString(),
        href: `/elaqe/musteriler/${m.id}`,
      });
    }
    for (const t of tamTapsiriq) {
      if (!t.tamamlandi_de) continue;
      items.push({
        id: `tapsiriq-${t.id}`,
        kind: "tapshiriq_tamamlandi",
        title: `Tapşırıq tamamlandı — ${t.basliq}`,
        subtitle: null,
        amount: null,
        user: t.istifadeciler_tapshiriqlar_mesul_idToistifadeciler?.ad_soyad ?? null,
        at: t.tamamlandi_de.toISOString(),
        href: `/tapshiriqlar/${t.id}`,
      });
    }

    items.sort((a, b) => (a.at < b.at ? 1 : -1));
    return items.slice(0, limit);
  });
}
