import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

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
      }).catch(() => [] as never[]),
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
