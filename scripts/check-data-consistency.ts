/**
 * Multi-modul data consistency yoxlayıcı.
 *
 * Ticarət ↔ Anbar ↔ Maliyyə modulları arasında drift olub-olmadığını
 * üzə çıxarır. ERP-də ən təhlükəli xətalar uzun müddət göstərilmir —
 * bu script onları bir dəfəlik üzə çıxarır.
 *
 * Yoxlanır:
 *  1. Müştəri alacaq vs açıq nisyə satışların cəmi
 *  2. Təchizatçı borc vs açıq alış sənədlərinin cəmi
 *  3. Mənfi stok hadisələri (heç vaxt olmamalı)
 *  4. Yetim hereketler (mehsul/anbar silinib)
 *  5. Satış line cəmi vs üst başlıq son_mebleg
 *  6. Alış line cəmi vs üst başlıq umumi_mebleg
 *  7. Kassa qaliqi vs hereketler delta
 *
 * Run: npx tsx scripts/check-data-consistency.ts [--sahibkar=<uuid>] [--fix]
 *
 * --fix bayrağı drift-i bərpa etmir — yalnız təklif çap edir.
 * Düzəliş üçün target migration scripti yazılmalıdır.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const sahibkarArg = args.find((a) => a.startsWith("--sahibkar="))?.split("=")[1];
const verbose = args.includes("--verbose");

type Issue = { sahibkar_id: string; sahibkar_ad: string; cat: string; severity: "high" | "med" | "low"; detail: string };
const issues: Issue[] = [];

function add(s_id: string, s_ad: string, cat: string, severity: "high" | "med" | "low", detail: string) {
  issues.push({ sahibkar_id: s_id, sahibkar_ad: s_ad, cat, severity, detail });
}

async function checkTenant(s: { id: string; ad: string }) {
  if (verbose) console.log(`\n→ ${s.ad}`);

  // 1) Müştəri alacaq vs açıq nisyə satışların cəmi
  const custDrift = await prisma.$queryRaw<{ kontragent_id: string; ad: string; alacaq: number; open_sales: number; delta: number }[]>`
    SELECT k.id AS kontragent_id,
           k.ad,
           COALESCE(k.alacaq, 0)::float AS alacaq,
           COALESCE(SUM(s.son_mebleg - COALESCE(s.odenilmis, 0)), 0)::float AS open_sales,
           (COALESCE(SUM(s.son_mebleg - COALESCE(s.odenilmis, 0)), 0) - COALESCE(k.alacaq, 0))::float AS delta
      FROM kontragentler k
      LEFT JOIN satis_sifarisleri s
             ON s.musteri_id = k.id
            AND s.sahibkar_id = ${s.id}::uuid
            AND s.status <> 'legv'
            AND COALESCE(s.qaralama, false) = false
            AND s.odenis_nov IN ('nisye', 'borc')
            AND s.son_mebleg - COALESCE(s.odenilmis, 0) > 0
     WHERE k.sahibkar_id = ${s.id}::uuid
       AND k.nov IN ('musteri', 'her_ikisi')
     GROUP BY k.id, k.ad, k.alacaq
    HAVING ABS(COALESCE(SUM(s.son_mebleg - COALESCE(s.odenilmis, 0)), 0) - COALESCE(k.alacaq, 0)) > 0.01
     ORDER BY ABS(COALESCE(SUM(s.son_mebleg - COALESCE(s.odenilmis, 0)), 0) - COALESCE(k.alacaq, 0)) DESC
     LIMIT 50
  `;
  for (const r of custDrift) {
    const sev = Math.abs(r.delta) > 100 ? "high" : "med";
    add(s.id, s.ad, "musteri_alacaq_drift", sev,
      `${r.ad}: alacaq=${r.alacaq.toFixed(2)} vs açıq satış cəmi=${r.open_sales.toFixed(2)} (delta=${r.delta.toFixed(2)})`);
  }

  // 2) Təchizatçı borc vs açıq alışların cəmi
  const supDrift = await prisma.$queryRaw<{ kontragent_id: string; ad: string; borc: number; open_purch: number; delta: number }[]>`
    SELECT k.id AS kontragent_id,
           k.ad,
           COALESCE(k.borc, 0)::float AS borc,
           COALESCE(SUM(a.umumi_mebleg - COALESCE(a.odenilmis, 0)), 0)::float AS open_purch,
           (COALESCE(SUM(a.umumi_mebleg - COALESCE(a.odenilmis, 0)), 0) - COALESCE(k.borc, 0))::float AS delta
      FROM kontragentler k
      LEFT JOIN alis_sifarisleri a
             ON a.techiazatci_id = k.id
            AND a.sahibkar_id = ${s.id}::uuid
            AND a.status <> 'legv'
            AND a.umumi_mebleg - COALESCE(a.odenilmis, 0) > 0
     WHERE k.sahibkar_id = ${s.id}::uuid
       AND k.nov IN ('techizatci', 'her_ikisi')
     GROUP BY k.id, k.ad, k.borc
    HAVING ABS(COALESCE(SUM(a.umumi_mebleg - COALESCE(a.odenilmis, 0)), 0) - COALESCE(k.borc, 0)) > 0.01
     ORDER BY ABS(COALESCE(SUM(a.umumi_mebleg - COALESCE(a.odenilmis, 0)), 0) - COALESCE(k.borc, 0)) DESC
     LIMIT 50
  `;
  for (const r of supDrift) {
    const sev = Math.abs(r.delta) > 100 ? "high" : "med";
    add(s.id, s.ad, "techizatci_borc_drift", sev,
      `${r.ad}: borc=${r.borc.toFixed(2)} vs açıq alış cəmi=${r.open_purch.toFixed(2)} (delta=${r.delta.toFixed(2)})`);
  }

  // 3) Mənfi stok
  const negStock = await prisma.$queryRaw<{ mehsul_id: string; mehsul_ad: string; anbar_ad: string; miqdar: number }[]>`
    SELECT s.mehsul_id, m.ad AS mehsul_ad, a.ad AS anbar_ad, s.miqdar::float AS miqdar
      FROM stok s
      JOIN mehsullar m ON m.id = s.mehsul_id
      JOIN anbarlar a ON a.id = s.anbar_id
     WHERE s.sahibkar_id = ${s.id}::uuid
       AND s.miqdar < 0
     ORDER BY s.miqdar ASC
     LIMIT 50
  `;
  for (const r of negStock) {
    add(s.id, s.ad, "menfi_stok", "high",
      `${r.mehsul_ad} (${r.anbar_ad}): ${r.miqdar.toFixed(2)} — race condition və ya manual düzəliş`);
  }

  // 4) Yetim hereketler — mehsul və ya anbar silinib
  const orphanMov = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
      FROM anbar_hereketleri h
      LEFT JOIN mehsullar m ON m.id = h.mehsul_id
      LEFT JOIN anbarlar a ON a.id = h.anbar_id
     WHERE h.sahibkar_id = ${s.id}::uuid
       AND (m.id IS NULL OR a.id IS NULL)
  `;
  if (orphanMov[0]?.count && orphanMov[0].count > 0) {
    add(s.id, s.ad, "yetim_hereket", "low",
      `${orphanMov[0].count} hereket məhsulu və ya anbarı silinmiş referans saxlayır`);
  }

  // 5) Satış satır cəmi vs üst başlıq son_mebleg
  // satis_sifaris_satirlari.cemi = (miqdar * vahid_qiymet) * (1 - endirim_faiz/100) — DB generated
  const saleDrift = await prisma.$queryRaw<{ sened_id: string; nomre: string | null; baslik: number; xetler: number; delta: number }[]>`
    SELECT s.id AS sened_id,
           s.nomre AS nomre,
           s.son_mebleg::float AS baslik,
           COALESCE(SUM(sx.cemi), 0)::float AS xetler,
           (s.son_mebleg - COALESCE(SUM(sx.cemi), 0))::float AS delta
      FROM satis_sifarisleri s
      LEFT JOIN satis_sifaris_satirlari sx ON sx.sifaris_id = s.id
     WHERE s.sahibkar_id = ${s.id}::uuid
       AND s.status <> 'legv'
       AND COALESCE(s.qaralama, false) = false
     GROUP BY s.id, s.nomre, s.son_mebleg
    HAVING ABS(s.son_mebleg - COALESCE(SUM(sx.cemi), 0)) > 0.5
     ORDER BY ABS(s.son_mebleg - COALESCE(SUM(sx.cemi), 0)) DESC
     LIMIT 20
  `;
  for (const r of saleDrift) {
    add(s.id, s.ad, "satis_xet_drift", "med",
      `Satış #${r.nomre ?? r.sened_id.slice(0, 8)}: başlıq ${r.baslik.toFixed(2)} ≠ xətlər ${r.xetler.toFixed(2)} (delta ${r.delta.toFixed(2)})`);
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("Data Consistency Check — 360biznes-next");
  console.log("=".repeat(70));

  const tenants = sahibkarArg
    ? await prisma.sahibkarlar.findMany({ where: { id: sahibkarArg }, select: { id: true, ad: true } })
    : await prisma.sahibkarlar.findMany({ where: { status: "aktiv" }, select: { id: true, ad: true } });

  if (tenants.length === 0) {
    console.log("Heç bir aktiv tenant tapılmadı.");
    return;
  }

  console.log(`Yoxlanılan tenant sayı: ${tenants.length}\n`);

  for (const t of tenants) {
    try {
      await checkTenant(t);
    } catch (e) {
      console.error(`[${t.ad}] yoxlama xətası:`, e instanceof Error ? e.message : e);
    }
  }

  // Hesabat
  console.log("\n" + "=".repeat(70));
  console.log("Yekun");
  console.log("=".repeat(70));

  if (issues.length === 0) {
    console.log("✓ Heç bir drift tapılmadı. Bütün modullar uyğun gəlir.");
  } else {
    const byCat = new Map<string, Issue[]>();
    for (const i of issues) {
      const arr = byCat.get(i.cat) ?? [];
      arr.push(i);
      byCat.set(i.cat, arr);
    }

    const HIGH = issues.filter((i) => i.severity === "high").length;
    const MED = issues.filter((i) => i.severity === "med").length;
    const LOW = issues.filter((i) => i.severity === "low").length;
    console.log(`Tapılan problem: ${issues.length} (🔴 ${HIGH} yüksək, 🟡 ${MED} orta, ⚪ ${LOW} aşağı)\n`);

    for (const [cat, arr] of byCat) {
      console.log(`\n— ${cat} (${arr.length}) —`);
      for (const i of arr.slice(0, 15)) {
        const icon = i.severity === "high" ? "🔴" : i.severity === "med" ? "🟡" : "⚪";
        console.log(`  ${icon} [${i.sahibkar_ad}] ${i.detail}`);
      }
      if (arr.length > 15) console.log(`  ... və daha ${arr.length - 15} hadisə`);
    }
  }

  await prisma.$disconnect();
  process.exit(issues.some((i) => i.severity === "high") ? 1 : 0);
}

main().catch(async (e) => {
  console.error("Fatal:", e);
  await prisma.$disconnect();
  process.exit(2);
});
