import "server-only";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Müştəri hesab çıxarışı — debet/kredit/qalıq running total ilə tam tarixçə.
 *
 * Akinsoft/Prospect səviyyəsində satış sənədi, ödəniş, qaytarma və avans
 * əməliyyatlarını vahid axına çevirir, qalıq her sətirdə hesablanır.
 *
 * Debet (alacaq artırılır) = satış nisyə, borc artımı
 * Kredit (alacaq azalır) = ödəniş, qaytarma, borc silinməsi
 */

export type StatementRow = {
  tarix: Date;
  nov: "satish" | "odenis" | "qaytarma" | "borc_silinme" | "avans";
  sened_nomresi: string;
  qaime_nomresi: string | null;
  tesvir: string;
  debet: number;  // alacaq artımı (satış)
  kredit: number; // alacaq azalması (ödəniş)
  qaliq: number;  // running total (hesab kartında olan borc)
  ref_id: string | null;
  ref_link: string | null; // UI üçün link path
};

export type CustomerStatement = {
  musteri_id: string;
  musteri_ad: string;
  telefon: string | null;
  email: string | null;
  voen: string | null;
  borc_limiti: number | null;
  baslangic_qaliq: number;
  son_qaliq: number;
  cemi_debet: number;
  cemi_kredit: number;
  donem_baslama: Date;
  donem_bitme: Date;
  rows: StatementRow[];
};

export async function getCustomerStatement(opts: {
  musteri_id: string;
  from?: Date;
  to?: Date;
}): Promise<CustomerStatement | null> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const from = opts.from ?? new Date(2000, 0, 1);
    const to = opts.to ?? new Date();
    to.setHours(23, 59, 59);

    const c = await prisma.kontragentler.findFirst({
      where: { id: opts.musteri_id, sahibkar_id: sahibkarId },
      select: { id: true, ad: true, telefon: true, email: true, voen: true, borc_limiti: true },
    });
    if (!c) return null;

    // Başlanğıc qalıq — `from` tarixindən əvvəlki bütün debet/kredit cəmi
    const beforeAgg = await prisma.$queryRaw<{ debet: number; kredit: number }[]>(Prisma.sql`
      WITH all_events AS (
        SELECT son_mebleg AS debet, 0 AS kredit, tarix
          FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND musteri_id = ${opts.musteri_id}::uuid
           AND COALESCE(status, '') <> 'legv'
           AND COALESCE(qaralama, false) = false
           AND odenis_nov IN ('nisye', 'borc')
        UNION ALL
        SELECT 0 AS debet, meblegh AS kredit, tarix::timestamp
          FROM finance_operations
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND kontragent_id = ${opts.musteri_id}::uuid
           AND status = 'aktiv'
           AND "yön" = 'daxil'
           AND type_kod IN ('qaime', 'borc_silinme')
        UNION ALL
        SELECT 0 AS debet, geri_qaytarildi AS kredit, tarix::timestamp
          FROM qaytarma_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND kontragent_id = ${opts.musteri_id}::uuid
           AND nov = 'musteri'
           AND COALESCE(status, '') <> 'legv'
      )
      SELECT COALESCE(SUM(debet), 0)::float AS debet,
             COALESCE(SUM(kredit), 0)::float AS kredit
        FROM all_events
       WHERE tarix < ${from}
    `);
    const baslangic = Number(beforeAgg[0]?.debet ?? 0) - Number(beforeAgg[0]?.kredit ?? 0);

    // Dövr ərzində hadisələr
    const [sales, payments, returns, advances] = await Promise.all([
      prisma.satis_sifarisleri.findMany({
        where: {
          sahibkar_id: sahibkarId,
          musteri_id: opts.musteri_id,
          status: { not: "legv" },
          qaralama: { not: true },
          odenis_nov: { in: ["nisye", "borc"] },
          tarix: { gte: from, lte: to },
        },
        select: { id: true, nomre: true, tarix: true, son_mebleg: true, qaime_nomresi: true },
        orderBy: { tarix: "asc" },
      }),
      prisma.finance_operations.findMany({
        where: {
          sahibkar_id: sahibkarId,
          kontragent_id: opts.musteri_id,
          status: "aktiv",
          y_n: "daxil",
          type_kod: { in: ["qaime", "borc_silinme"] },
          tarix: { gte: from, lte: to },
        },
        select: { id: true, sened_nomresi: true, tarix: true, meblegh: true, type_kod: true, qeyd: true, satis_id: true },
        orderBy: { tarix: "asc" },
      }),
      prisma.qaytarma_sifarisleri.findMany({
        where: {
          sahibkar_id: sahibkarId,
          kontragent_id: opts.musteri_id,
          nov: "musteri",
          status: { not: "legv" },
          tarix: { gte: from, lte: to },
        },
        select: { id: true, nomre: true, tarix: true, geri_qaytarildi: true, sebeb: true, original_id: true },
        orderBy: { tarix: "asc" },
      }),
      // Avansdan tətbiq — finance_operations qeyd-də [AVANS] tag-ı
      prisma.finance_operations.findMany({
        where: {
          sahibkar_id: sahibkarId,
          kontragent_id: opts.musteri_id,
          status: "aktiv",
          qeyd: { contains: "[AVANS]" },
          tarix: { gte: from, lte: to },
        },
        select: { id: true, sened_nomresi: true, tarix: true, meblegh: true, qeyd: true, satis_id: true },
        orderBy: { tarix: "asc" },
      }),
    ]);

    // Hadisələri birləşdir
    const rows: StatementRow[] = [];
    for (const s of sales) {
      rows.push({
        tarix: s.tarix,
        nov: "satish",
        sened_nomresi: s.nomre,
        qaime_nomresi: s.qaime_nomresi,
        tesvir: "Nisyə satış",
        debet: Number(s.son_mebleg ?? 0),
        kredit: 0,
        qaliq: 0, // sonradan
        ref_id: s.id,
        ref_link: `/ticaret/satislar/${s.id}`,
      });
    }
    const advanceIds = new Set(advances.map((a) => a.id));
    for (const p of payments) {
      if (advanceIds.has(p.id)) continue; // avans ayrıca işlənir
      rows.push({
        tarix: p.tarix,
        nov: p.type_kod === "borc_silinme" ? "borc_silinme" : "odenis",
        sened_nomresi: p.sened_nomresi ?? p.id.slice(0, 8),
        qaime_nomresi: null,
        tesvir: p.type_kod === "borc_silinme" ? "Borc silinməsi" : "Ödəniş qəbulu",
        debet: 0,
        kredit: Number(p.meblegh),
        qaliq: 0,
        ref_id: p.satis_id,
        ref_link: p.satis_id ? `/ticaret/satislar/${p.satis_id}` : `/maliyye/emeliyyat`,
      });
    }
    for (const r of returns) {
      rows.push({
        tarix: r.tarix,
        nov: "qaytarma",
        sened_nomresi: r.nomre,
        qaime_nomresi: null,
        tesvir: r.sebeb ?? "Qaytarma",
        debet: 0,
        kredit: Number(r.geri_qaytarildi ?? 0),
        qaliq: 0,
        ref_id: r.original_id,
        ref_link: r.original_id ? `/ticaret/satislar/${r.original_id}` : `/ticaret/qaytarma`,
      });
    }
    for (const a of advances) {
      rows.push({
        tarix: a.tarix,
        nov: "avans",
        sened_nomresi: a.sened_nomresi ?? a.id.slice(0, 8),
        qaime_nomresi: null,
        tesvir: "Avansdan tətbiq",
        debet: 0,
        kredit: Number(a.meblegh),
        qaliq: 0,
        ref_id: a.satis_id,
        ref_link: a.satis_id ? `/ticaret/satislar/${a.satis_id}` : null,
      });
    }

    // Tarixə görə sırala (eyni gündə satışlar əvvəlcə, ödənişlər sonra)
    rows.sort((x, y) => {
      const tx = new Date(x.tarix).getTime();
      const ty = new Date(y.tarix).getTime();
      if (tx !== ty) return tx - ty;
      // Eyni vaxt: satışı əvvələ, ödənişi sonraya
      const order: Record<string, number> = { satish: 0, qaytarma: 1, odenis: 2, avans: 3, borc_silinme: 4 };
      return (order[x.nov] ?? 9) - (order[y.nov] ?? 9);
    });

    // Running total
    let qaliq = baslangic;
    let cemiDebet = 0;
    let cemiKredit = 0;
    for (const r of rows) {
      qaliq += r.debet - r.kredit;
      r.qaliq = +qaliq.toFixed(2);
      cemiDebet += r.debet;
      cemiKredit += r.kredit;
    }

    return {
      musteri_id: c.id,
      musteri_ad: c.ad,
      telefon: c.telefon,
      email: c.email,
      voen: c.voen,
      borc_limiti: c.borc_limiti != null ? Number(c.borc_limiti) : null,
      baslangic_qaliq: +baslangic.toFixed(2),
      son_qaliq: +qaliq.toFixed(2),
      cemi_debet: +cemiDebet.toFixed(2),
      cemi_kredit: +cemiKredit.toFixed(2),
      donem_baslama: from,
      donem_bitme: to,
      rows,
    };
  });
}
