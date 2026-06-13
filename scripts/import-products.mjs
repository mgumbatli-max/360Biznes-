/**
 * Məhsullar.xlsx → sistemə tam import (şəkillərlə, 1-1).
 *
 * İSTİFADƏ:
 *   DRY-RUN (DB/Blob yox, yalnız parse + xəritələmə yoxlaması — TƏHLÜKƏSİZ):
 *     node --max-old-space-size=4096 scripts/import-products.mjs --dry-run [fayl.xlsx] [sahibkar_id]
 *
 *   CANLI (prod-a yazır — DATABASE_URL + BLOB_READ_WRITE_TOKEN env tələb edir):
 *     DATABASE_URL="postgres://...PROD..." \
 *     BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..." \
 *     node --max-old-space-size=4096 scripts/import-products.mjs --live Məhsullar.xlsx <SAHIBKAR_ID>
 *
 * Sütunlar (Məhsullar.xlsx, başlıq sətri 4):
 *   № | Kataloq | Alt kataloq | Şəkil | Marka | Məhsul adı | Cəmi say | Qiymət | Partnyor | Topdan | Vip 1 | Maya dəyəri (son)
 *
 * Xəritələmə (mehsullar):
 *   Məhsul adı→ad · Qiymət→satis_qiymeti · Maya→alish_qiymeti · Topdan→topdan_qiymeti
 *   Partnyor→partnyor_qiymeti · Vip 1→vip_qiymeti · Marka→marka+marka_id
 *   Alt kataloq (yoxdursa Kataloq)→kateqoriya_id · Cəmi say→ilkin stok · Şəkil→Blob→sekil_url
 *   kod = "XL-<№>" (idempotentlik + təkrar-run üçün; dedupe sahibkar_id+kod)
 *
 * İDEMPOTENT: kod üzrə mövcud məhsul tapılarsa update, yoxsa create. Şəkil artıq
 * yüklənibsə (manifest) təkrar yüklənmir. Təhlükəsiz təkrar işlədilə bilər.
 */
import ExcelJS from "exceljs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const LIVE = args.includes("--live");
const DRY = !LIVE; // default dry-run
const positional = args.filter((a) => !a.startsWith("--"));
const SRC = positional[0] || "Məhsullar.xlsx";
const SAHIBKAR_ID = positional[1] || process.env.SAHIBKAR_ID || null;
const MANIFEST = "/tmp/mehsul-import-manifest.json"; // row → {blobUrl, mehsulId}

const num = (v) => {
  if (v == null || v === "") return 0;
  const n = Number(typeof v === "object" && "result" in v ? v.result : v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v) => {
  if (v == null) return null;
  const s = String(typeof v === "object" && "result" in v ? v.result : v).trim();
  return s === "" || s === "-" ? null : s;
};

// ---- 1. Parse + şəkil çıxarma ----
console.log(`[${DRY ? "DRY-RUN" : "CANLI"}] Mənbə: ${SRC}`);
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(SRC);
const ws = wb.worksheets[0];
let headerRow = 4;
for (let r = 1; r <= 8; r++) {
  const vals = (ws.getRow(r).values || []).map((v) => String(v ?? "").toLowerCase());
  if (vals.some((v) => v.includes("məhsul adı") || v.includes("mehsul adi"))) { headerRow = r; break; }
}
const images = ws.getImages();
const rowToImg = new Map();
for (const img of images) {
  const rowNum = (img.range?.tl?.nativeRow ?? 0) + 1;
  if (!rowToImg.has(rowNum)) rowToImg.set(rowNum, img.imageId);
}

const rows = [];
for (let r = headerRow + 1; r <= ws.rowCount; r++) {
  const row = ws.getRow(r);
  const c = (n) => row.getCell(n).value;
  const ad = str(c(6));
  if (!ad) continue;
  const imgId = rowToImg.get(r);
  let imgBuf = null, imgExt = "jpeg";
  if (imgId != null) {
    const media = wb.model.media.find((m) => String(m.index) === String(imgId));
    if (media?.buffer) { imgBuf = media.buffer; imgExt = media.extension || "jpeg"; }
  }
  rows.push({
    row: r, no: num(c(1)),
    kataloq: str(c(2)), alt_kataloq: str(c(3)), marka: str(c(5)), ad,
    cemi_say: num(c(7)), qiymet: num(c(8)), partnyor: num(c(9)),
    topdan: num(c(10)), vip1: num(c(11)), maya: num(c(12)),
    imgBuf, imgExt,
  });
}
console.log(`Parse: ${rows.length} məhsul, ${rows.filter((x) => x.imgBuf).length} şəkilli`);

// kateqoriya/marka unikal yoxlaması (dry-run dəyəri)
const cats = new Set(), brands = new Set();
for (const r of rows) { const cat = r.alt_kataloq || r.kataloq; if (cat) cats.add(cat); if (r.marka) brands.add(r.marka); }
console.log(`Unikal kateqoriya: ${cats.size}, unikal marka: ${brands.size}`);

if (DRY) {
  // Yalnız hesabla, heç nə yazma. İlk/son nümunələri göstər.
  const sample = rows.slice(0, 3).map((r) => ({
    kod: `XL-${r.no}`, ad: r.ad, kateqoriya: r.alt_kataloq || r.kataloq, marka: r.marka,
    satis: r.qiymet, alish: r.maya, topdan: r.topdan, partnyor: r.partnyor, vip: r.vip1,
    stok: r.cemi_say, sekil: r.imgBuf ? `(${(r.imgBuf.length / 1024).toFixed(0)}KB ${r.imgExt})` : null,
  }));
  console.log("DRY-RUN nümunə yazılacaq qeydlər:");
  for (const s of sample) console.log("  ", JSON.stringify(s));
  console.log(`\n✅ DRY-RUN OK. Canlı import üçün: --live + DATABASE_URL + BLOB_READ_WRITE_TOKEN + sahibkar_id`);
  process.exit(0);
}

// ---- 2. CANLI import ----
if (!SAHIBKAR_ID) { console.error("XƏTA: sahibkar_id tələb olunur (2-ci arqument və ya SAHIBKAR_ID env)"); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("XƏTA: DATABASE_URL env yoxdur"); process.exit(1); }
const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
if (!hasBlob) console.warn("XƏBƏRDARLIQ: BLOB_READ_WRITE_TOKEN yoxdur → şəkillər yüklənməyəcək (yalnız data).");

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
let blobPut = null;
if (hasBlob) ({ put: blobPut } = await import("@vercel/blob"));

// manifest (resume) yüklə
let manifest = {};
if (existsSync(MANIFEST)) { try { manifest = JSON.parse(await readFile(MANIFEST, "utf8")); } catch {} }

// default anbar + mövcud kateqoriya/marka
const defaultAnbar = await prisma.anbarlar.findFirst({ where: { sahibkar_id: SAHIBKAR_ID, aktiv: true }, orderBy: { id: "asc" } });
const [allCats, allBrands] = await Promise.all([
  prisma.kateqoriyalar.findMany({ where: { sahibkar_id: SAHIBKAR_ID }, select: { id: true, ad: true } }),
  prisma.markalar.findMany({ where: { sahibkar_id: SAHIBKAR_ID }, select: { id: true, ad: true } }),
]);
const catMap = new Map(allCats.map((c) => [c.ad.toLowerCase(), c.id]));
const brandMap = new Map(allBrands.map((b) => [b.ad.toLowerCase(), b.id]));
async function resolveCategory(name) {
  if (!name) return undefined;
  const f = catMap.get(name.toLowerCase()); if (f) return f;
  const created = await prisma.kateqoriyalar.create({ data: { sahibkar_id: SAHIBKAR_ID, ad: name } });
  catMap.set(name.toLowerCase(), created.id); return created.id;
}
async function resolveBrand(name) {
  if (!name) return undefined;
  const f = brandMap.get(name.toLowerCase()); if (f) return f;
  const created = await prisma.markalar.create({ data: { sahibkar_id: SAHIBKAR_ID, ad: name, aktiv: true } });
  brandMap.set(name.toLowerCase(), created.id); return created.id;
}

let yarat = 0, yenile = 0, xeta = 0, imgUp = 0;
for (const r of rows) {
  try {
    const kod = `XL-${r.no}`;
    const m = manifest[r.row] || {};
    // şəkil yüklə (manifest-də yoxdursa)
    let sekilUrl = m.blobUrl || null;
    if (!sekilUrl && r.imgBuf && blobPut) {
      const key = `mehsul/import/${SAHIBKAR_ID}/${kod}.${r.imgExt === "png" ? "png" : "jpg"}`;
      const blob = await blobPut(key, r.imgBuf, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: r.imgExt === "png" ? "image/png" : "image/jpeg" });
      sekilUrl = blob.url; imgUp++;
    }
    const kateqoriya_id = await resolveCategory(r.alt_kataloq || r.kataloq);
    const marka_id = await resolveBrand(r.marka);
    const data = {
      ad: r.ad, kod, marka: r.marka, marka_id, kateqoriya_id,
      satis_qiymeti: r.qiymet, alish_qiymeti: r.maya,
      topdan_qiymeti: r.topdan || undefined, partnyor_qiymeti: r.partnyor || undefined, vip_qiymeti: r.vip1 || undefined,
      aktiv: true, ...(sekilUrl ? { sekil_url: sekilUrl } : {}),
    };
    const existing = await prisma.mehsullar.findFirst({ where: { sahibkar_id: SAHIBKAR_ID, kod } });
    let mehsulId;
    if (existing) { await prisma.mehsullar.update({ where: { id: existing.id }, data }); mehsulId = existing.id; yenile++; }
    else { const cre = await prisma.mehsullar.create({ data: { ...data, sahibkar_id: SAHIBKAR_ID }, select: { id: true } }); mehsulId = cre.id; yarat++; }

    // ilkin stok
    if (defaultAnbar && r.cemi_say > 0) {
      const es = await prisma.stok.findFirst({ where: { mehsul_id: mehsulId, anbar_id: defaultAnbar.id } });
      if (es) await prisma.stok.update({ where: { id: es.id }, data: { miqdar: r.cemi_say, son_qiymet: r.maya } });
      else await prisma.stok.create({ data: { sahibkar_id: SAHIBKAR_ID, mehsul_id: mehsulId, anbar_id: defaultAnbar.id, miqdar: r.cemi_say, son_qiymet: r.maya } });
    }
    manifest[r.row] = { blobUrl: sekilUrl, mehsulId };
    if ((yarat + yenile) % 100 === 0) { await writeFile(MANIFEST, JSON.stringify(manifest)); console.log(`  ...${yarat + yenile}/${rows.length} (şəkil: ${imgUp})`); }
  } catch (e) { xeta++; console.error(`  XƏTA row ${r.row} (${r.ad}):`, e.message); }
}
await writeFile(MANIFEST, JSON.stringify(manifest));
await prisma.$disconnect();
console.log(`\n✅ BİTDİ: yaradıldı=${yarat}, yeniləndi=${yenile}, xəta=${xeta}, şəkil yükləndi=${imgUp}`);
