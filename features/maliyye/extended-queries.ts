import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

// ───────────────────────────────────────────────────────────
// REAL-TIME ACCOUNT BALANCE
// ───────────────────────────────────────────────────────────
/**
 * Real balansı qaytarır — `maliye_hesablari.qaliq` + son finance_operations əməliyyatlarından hərəkət.
 * Qiymət real-time formada formada göstərilir.
 */
export async function getAccountBalance(
  hesabId: string,
): Promise<{ ad: string; valyuta: string; balans: number } | null> {
  if (!hesabId) return null;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const hesab = await prisma.maliye_hesablari
      .findFirst({
        where: { id: hesabId, sahibkar_id: sahibkarId },
        select: { id: true, ad: true, valyuta: true, qaliq: true },
      })
      .catch(() => null);
    if (!hesab) return null;

    // Aggregate aktiv finance_operations for this hesab
    const [daxilAgg, xaricAgg, transferIn] = await Promise.all([
      prisma.finance_operations.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          hesab_id: hesabId,
          status: "aktiv",
          y_n: "daxil",
        },
        _sum: { meblegh: true },
      }),
      prisma.finance_operations.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          hesab_id: hesabId,
          status: "aktiv",
          y_n: { in: ["xaric", "transfer"] },
        },
        _sum: { meblegh: true },
      }),
      prisma.finance_operations.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          hesab_id2: hesabId,
          status: "aktiv",
        },
        _sum: { meblegh2: true },
      }),
    ]);
    const base = Number(hesab.qaliq ?? 0);
    const daxil = Number(daxilAgg._sum.meblegh ?? 0);
    const xaric = Number(xaricAgg._sum.meblegh ?? 0);
    const trIn = Number(transferIn._sum.meblegh2 ?? 0);
    return {
      ad: hesab.ad,
      valyuta: hesab.valyuta ?? "AZN",
      balans: base + daxil + trIn - xaric,
    };
  });
}

// ───────────────────────────────────────────────────────────
// SENED ATTACHMENTS for an operation
// ───────────────────────────────────────────────────────────
export type FinanceAttachmentRow = {
  id: number;
  ad: string | null;
  fayl_url: string;
  fayl_nov: string | null;
  fayl_olcu: number | null;
  yaradan_ad: string | null;
  yaradildi: Date | null;
};

export async function getFinanceAttachments(operationId: string): Promise<FinanceAttachmentRow[]> {
  if (!operationId) return [];
  return withTenant(async () => {
    const rows = await prisma.finance_attachments
      .findMany({
        where: { operation_id: operationId },
        orderBy: { yaradildi: "desc" },
        include: { istifadeciler: { select: { ad_soyad: true } } },
      })
      .catch(() => [] as Array<{
        id: number;
        ad: string | null;
        fayl_url: string;
        fayl_nov: string | null;
        fayl_olcu: number | null;
        yaradildi: Date | null;
        istifadeciler: { ad_soyad: string } | null;
      }>);
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      fayl_url: r.fayl_url,
      fayl_nov: r.fayl_nov,
      fayl_olcu: r.fayl_olcu,
      yaradan_ad: r.istifadeciler?.ad_soyad ?? null,
      yaradildi: r.yaradildi,
    }));
  });
}

// ───────────────────────────────────────────────────────────
// RECURRING RULES LIST
// ───────────────────────────────────────────────────────────
export type RecurringRow = {
  id: string;
  tip_ad: string;
  type_kod: string;
  mebleg: number;
  valyuta: string;
  tezlik: string;
  son_tarix: string | null;
  say: number | null;
  hesab_ad: string | null;
  kontragent_ad: string | null;
  yaradildi: Date | null;
  status: string;
  qeyd: string | null;
  yaradilan_say: number;
  growth_disabled: boolean;
};

export async function getRecurringRules(): Promise<RecurringRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.finance_operations.findMany({
      where: {
        sahibkar_id: sahibkarId,
        OR: [
          { qeyd: { contains: "[RECUR:" } },
          { qeyd: { contains: "[RECUR_OFF]" } },
        ],
      },
      include: {
        finance_operation_types: { select: { ad: true } },
        maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari: { select: { ad: true } },
        kontragentler: { select: { ad: true } },
      },
      orderBy: { yaradildi: "desc" },
      take: 200,
    });

    const out: RecurringRow[] = [];
    for (const r of rows) {
      const q = r.qeyd ?? "";
      const off = /\[RECUR_OFF\]/i.test(q);
      const m = q.match(/\[RECUR:([^\]]+)\]/i);
      let tezlik = "";
      let son: string | null = null;
      let say: number | null = null;
      if (m) {
        const parts = m[1].split(",").map((s) => s.trim()).filter(Boolean);
        tezlik = parts[0] ?? "";
        for (const p of parts.slice(1)) {
          if (/^until=/i.test(p)) son = p.replace(/^until=/i, "");
          else if (/^\d+$/.test(p)) say = Number(p);
        }
      }
      const yaranan = await prisma.finance_operations.count({
        where: {
          sahibkar_id: sahibkarId,
          qeyd: { contains: `[RECUR_INST:${r.id}]` },
        },
      });
      out.push({
        id: r.id,
        tip_ad: r.finance_operation_types?.ad ?? r.type_kod,
        type_kod: r.type_kod,
        mebleg: Number(r.meblegh),
        valyuta: r.valyuta ?? "AZN",
        tezlik,
        son_tarix: son,
        say,
        hesab_ad:
          r.maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari?.ad ?? null,
        kontragent_ad: r.kontragentler?.ad ?? null,
        yaradildi: r.yaradildi,
        status: off ? "deaktiv" : "aktiv",
        qeyd: r.qeyd,
        yaradilan_say: yaranan,
        growth_disabled: off,
      });
    }
    return out;
  });
}

// ───────────────────────────────────────────────────────────
// THRESHOLD SETTINGS — get
// ───────────────────────────────────────────────────────────
export type MaliyyeThreshold = {
  xerc: number;
  transfer: number;
  qaime: number;
  maas: number;
  default: number;
};

export async function getMaliyyeThresholds(): Promise<MaliyyeThreshold> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar
      .findMany({
        where: { sahibkar_id: sahibkarId, qrup: "maliyye_threshold" },
        select: { acar: true, deyer: true },
      })
      .catch(() => [] as { acar: string; deyer: string | null }[]);
    const defaults: MaliyyeThreshold = {
      xerc: 10000,
      transfer: 50000,
      qaime: 100000,
      maas: 20000,
      default: 25000,
    };
    for (const r of rows) {
      const n = Number(r.deyer);
      if (!Number.isNaN(n) && r.acar in defaults) {
        (defaults as Record<string, number>)[r.acar] = n;
      }
    }
    return defaults;
  });
}

// ───────────────────────────────────────────────────────────
// P&L / BALANCE — beynəlxalq standart hesabatlar
// ───────────────────────────────────────────────────────────
export type PLBlock = {
  donem: string;
  gelir: number;
  cogs: number; // satılan malların maya dəyəri
  brut_menfeet: number;
  brut_marja: number;
  xerc_emeliyyat: number; // operating expense
  xerc_maas: number;
  xerc_ofis: number;
  xerc_marketing: number;
  xerc_diger: number;
  ebitda: number;
  ebitda_marja: number;
  vergi: number;
  net_menfeet: number;
  net_marja: number;
};

export async function getPLBlock(year: number, month: number): Promise<PLBlock> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const [salesAgg, cogsAgg, expByKateq, vergiAgg, finOpsByQrup] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          tarix: { gte: start, lt: end },
          status: { not: "legv" },
          qaralama: { not: true },
        },
        _sum: { odenilmis: true, son_mebleg: true },
      }),
      prisma.$queryRaw<{ cogs: number }[]>`
        SELECT COALESCE(SUM(sat.miqdar * COALESCE(m.alish_qiymeti, 0)), 0)::float AS cogs
          FROM satis_satirlari sat
          JOIN satis_sifarisleri ss ON ss.id = sat.sifaris_id
          LEFT JOIN mehsullar m ON m.id = sat.mehsul_id
         WHERE ss.sahibkar_id = ${sahibkarId}::uuid
           AND ss.tarix >= ${start} AND ss.tarix < ${end}
           AND ss.status != 'legv'
           AND ss.qaralama IS NOT TRUE
      `.catch(() => [] as { cogs: number }[]),
      prisma.$queryRaw<{ qrup: string | null; mebleg: number }[]>`
        SELECT COALESCE(xk.qrup, 'umumi') AS qrup, COALESCE(SUM(x.mebleg), 0)::float AS mebleg
          FROM "xerclər" x
          LEFT JOIN xerc_kateqoriyalari xk ON xk.id = x.kateqoriya_id
         WHERE x.sahibkar_id = ${sahibkarId}::uuid
           AND x.tarix >= ${start} AND x.tarix < ${end}
         GROUP BY xk.qrup
      `.catch(() => [] as { qrup: string | null; mebleg: number }[]),
      prisma.$queryRaw<{ cem: number }[]>`
        SELECT COALESCE(SUM(x.mebleg), 0)::float AS cem
          FROM "xerclər" x
          LEFT JOIN xerc_kateqoriyalari xk ON xk.id = x.kateqoriya_id
         WHERE x.sahibkar_id = ${sahibkarId}::uuid
           AND x.tarix >= ${start} AND x.tarix < ${end}
           AND (xk.qrup = 'vergi' OR xk.ad ILIKE '%vergi%')
      `.catch(() => [] as { cem: number }[]),
      prisma.$queryRaw<{ qrup: string | null; mebleg: number }[]>`
        SELECT COALESCE(ft.qrup, 'diger') AS qrup, COALESCE(SUM(fo.azn_meblegh), 0)::float AS mebleg
          FROM finance_operations fo
          LEFT JOIN finance_operation_types ft ON ft.id = fo.type_id
         WHERE fo.sahibkar_id = ${sahibkarId}::uuid
           AND fo.tarix >= ${start} AND fo.tarix < ${end}
           AND fo.status = 'aktiv'
           AND fo."yön" = 'xaric'
         GROUP BY ft.qrup
      `.catch(() => [] as { qrup: string | null; mebleg: number }[]),
    ]);

    const gelir = Number(salesAgg._sum.son_mebleg ?? salesAgg._sum.odenilmis ?? 0);
    const cogs = Number(cogsAgg[0]?.cogs ?? 0);
    const brut_menfeet = gelir - cogs;
    const brut_marja = gelir > 0 ? (brut_menfeet / gelir) * 100 : 0;

    let xerc_maas = 0;
    let xerc_ofis = 0;
    let xerc_marketing = 0;
    let xerc_diger = 0;
    for (const r of expByKateq) {
      const q = r.qrup ?? "umumi";
      const v = Number(r.mebleg ?? 0);
      if (q === "vergi") continue; // vergi ayrıca
      if (q === "maas" || q === "maas_isci") xerc_maas += v;
      else if (q === "ofis") xerc_ofis += v;
      else if (q === "marketing") xerc_marketing += v;
      else xerc_diger += v;
    }
    for (const r of finOpsByQrup) {
      const q = r.qrup ?? "diger";
      const v = Number(r.mebleg ?? 0);
      if (q === "maas_isci") xerc_maas += v;
      else if (q === "vergi") continue;
      else xerc_diger += v;
    }
    const xerc_emeliyyat = xerc_maas + xerc_ofis + xerc_marketing + xerc_diger;
    const ebitda = brut_menfeet - xerc_emeliyyat;
    const ebitda_marja = gelir > 0 ? (ebitda / gelir) * 100 : 0;
    const vergi = Number(vergiAgg[0]?.cem ?? 0);
    const net_menfeet = ebitda - vergi;
    const net_marja = gelir > 0 ? (net_menfeet / gelir) * 100 : 0;
    const aylar = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
    return {
      donem: `${aylar[month - 1]} ${year}`,
      gelir,
      cogs,
      brut_menfeet,
      brut_marja,
      xerc_emeliyyat,
      xerc_maas,
      xerc_ofis,
      xerc_marketing,
      xerc_diger,
      ebitda,
      ebitda_marja,
      vergi,
      net_menfeet,
      net_marja,
    };
  });
}

export type BalanceSheet = {
  aktivler: {
    kassa_bank: number;
    debitor: number;
    stok: number;
    esas_vesait: number;
    cem: number;
  };
  passivler: {
    kreditor: number;
    vergi_borcu: number;
    kredit: number;
    cem: number;
  };
  kapital: {
    sahibkar_pulu: number;
    yigilmis_menfeet: number;
    cem: number;
  };
};

export async function getBalanceSheet(): Promise<BalanceSheet> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [hesablar, kassalar, debitorAgg, stokAgg, kreditorAgg, sahibAgg] = await Promise.all([
      prisma.maliye_hesablari.aggregate({
        where: { aktiv: true },
        _sum: { qaliq: true },
      }),
      prisma.kassalar.aggregate({
        where: { status: "acig" },
        _sum: { acilis_qaligi: true },
      }),
      prisma.$queryRaw<{ cem: number }[]>`
        SELECT COALESCE(SUM(borc), 0)::float AS cem
          FROM kontragentler
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND nov IN ('musteri', 'her_ikisi')
           AND borc > 0
      `.catch(() => [] as { cem: number }[]),
      prisma.$queryRaw<{ cem: number }[]>`
        SELECT COALESCE(SUM(s.miqdar * COALESCE(m.alish_qiymeti, 0)), 0)::float AS cem
          FROM stok s
          JOIN mehsullar m ON m.id = s.mehsul_id
         WHERE s.sahibkar_id = ${sahibkarId}::uuid
      `.catch(() => [] as { cem: number }[]),
      prisma.$queryRaw<{ cem: number }[]>`
        SELECT COALESCE(ABS(SUM(LEAST(borc, 0))), 0)::float AS cem
          FROM kontragentler
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND nov IN ('techizatci', 'her_ikisi')
      `.catch(() => [] as { cem: number }[]),
      prisma.$queryRaw<{ cem: number }[]>`
        SELECT COALESCE(SUM(fo.azn_meblegh), 0)::float AS cem
          FROM finance_operations fo
          LEFT JOIN finance_operation_types ft ON ft.id = fo.type_id
         WHERE fo.sahibkar_id = ${sahibkarId}::uuid
           AND fo.status = 'aktiv'
           AND ft.qrup = 'sahibkar'
           AND fo."yön" = 'daxil'
      `.catch(() => [] as { cem: number }[]),
    ]);

    const kassa_bank = Number(hesablar._sum.qaliq ?? 0) + Number(kassalar._sum.acilis_qaligi ?? 0);
    const debitor = Number(debitorAgg[0]?.cem ?? 0);
    const stok = Number(stokAgg[0]?.cem ?? 0);
    const esas_vesait = 0; // TODO: ƏV registru olanda
    const aktiv_cem = kassa_bank + debitor + stok + esas_vesait;

    const kreditor = Number(kreditorAgg[0]?.cem ?? 0);
    const vergi_borcu = 0;
    const kredit = 0;
    const passiv_cem = kreditor + vergi_borcu + kredit;

    const sahibkar_pulu = Number(sahibAgg[0]?.cem ?? 0);
    const yigilmis_menfeet = aktiv_cem - passiv_cem - sahibkar_pulu;

    return {
      aktivler: { kassa_bank, debitor, stok, esas_vesait, cem: aktiv_cem },
      passivler: { kreditor, vergi_borcu, kredit, cem: passiv_cem },
      kapital: { sahibkar_pulu, yigilmis_menfeet, cem: sahibkar_pulu + yigilmis_menfeet },
    };
  });
}

export type PLTrendRow = { ay: string; gelir: number; xerc: number; menfeet: number };

export async function getPLTrend(months = 12): Promise<PLTrendRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const out: PLTrendRow[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const y = now.getFullYear();
      const m = now.getMonth() - i;
      const dt = new Date(y, m, 1);
      const start = new Date(dt.getFullYear(), dt.getMonth(), 1);
      const end = new Date(dt.getFullYear(), dt.getMonth() + 1, 1);
      const ayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const [s, x] = await Promise.all([
        prisma.satis_sifarisleri.aggregate({
          where: {
            sahibkar_id: sahibkarId,
            tarix: { gte: start, lt: end },
            status: { not: "legv" },
            qaralama: { not: true },
          },
          _sum: { son_mebleg: true },
        }),
        prisma.xercl_r.aggregate({
          where: { sahibkar_id: sahibkarId, tarix: { gte: start, lt: end } },
          _sum: { mebleg: true },
        }),
      ]);
      const gelir = Number(s._sum.son_mebleg ?? 0);
      const xerc = Number(x._sum.mebleg ?? 0);
      out.push({ ay: ayKey, gelir, xerc, menfeet: gelir - xerc });
    }
    return out;
  });
}
