import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

// Roadmap: XƏRC BÜDCƏSİ (kateqoriya üzrə aylıq büdcə vs faktiki xərc). Maliyyə-də yox idi
// (iscilier/budce = HR şöbə planı, ayrı şey). Büdcə ayarlar cədvəlində saxlanılır (schema-siz).
const QRUP = "maliyye";
const ACAR_PREFIX = "xerc_budce:"; // + kateqoriya_id → həmin kateqoriyanın aylıq büdcəsi

export type ExpenseBudgetRow = {
  kateqoriya_id: number;
  ad: string;
  reng: string | null;
  budce: number;        // aylıq büdcə (0 = təyin olunmayıb)
  faktiki: number;      // bu ay faktiki xərc
  qaliq: number;        // büdcə − faktiki (mənfi = aşıb)
  faiz: number;         // faktiki/büdcə %
  proyeksiya: number;   // cari tempə görə ay-sonu proqnozu
  asib: boolean;        // faktiki > büdcə
  proyeksiya_asir: boolean; // proqnoz büdcəni aşır
};

export type ExpenseBudgetReport = {
  ay_gun_say: number;
  bugun_gun: number;
  budce_cemi: number;
  faktiki_cemi: number;
  asan_kateqoriya_say: number; // büdcəni aşan kateqoriya sayı
  setirler: ExpenseBudgetRow[];
};

// QEYD: setExpenseBudget action-ı ayrıca "use server" faylındadır (xerc-budce-actions.ts) —
// bu fayl type export etdiyi üçün "use server" ola bilməz (Turbopack runtime ReferenceError riski).
export const XERC_BUDCE_QRUP = QRUP;
export const XERC_BUDCE_ACAR_PREFIX = ACAR_PREFIX;

/** Xərc büdcəsi hesabatı: hər kateqoriya üçün büdcə vs bu ay faktiki + proqnoz. */
export async function getExpenseBudgetReport(): Promise<ExpenseBudgetReport> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const ayGunSay = Math.round((nextMonth.getTime() - monthStart.getTime()) / 86400000);
    const bugunGun = now.getDate();

    const [cats, budgetRows, faktikiRows] = await Promise.all([
      prisma.xerc_kateqoriyalari.findMany({ where: { aktiv: true }, select: { id: true, ad: true, reng: true } }),
      prisma.ayarlar.findMany({ where: { sahibkar_id: sahibkarId, qrup: QRUP, acar: { startsWith: ACAR_PREFIX } }, select: { acar: true, deyer: true } }),
      prisma.xercl_r.groupBy({
        by: ["kateqoriya_id"],
        where: { sahibkar_id: sahibkarId, tarix: { gte: monthStart }, legv_de: null },
        _sum: { mebleg: true },
      }),
    ]);

    const budgetMap = new Map<number, number>();
    for (const b of budgetRows) {
      const id = Number(b.acar.slice(ACAR_PREFIX.length));
      const n = Number(b.deyer);
      if (Number.isFinite(id) && Number.isFinite(n) && n > 0) budgetMap.set(id, n);
    }
    const faktikiMap = new Map<number, number>();
    for (const f of faktikiRows) {
      if (f.kateqoriya_id != null) faktikiMap.set(f.kateqoriya_id, Number(f._sum.mebleg ?? 0));
    }

    const catName = new Map(cats.map((c) => [c.id, c]));
    // Büdcəsi OLAN və ya bu ay xərci OLAN kateqoriyalar
    const ids = new Set<number>([...budgetMap.keys(), ...faktikiMap.keys()]);
    const setirler: ExpenseBudgetRow[] = [];
    for (const id of ids) {
      const cat = catName.get(id);
      const budce = budgetMap.get(id) ?? 0;
      const faktiki = Math.round((faktikiMap.get(id) ?? 0) * 100) / 100;
      const gunlukOrta = bugunGun > 0 ? faktiki / bugunGun : 0;
      const proyeksiya = Math.round(gunlukOrta * ayGunSay);
      setirler.push({
        kateqoriya_id: id,
        ad: cat?.ad ?? "Kateqoriyasız",
        reng: cat?.reng ?? null,
        budce, faktiki,
        qaliq: Math.round((budce - faktiki) * 100) / 100,
        faiz: budce > 0 ? Math.round((faktiki / budce) * 100) : 0,
        proyeksiya,
        asib: budce > 0 && faktiki > budce,
        proyeksiya_asir: budce > 0 && proyeksiya > budce,
      });
    }
    // Büdcəsi olanlar əvvəl, aşanlar yuxarı; sonra faktiki üzrə azalan
    setirler.sort((a, b) => (b.asib ? 1 : 0) - (a.asib ? 1 : 0) || (b.budce > 0 ? 1 : 0) - (a.budce > 0 ? 1 : 0) || b.faktiki - a.faktiki);

    const budceCemi = setirler.reduce((s, r) => s + r.budce, 0);
    const faktikiCemi = setirler.reduce((s, r) => s + r.faktiki, 0);

    return {
      ay_gun_say: ayGunSay, bugun_gun: bugunGun,
      budce_cemi: Math.round(budceCemi * 100) / 100,
      faktiki_cemi: Math.round(faktikiCemi * 100) / 100,
      asan_kateqoriya_say: setirler.filter((r) => r.asib).length,
      setirler,
    };
  });
}
