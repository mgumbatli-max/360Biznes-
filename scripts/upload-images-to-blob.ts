/**
 * Lokal şəkilləri Vercel Blob-a paralel yükləyir + mehsullar.sekil_url
 * sütununu incremental yeniləyir (resume-safe — yenidən işlədərsən
 * artıq Blob-da olanları atlayar).
 *
 * İcra:
 *   DATABASE_URL='...' BLOB_READ_WRITE_TOKEN='...' npx tsx scripts/upload-images-to-blob.ts
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { put } from "@vercel/blob";
import { Client } from "pg";

const LOCAL_DIR = "/Users/mr.maqa/projects/360biznes/uploads/mehsul";
const CONCURRENCY = 32;
const BLOB_URL_RE = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//;

function log(msg: string) {
  process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${msg}\n`);
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN gərəkdir");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL gərəkdir");

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  // 1. DB-də hələ Blob URL-i olmayan məhsullar — yalnız bunlar üçün iş gör
  const { rows: dbRows } = await pg.query<{ id: string; sekil_url: string }>(
    `SELECT id, sekil_url FROM mehsullar
     WHERE sekil_url IS NOT NULL AND sekil_url != ''
       AND sekil_url NOT LIKE 'https://%blob.vercel-storage.com/%'`
  );
  log(`DB-də yenilənməli məhsul: ${dbRows.length}`);

  // filename → mehsul.id[] (eyni fayl bir neçə məhsulda istifadə oluna bilər)
  const urlToIds = new Map<string, string[]>();
  for (const r of dbRows) {
    const fname = basename(r.sekil_url);
    if (!urlToIds.has(fname)) urlToIds.set(fname, []);
    urlToIds.get(fname)!.push(r.id);
  }
  log(`Unikal fayl adı: ${urlToIds.size}`);

  // 2. Disk-də mövcud şəkilləri yığ
  const allFiles = await readdir(LOCAL_DIR);
  const diskSet = new Set(allFiles.filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f)));
  log(`Disk-də şəkil: ${diskSet.size}`);

  // 3. Yalnız (DB-də əskik) ∩ (disk-də mövcud) qəyrəsi
  const toUpload = [...urlToIds.keys()].filter((f) => diskSet.has(f));
  log(`Yüklənəcək: ${toUpload.length}`);

  let done = 0;
  let okCnt = 0;
  let failCnt = 0;
  let dbUpdated = 0;
  const startedAt = Date.now();

  async function processOne(fname: string) {
    try {
      const data = await readFile(resolve(LOCAL_DIR, fname));
      const blob = await put(fname, data, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: fname.endsWith(".png") ? "image/png"
                    : fname.endsWith(".webp") ? "image/webp"
                    : fname.endsWith(".gif") ? "image/gif"
                    : "image/jpeg",
      });
      // Dərhal DB-də yenilə — resume-safe
      const ids = urlToIds.get(fname)!;
      const res = await pg.query(
        `UPDATE mehsullar SET sekil_url = $1 WHERE id = ANY($2::uuid[])`,
        [blob.url, ids]
      );
      dbUpdated += res.rowCount ?? 0;
      okCnt++;
    } catch (e) {
      failCnt++;
      log(`  XƏTA ${fname}: ${(e as Error).message}`);
    } finally {
      done++;
      if (done % 100 === 0 || done === toUpload.length) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = done / elapsed;
        const eta = (toUpload.length - done) / rate;
        log(`  ${done}/${toUpload.length} (ok=${okCnt} fail=${failCnt} db=${dbUpdated}) — ${rate.toFixed(1)}/s, ETA ${Math.round(eta)}s`);
      }
    }
  }

  // Worker pool — CONCURRENCY paralel
  let cursor = 0;
  async function worker() {
    while (cursor < toUpload.length) {
      const i = cursor++;
      await processOne(toUpload[i]!);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // Disk-də olmayan əskik fayllar
  const missing = [...urlToIds.keys()].filter((f) => !diskSet.has(f));
  if (missing.length > 0) {
    log(`⚠ Disk-də olmayan ${missing.length} fayl — DB-də sekil_url-i NULL edirəm`);
    const allMissingFiles = missing.map((f) => `/uploads/mehsul/${f}`);
    const res = await pg.query(
      `UPDATE mehsullar SET sekil_url = NULL WHERE sekil_url = ANY($1::text[])`,
      [allMissingFiles]
    );
    log(`  Təmizləndi: ${res.rowCount} sətir`);
  }

  await pg.end();
  log(`✓ Bitdi. ok=${okCnt} fail=${failCnt} db_updated=${dbUpdated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
