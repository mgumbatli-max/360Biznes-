import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { silentFallback } from "@/lib/safe-query";

export type AccountRow = {
  id: string;
  ad: string;
  nov: string; // negd / bank / kart / e_pul / digər
  is_kassa: boolean;
  bank_adi: string | null;
  iban: string | null;
  kart_son4: string | null;
  qaliq: number;
  valyuta: string;
  aktiv: boolean;
  filial_ad: string | null;
  mesul_ad: string | null;
  qeyd: string | null;
  son_emeliyyat_de: Date | null;
  bugun_dovriyye: number;
  yaradildi: Date | null;
  yenilendi: Date | null;
};

export async function getAccounts(): Promise<AccountRow[]> {
  return withTenant(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [maliyeRows, kassaRows] = await Promise.all([
      prisma.maliye_hesablari.findMany({
        orderBy: [{ aktiv: "desc" }, { ad: "asc" }],
        include: {
          filiallar: { select: { ad: true } },
          istifadeciler_maliye_hesablari_mesul_idToistifadeciler: {
            select: { ad_soyad: true },
          },
        },
      }).catch(silentFallback("getHesablar.findMany", [] as never[])),
      prisma.kassalar.findMany({
        orderBy: { acilis_tarixi: "desc" },
        include: {
          filiallar: { select: { ad: true } },
          istifadeciler_kassalar_acan_idToistifadeciler: { select: { ad_soyad: true } },
        },
      }),
    ]);

    const ids = maliyeRows.map((r) => r.id);
    let dailyMap = new Map<string, number>();
    let lastOpMap = new Map<string, Date>();
    if (ids.length > 0) {
      try {
        const [daily, last] = await Promise.all([
          prisma.hesab_emeliyyatlari.groupBy({
            by: ["hesab_id"],
            where: { hesab_id: { in: ids }, tarix: { gte: today } },
            _sum: { mebleg: true },
          }),
          prisma.hesab_emeliyyatlari.findMany({
            where: { hesab_id: { in: ids } },
            orderBy: { tarix: "desc" },
            distinct: ["hesab_id"],
            select: { hesab_id: true, tarix: true },
          }),
        ]);
        for (const d of daily) dailyMap.set(d.hesab_id, Number(d._sum.mebleg ?? 0));
        for (const l of last) lastOpMap.set(l.hesab_id, l.tarix);
      } catch {}
    }

    const out: AccountRow[] = maliyeRows.map((r) => ({
      id: r.id,
      ad: r.ad,
      nov: r.nov ?? "negd",
      is_kassa: false,
      bank_adi: r.bank_adi ?? null,
      iban: r.iban ?? null,
      kart_son4: r.kart_son4 ?? null,
      qaliq: Number(r.qaliq ?? 0),
      valyuta: r.valyuta ?? "AZN",
      aktiv: r.aktiv ?? true,
      filial_ad: r.filiallar?.ad ?? null,
      mesul_ad:
        r.istifadeciler_maliye_hesablari_mesul_idToistifadeciler?.ad_soyad ?? null,
      qeyd: r.qeyd ?? null,
      son_emeliyyat_de: lastOpMap.get(r.id) ?? null,
      bugun_dovriyye: dailyMap.get(r.id) ?? 0,
      yaradildi: r.yaradildi ?? null,
      yenilendi: r.yenilendi ?? null,
    }));

    for (const k of kassaRows) {
      out.push({
        id: k.id,
        ad: k.ad,
        nov: "kassa",
        is_kassa: true,
        bank_adi: null,
        iban: null,
        kart_son4: null,
        qaliq: Number(k.acilis_qaligi ?? 0),
        valyuta: "AZN",
        aktiv: (k.status ?? "acig") === "acig",
        filial_ad: k.filiallar?.ad ?? null,
        mesul_ad: k.istifadeciler_kassalar_acan_idToistifadeciler?.ad_soyad ?? null,
        qeyd: k.qeyd ?? null,
        son_emeliyyat_de: k.acilis_tarixi ?? null,
        bugun_dovriyye: 0,
        yaradildi: k.yaradildi ?? null,
        yenilendi: k.yenilendi ?? null,
      });
    }

    return out;
  });
}

// ─── Hesab detail — balans tarixçəsi + son əməliyyatlar ──────────────
export type AccountOpRow = {
  id: string;
  tarix: Date | null;
  type_kod: string;
  y_n: string;
  meblegh: number;
  status: string;
  kontragent_ad: string | null;
  qeyd: string | null;
  sened_nomresi: string | null;
};

export type AccountDetail = {
  id: string;
  ad: string;
  nov: string;
  is_kassa: boolean;
  bank_adi: string | null;
  iban: string | null;
  kart_son4: string | null;
  qaliq: number;
  valyuta: string;
  aktiv: boolean;
  qeyd: string | null;
  bugun_giris: number;
  bugun_cixis: number;
  ay_giris: number;
  ay_cixis: number;
  son_30_gun: Array<{ tarix: string; giris: number; cixis: number; net: number }>;
  operations: AccountOpRow[];
};

export async function getAccountDetail(id: string): Promise<AccountDetail | null> {
  return withTenant(async () => {
    const h = await prisma.maliye_hesablari.findFirst({
      where: { id },
      select: {
        id: true, ad: true, nov: true, bank_adi: true, iban: true,
        kart_son4: true, qaliq: true, valyuta: true, aktiv: true, qeyd: true,
      },
    });
    if (!h) return null;

    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyAgo = new Date(now); thirtyAgo.setDate(thirtyAgo.getDate() - 29);
    thirtyAgo.setHours(0, 0, 0, 0);

    // Bugün və ay aggregates (giriş + çıxış ayrı-ayrı)
    const [todayAgg, monthAgg, dailyRows, operations] = await Promise.all([
      prisma.finance_operations.groupBy({
        by: ["y_n"],
        where: { hesab_id: id, status: "aktiv", tarix: { gte: today } },
        _sum: { azn_meblegh: true },
      }),
      prisma.finance_operations.groupBy({
        by: ["y_n"],
        where: { hesab_id: id, status: "aktiv", tarix: { gte: monthStart } },
        _sum: { azn_meblegh: true },
      }),
      prisma.$queryRaw<{ d: Date; y_n: string; cem: number }[]>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (await import("@/lib/db/prisma")).Prisma.sql`
          SELECT tarix AS d, "yön" AS y_n,
                 SUM(COALESCE(azn_meblegh, meblegh, 0))::float AS cem
            FROM finance_operations
           WHERE hesab_id = ${id}::uuid
             AND status = 'aktiv'
             AND tarix >= ${thirtyAgo}::date
           GROUP BY tarix, "yön"
           ORDER BY tarix
        `,
      ),
      prisma.finance_operations.findMany({
        where: { hesab_id: id, status: { not: "legv" } },
        orderBy: { tarix: "desc" },
        take: 100,
        select: {
          id: true, tarix: true, type_kod: true, y_n: true,
          meblegh: true, status: true, qeyd: true, sened_nomresi: true,
          kontragentler: { select: { ad: true } },
        },
      }),
    ]);

    // QA-K20: 'mexaric' və 'xaric' (iki yazılış) hər ikisi çıxış sayılır.
    const sumByYn = (rows: { y_n: string; _sum: { azn_meblegh: import("@prisma/client/runtime/library").Decimal | null } }[], target: string) => {
      const targets = target === "mexaric" ? ["mexaric", "xaric"] : target === "daxil" ? ["daxil", "medaxil"] : [target];
      return rows
        .filter((x) => targets.includes(x.y_n))
        .reduce((s, r) => s + Number(r._sum.azn_meblegh ?? 0), 0);
    };

    // 30-gün-lik bucketləri doldur
    const byDate = new Map<string, { giris: number; cixis: number }>();
    for (const r of dailyRows) {
      const key = new Date(r.d).toISOString().slice(0, 10);
      const cur = byDate.get(key) ?? { giris: 0, cixis: 0 };
      if (r.y_n === "daxil" || r.y_n === "medaxil") cur.giris += Number(r.cem);
      else cur.cixis += Number(r.cem);
      byDate.set(key, cur);
    }
    const son30: AccountDetail["son_30_gun"] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      const x = byDate.get(key) ?? { giris: 0, cixis: 0 };
      son30.push({ tarix: key, giris: x.giris, cixis: x.cixis, net: x.giris - x.cixis });
    }

    return {
      id: h.id,
      ad: h.ad,
      nov: h.nov,
      is_kassa: h.nov === "negd", // QA-orta: kanonik nov "negd" — "nagd" müqayisəsi həmişə false idi
      bank_adi: h.bank_adi,
      iban: h.iban,
      kart_son4: h.kart_son4,
      qaliq: Number(h.qaliq ?? 0),
      valyuta: h.valyuta ?? "AZN",
      aktiv: h.aktiv ?? true,
      qeyd: h.qeyd,
      bugun_giris: sumByYn(todayAgg, "daxil"),
      bugun_cixis: sumByYn(todayAgg, "mexaric"),
      ay_giris: sumByYn(monthAgg, "daxil"),
      ay_cixis: sumByYn(monthAgg, "mexaric"),
      son_30_gun: son30,
      operations: operations.map((op) => ({
        id: op.id,
        tarix: op.tarix,
        type_kod: op.type_kod,
        y_n: op.y_n,
        meblegh: Number(op.meblegh),
        status: op.status,
        kontragent_ad: op.kontragentler?.ad ?? null,
        qeyd: op.qeyd,
        sened_nomresi: op.sened_nomresi,
      })),
    };
  });
}

export type AccountStats = {
  hesab_say: number;
  kassa_say: number;
  bank_say: number;
  cem_balans_azn: number;
};

export async function getAccountStats(): Promise<AccountStats> {
  return withTenant(async () => {
    const accounts = await getAccounts();
    let kassaSay = 0;
    let bankSay = 0;
    let cem = 0;
    for (const a of accounts) {
      if (a.is_kassa) kassaSay++;
      else if (a.nov === "bank" || a.nov === "kart") bankSay++;
      if (a.valyuta === "AZN") cem += a.qaliq;
    }
    return {
      hesab_say: accounts.length,
      kassa_say: kassaSay,
      bank_say: bankSay,
      cem_balans_azn: cem,
    };
  });
}
