import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { canSeeContactPII, maskContactPII } from "@/features/elaqe/mask-pii";

// TƏCHİZATÇI SCORECARD (satınalma kəşfiyyatı — müştəri RFM-in analoqu). getSupplierBreakdown yalnız
// xərc/sifariş/borc verir; bu isə QAYTARMA-DƏRƏCƏSİ + QİYMƏT-TRENDİ + kompozit qiymət (A-F) + seqment
// əlavə edir → "hansı təchizatçını strateji saxla / yenidən danış / dəyiş" qərarına kömək.

export type SupplierGrade = "A" | "B" | "C" | "D" | "F";
export type SupplierSegment = "strateji" | "etibarli" | "izle" | "gozden_kecir";

export type SupplierScore = {
  id: string;
  ad: string;
  sirket: string | null;
  xerc: number;            // dövr üzrə ümumi alış (non-legv)
  sifaris: number;         // sifariş sayı
  ortalama: number;        // orta sifariş
  borc: number;            // açıq borc (bizim ona)
  qaytarma_faiz: number;   // qaytarılan / xərc %
  qiymet_trend_faiz: number; // son 90g vs əvvəlki 90g orta vahid qiymət dəyişimi %
  recency_gun: number;     // son sifarişdən keçən gün
  bal: number;             // 0-100 kompozit
  qiymet_novu: SupplierGrade;
  segment: SupplierSegment;
};

export type SupplierScorecard = {
  suppliers: SupplierScore[];
  ozet: { say: number; strateji: number; izle: number; gozden_kecir: number; umumi_xerc: number };
};

function gradeOf(bal: number): SupplierGrade {
  if (bal >= 85) return "A";
  if (bal >= 70) return "B";
  if (bal >= 55) return "C";
  if (bal >= 40) return "D";
  return "F";
}

/** Bütün təchizatçılar üçün scorecard (son 12 ay). */
export async function getSupplierScorecard(limit = 200): Promise<SupplierScorecard> {
  return withTenant(async () => {
    const { sahibkarId, rolAd, icazeler } = requireTenant();
    const canSeePII = canSeeContactPII(rolAd, icazeler);
    const now = new Date();
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    // 1) Baza metriklər (son 12 ay alış)
    const base = await prisma.$queryRaw<Array<{ id: string; ad: string; sirket: string | null; xerc: number; sifaris: number; borc: number; son_sifaris: Date | null }>>`
      SELECT k.id::text AS id, k.ad, k.sirket_adi AS sirket,
             COALESCE(SUM(asi.umumi_mebleg), 0)::float AS xerc,
             COUNT(asi.id)::int AS sifaris,
             COALESCE(SUM(asi.umumi_mebleg - COALESCE(asi.odenilmis, 0)), 0)::float AS borc,
             MAX(asi.tarix) AS son_sifaris
        FROM kontragentler k
        JOIN alis_sifarisleri asi ON asi.techiazatci_id = k.id
             AND asi.sahibkar_id = ${sahibkarId}::uuid
             AND COALESCE(asi.status, '') != 'legv'
             AND asi.deleted_at IS NULL
             AND asi.tarix >= ${yearAgo}
       WHERE k.sahibkar_id = ${sahibkarId}::uuid
         AND k.nov IN ('techizatci','her_ikisi')
       GROUP BY k.id, k.ad, k.sirket_adi
       HAVING COUNT(asi.id) > 0
    `;
    if (base.length === 0) return { suppliers: [], ozet: { say: 0, strateji: 0, izle: 0, gozden_kecir: 0, umumi_xerc: 0 } };
    const ids = base.map((b) => b.id);

    // 2) Qaytarma (alis_qaytarma) təchizatçı üzrə
    const returns = await prisma.$queryRaw<Array<{ id: string; qaytarma: number }>>`
      SELECT q.kontragent_id::text AS id, COALESCE(SUM(q.umumi_mebleg), 0)::float AS qaytarma
        FROM qaytarma_sifarisleri q
       WHERE q.sahibkar_id = ${sahibkarId}::uuid
         AND q.nov = 'alis_qaytarma'
         AND q.status NOT IN ('legv','tesdiqlenmemis')
         AND q.tarix >= ${yearAgo}
         AND q.kontragent_id = ANY(${ids}::uuid[])
       GROUP BY q.kontragent_id
    `.catch(() => [] as Array<{ id: string; qaytarma: number }>);
    const retMap = new Map(returns.map((r) => [r.id, Number(r.qaytarma)]));

    // 3) Qiymət trendi — son 90g vs əvvəlki 90g orta vahid qiymət (təchizatçı üzrə)
    const d90 = new Date(now.getTime() - 90 * 86400000);
    const d180 = new Date(now.getTime() - 180 * 86400000);
    const trend = await prisma.$queryRaw<Array<{ id: string; recent: number; prior: number }>>`
      SELECT asi.techiazatci_id::text AS id,
             AVG(asl.vahid_qiymet) FILTER (WHERE asi.tarix >= ${d90})::float AS recent,
             AVG(asl.vahid_qiymet) FILTER (WHERE asi.tarix >= ${d180} AND asi.tarix < ${d90})::float AS prior
        FROM alis_sifaris_satirlari asl
        JOIN alis_sifarisleri asi ON asi.id = asl.sifaris_id
       WHERE asi.sahibkar_id = ${sahibkarId}::uuid
         AND COALESCE(asi.status, '') != 'legv' AND asi.deleted_at IS NULL
         AND asi.techiazatci_id = ANY(${ids}::uuid[])
         AND asi.tarix >= ${d180}
       GROUP BY asi.techiazatci_id
    `.catch(() => [] as Array<{ id: string; recent: number; prior: number }>);
    const trendMap = new Map(trend.map((t) => [t.id, { recent: Number(t.recent ?? 0), prior: Number(t.prior ?? 0) }]));

    // Xərc kvintili (bal üçün)
    const xercArr = base.map((b) => Number(b.xerc)).sort((a, b) => a - b);
    const xercPct = (v: number) => xercArr.length < 2 ? 0.5 : (xercArr.filter((x) => x < v).length / xercArr.length);

    const suppliers: SupplierScore[] = base.map((b) => {
      const xerc = Number(b.xerc);
      const sifaris = Number(b.sifaris);
      const qaytarma = retMap.get(b.id) ?? 0;
      const qaytarmaFaiz = xerc > 0 ? Math.round((qaytarma / xerc) * 1000) / 10 : 0;
      const tr = trendMap.get(b.id);
      const qiymetTrend = tr && tr.prior > 0 ? Math.round(((tr.recent - tr.prior) / tr.prior) * 1000) / 10 : 0;
      const recency = b.son_sifaris ? Math.floor((now.getTime() - new Date(b.son_sifaris).getTime()) / 86400000) : 9999;

      // Kompozit bal: xərc-mövqe (40%) + qaytarma-cəza (25%) + qiymət-sabitlik (20%) + yaxınlıq (15%)
      const xercBal = xercPct(xerc) * 40;
      const qaytarmaBal = Math.max(0, 25 - qaytarmaFaiz * 2.5); // 0% qaytarma→25, 10%→0
      const qiymetBal = qiymetTrend <= 0 ? 20 : Math.max(0, 20 - qiymetTrend); // qiymət artımı cəza
      const recencyBal = recency <= 30 ? 15 : recency <= 90 ? 10 : recency <= 180 ? 5 : 0;
      const bal = Math.round(xercBal + qaytarmaBal + qiymetBal + recencyBal);

      // Seqment
      let segment: SupplierSegment;
      if (xercPct(xerc) >= 0.66 && qaytarmaFaiz < 5 && qiymetTrend < 5) segment = "strateji";
      else if (recency > 180 || qaytarmaFaiz > 15) segment = "gozden_kecir";
      else if (qiymetTrend >= 10 || qaytarmaFaiz >= 5) segment = "izle";
      else segment = "etibarli";

      const masked = maskContactPII({ id: b.id, ad: b.ad, telefon: null }, canSeePII) as { ad: string };
      return {
        id: b.id, ad: masked.ad, sirket: b.sirket,
        xerc: Math.round(xerc * 100) / 100, sifaris,
        ortalama: sifaris > 0 ? Math.round((xerc / sifaris) * 100) / 100 : 0,
        borc: Math.round(Number(b.borc) * 100) / 100,
        qaytarma_faiz: qaytarmaFaiz, qiymet_trend_faiz: qiymetTrend, recency_gun: recency,
        bal, qiymet_novu: gradeOf(bal), segment,
      };
    });
    suppliers.sort((a, b) => b.bal - a.bal || b.xerc - a.xerc);

    const ozet = {
      say: suppliers.length,
      strateji: suppliers.filter((s) => s.segment === "strateji").length,
      izle: suppliers.filter((s) => s.segment === "izle").length,
      gozden_kecir: suppliers.filter((s) => s.segment === "gozden_kecir").length,
      umumi_xerc: Math.round(suppliers.reduce((a, s) => a + s.xerc, 0) * 100) / 100,
    };
    return { suppliers: suppliers.slice(0, limit), ozet };
  });
}
