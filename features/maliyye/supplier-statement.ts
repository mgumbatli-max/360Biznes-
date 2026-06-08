import "server-only";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Təchizatçı hesab çıxarışı — debet/kredit/qalıq tarixçəsi.
 *
 * Təchizatçı perspektivində:
 *  Debet (bizim borcumuz azalır) = ödəniş, qaytarma
 *  Kredit (bizim borcumuz artır) = alış qaiməsi
 *
 * Qalıq: pozitiv = biz təchizatçıya borcluyuq
 */

export type SupplierStatementRow = {
  tarix: Date;
  nov: "alish" | "odenis" | "qaytarma";
  sened_nomresi: string;
  qaime_nomresi: string | null;
  tesvir: string;
  debet: number;  // bizim borcumuz azalır
  kredit: number; // bizim borcumuz artır
  qaliq: number;
  ref_id: string | null;
  ref_link: string | null;
};

export type SupplierStatement = {
  techizatci_id: string;
  techizatci_ad: string;
  telefon: string | null;
  email: string | null;
  voen: string | null;
  baslangic_qaliq: number;
  son_qaliq: number;
  cemi_debet: number;
  cemi_kredit: number;
  donem_baslama: Date;
  donem_bitme: Date;
  rows: SupplierStatementRow[];
};

export async function getSupplierStatement(opts: {
  techizatci_id: string;
  from?: Date;
  to?: Date;
}): Promise<SupplierStatement | null> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const from = opts.from ?? new Date(2000, 0, 1);
    const to = opts.to ?? new Date();
    to.setHours(23, 59, 59);

    const c = await prisma.kontragentler.findFirst({
      where: { id: opts.techizatci_id, sahibkar_id: sahibkarId },
      select: { id: true, ad: true, telefon: true, email: true, voen: true },
    });
    if (!c) return null;

    const beforeAgg = await prisma.$queryRaw<{ debet: number; kredit: number }[]>(Prisma.sql`
      WITH all_events AS (
        SELECT 0 AS debet, umumi_mebleg AS kredit, tarix
          FROM alis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND techiazatci_id = ${opts.techizatci_id}::uuid
           AND COALESCE(status, '') <> 'legv'
        UNION ALL
        SELECT meblegh AS debet, 0 AS kredit, tarix::timestamp
          FROM finance_operations
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND kontragent_id = ${opts.techizatci_id}::uuid
           AND status = 'aktiv'
           AND "yön" = 'mexaric'
           AND type_kod = 'alis_odenis'
        UNION ALL
        SELECT geri_qaytarildi AS debet, 0 AS kredit, tarix::timestamp
          FROM qaytarma_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND kontragent_id = ${opts.techizatci_id}::uuid
           AND nov = 'techizatci'
           AND COALESCE(status, '') <> 'legv'
      )
      SELECT COALESCE(SUM(debet), 0)::float AS debet,
             COALESCE(SUM(kredit), 0)::float AS kredit
        FROM all_events
       WHERE tarix < ${from}
    `);
    // qalıq = kredit - debet (biz borclu olduqda pozitiv)
    const baslangic = Number(beforeAgg[0]?.kredit ?? 0) - Number(beforeAgg[0]?.debet ?? 0);

    const [purchases, payments, returns] = await Promise.all([
      prisma.alis_sifarisleri.findMany({
        where: {
          sahibkar_id: sahibkarId,
          techiazatci_id: opts.techizatci_id,
          status: { not: "legv" },
          tarix: { gte: from, lte: to },
        },
        select: { id: true, nomre: true, tarix: true, umumi_mebleg: true, qaime_nomre: true },
        orderBy: { tarix: "asc" },
      }),
      prisma.finance_operations.findMany({
        where: {
          sahibkar_id: sahibkarId,
          kontragent_id: opts.techizatci_id,
          status: "aktiv",
          y_n: "mexaric",
          type_kod: "alis_odenis",
          tarix: { gte: from, lte: to },
        },
        select: { id: true, sened_nomresi: true, tarix: true, meblegh: true, qeyd: true, alish_id: true },
        orderBy: { tarix: "asc" },
      }),
      prisma.qaytarma_sifarisleri.findMany({
        where: {
          sahibkar_id: sahibkarId,
          kontragent_id: opts.techizatci_id,
          nov: "techizatci",
          status: { not: "legv" },
          tarix: { gte: from, lte: to },
        },
        select: { id: true, nomre: true, tarix: true, geri_qaytarildi: true, sebeb: true, original_id: true },
        orderBy: { tarix: "asc" },
      }),
    ]);

    const rows: SupplierStatementRow[] = [];
    for (const p of purchases) {
      rows.push({
        tarix: p.tarix,
        nov: "alish",
        sened_nomresi: p.nomre,
        qaime_nomresi: p.qaime_nomre,
        tesvir: "Alış qaiməsi",
        debet: 0,
        kredit: Number(p.umumi_mebleg ?? 0),
        qaliq: 0,
        ref_id: p.id,
        ref_link: `/ticaret/alislar/${p.id}`,
      });
    }
    for (const o of payments) {
      rows.push({
        tarix: o.tarix,
        nov: "odenis",
        sened_nomresi: o.sened_nomresi ?? o.id.slice(0, 8),
        qaime_nomresi: null,
        tesvir: "Ödəniş",
        debet: Number(o.meblegh),
        kredit: 0,
        qaliq: 0,
        ref_id: o.alish_id,
        ref_link: o.alish_id ? `/ticaret/alislar/${o.alish_id}` : `/maliyye/emeliyyat`,
      });
    }
    for (const r of returns) {
      rows.push({
        tarix: r.tarix,
        nov: "qaytarma",
        sened_nomresi: r.nomre,
        qaime_nomresi: null,
        tesvir: r.sebeb ?? "Qaytarma",
        debet: Number(r.geri_qaytarildi ?? 0),
        kredit: 0,
        qaliq: 0,
        ref_id: r.original_id,
        ref_link: r.original_id ? `/ticaret/alislar/${r.original_id}` : `/ticaret/qaytarma`,
      });
    }

    rows.sort((x, y) => {
      const tx = new Date(x.tarix).getTime();
      const ty = new Date(y.tarix).getTime();
      if (tx !== ty) return tx - ty;
      const order: Record<string, number> = { alish: 0, qaytarma: 1, odenis: 2 };
      return (order[x.nov] ?? 9) - (order[y.nov] ?? 9);
    });

    let qaliq = baslangic;
    let cemiDebet = 0;
    let cemiKredit = 0;
    for (const r of rows) {
      qaliq += r.kredit - r.debet;
      r.qaliq = +qaliq.toFixed(2);
      cemiDebet += r.debet;
      cemiKredit += r.kredit;
    }

    return {
      techizatci_id: c.id,
      techizatci_ad: c.ad,
      telefon: c.telefon,
      email: c.email,
      voen: c.voen,
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
