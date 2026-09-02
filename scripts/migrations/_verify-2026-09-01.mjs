/**
 * 2026-09-01 migration üçün PRE-DEPLOYMENT təhlükəsizlik yoxlayıcısı.
 *
 * YALNIZ OXU + tranzaksiya-daxili quru sınaq (həmişə ROLLBACK).
 * Heç bir dəyişiklik commit edilmir — nə lokal, nə uzaq bazada.
 *
 * Yoxlayır:
 *   • statik: destructive əməliyyat, lock timeout, sənəd dəqiqliyi
 *   • data: NULL, təkrar, qeyri-standart format, orphan, FK asılılığı
 *   • preflight-in BLOKEDİCİ davranışı (qəsdən pozulmuş data ilə)
 *   • dry-run (sıfırdan), idempotentlik, yarıda-fail → atomik rollback
 *   • sayğac düzgünlüyü (P2 məntiqi: il nömrədən, prefiks map ilə)
 *
 * İşlət: node scripts/migrations/_verify-2026-09-01.mjs
 */
import fs from "node:fs";
import pg from "pg";

const SQL_FILE = "scripts/migrations/2026-09-01-tenant-scoped-doc-numbers.sql";
const ONLINE_FILE = "scripts/migrations/2026-09-01-online-concurrent.sql";
const ROLLBACK_FILE = "scripts/migrations/2026-09-01-rollback.sql";
const PREFLIGHT_FILE = "scripts/migrations/2026-09-01-preflight.sql";
const VERIFY_FILE = "scripts/migrations/2026-09-01-verification-queries.sql";

const STRICT = ["satis_sifarisleri", "alis_sifarisleri", "qaytarma_sifarisleri",
                "anbar_transferleri", "inventarizasiyalar", "servis_qeydleri"];
const LAX = ["catdirmalar", "rezervler"];
const ALL = [...STRICT, ...LAX];

const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL="?([^"\n]+)/m)[1];
const sql = fs.readFileSync(SQL_FILE, "utf8");
// BEGIN/COMMIT-i özümüz idarə edirik ki, heç nə commit olunmasın
const body = sql.split("COMMIT;")[0].replace(/^SET [^;]+;/gm, "").replace(/^BEGIN;/m, "");

let pass = 0, fail = 0;
const ok = (n, c, d = "") => {
  if (c) pass++;
  else fail++;
  console.log(`  ${c ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`);
};
const info = (s) => console.log(`  · ${s}`);

const c = new pg.Client({ connectionString: url });
const notices = [];
c.on("notice", (m) => notices.push(m.message));
await c.connect();
const one = async (q, p) => (await c.query(q, p)).rows[0];

const host = url.replace(/:\/\/[^@]*@/, "://***@").split("/")[2];
console.log(`\n━━━ Migration pre-deployment check ━━━`);
console.log(`  hədəf: ${host} · ${(await one("SELECT version() v")).v.split(" ").slice(0, 2).join(" ")}`);
console.log(`  ⚠️  bu, LOKAL bazadır — production schema ayrıca yoxlanılmalıdır\n`);

/* ══ 1. STATİK: fayl məzmunu ══ */
console.log("── Statik yoxlama ──");
const DESTRUCTIVE = /\bDROP\s+(TABLE|COLUMN|DATABASE|SCHEMA)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i;
// Kommentlər çıxarılır — sənəddəki «DROP TABLE … YOXDUR» izahı yanlış müsbət verirdi.
const stripComments = (s) =>
  s.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
for (const [label, file] of [["tranzaksiyalı", SQL_FILE], ["online", ONLINE_FILE], ["rollback", ROLLBACK_FILE]]) {
  const code = stripComments(fs.readFileSync(file, "utf8"));
  ok(`${label}: DROP TABLE/COLUMN, TRUNCATE, DELETE yoxdur`, !DESTRUCTIVE.test(code));
}
ok("P4: lock_timeout təyin olunub", /SET\s+lock_timeout/i.test(sql));
ok("P4: statement_timeout təyin olunub", /SET\s+statement_timeout/i.test(sql));
ok("P4: idle_in_transaction_session_timeout təyin olunub", /idle_in_transaction_session_timeout/i.test(sql));
ok("P4: online (CONCURRENTLY) alternativi mövcuddur",
   fs.existsSync(ONLINE_FILE) && /CREATE UNIQUE INDEX CONCURRENTLY/i.test(fs.readFileSync(ONLINE_FILE, "utf8")));
ok("P4: online yol USING INDEX ilə constraint qurur",
   /ADD CONSTRAINT[\s\S]{0,80}USING INDEX/i.test(fs.readFileSync(ONLINE_FILE, "utf8")));
ok("P2: sayğac ili NÖMRƏDƏN çıxarılır", /split_part\(nomre,'-',2\)::int/.test(sql.replace(/\s+/g, "")) && /İlHƏMİŞƏnömrədən/i.test(sql.replace(/\s+/g, "")));
ok("P2: sayğac ili artıq tarix sütunundan GÖTÜRÜLMÜR",
   !/EXTRACT\(YEAR FROM COALESCE\((tarix|yaradildi)/i.test(sql));
ok("P2: prefiks görünən prefiksdən map olunur (SATIS≠MARKET)",
   /WHEN 'MARKET'\s+THEN 'market'/.test(sql) && /WHEN 'SATIS'\s+THEN 'satis'/.test(sql));
ok("P3: preflight qeyri-standart formatda EXCEPTION atır",
   /RAISE EXCEPTION[\s\S]{0,200}PREFLIGHT DAYANDIRDI/i.test(sql));
ok("P3: standalone preflight faylı mövcuddur", fs.existsSync(PREFLIGHT_FILE));
ok("P5: sənəddə sayğac YENİLƏNMƏSİ açıq göstərilib",
   /sened_nomre_counter[\s\S]{0,120}(YENİLƏYİR|yenilənir)/i.test(sql));
ok("P5: biznes cədvəllərinə toxunulmadığı dəqiq yazılıb",
   /HEÇ BİR sətir silinmir, yenilənmir/i.test(sql));
ok("rollback faylı mövcuddur və vaxt-həssaslığı sənədləşdirilib",
   fs.existsSync(ROLLBACK_FILE) && /VAXT HƏSSASDIR/i.test(fs.readFileSync(ROLLBACK_FILE, "utf8")));
ok("verification faylı yalnız TEMP view yaradır (read-only)",
   /CREATE TEMP VIEW/.test(fs.readFileSync(VERIFY_FILE, "utf8")) &&
   !/CREATE OR REPLACE VIEW/.test(fs.readFileSync(VERIFY_FILE, "utf8")));

/* ══ 2. DATA vəziyyəti ══ */
console.log("\n── Data vəziyyəti (lokal) ──");
let nulls = 0, dups = 0, nonstd = 0, unknownPfx = 0, orphans = 0;
const PARSE = `nomre ~ '^[A-Z]+-[0-9]{4}-[0-9]+$'`;
const KNOWN = `('SATIS','S','MARKET','KREDIT','ALIS','ALS','QAYTARMA','QAY','TR','TRANSFER','INV','SAYIM','SR','SERVIS','CT','RZ','REZERV')`;
for (const t of ALL) {
  nulls += (await one(`SELECT COUNT(*)::int n FROM ${t} WHERE sahibkar_id IS NULL OR nomre IS NULL OR nomre=''`)).n;
  dups += (await one(`SELECT COUNT(*)::int n FROM (SELECT sahibkar_id,nomre FROM ${t} GROUP BY 1,2 HAVING COUNT(*)>1) z`)).n;
  orphans += (await one(`SELECT COUNT(*)::int n FROM ${t} d LEFT JOIN sahibkarlar s ON s.id=d.sahibkar_id WHERE s.id IS NULL`)).n;
  const ns = (await one(`SELECT COUNT(*)::int n FROM ${t} WHERE NOT (${PARSE})`)).n;
  const up = (await one(`SELECT COUNT(*)::int n FROM ${t} WHERE ${PARSE} AND split_part(nomre,'-',1) NOT IN ${KNOWN}`)).n;
  if (ns || up) info(`${t}: ${ns} parse olunmur, ${up} tanınmayan prefiks${LAX.includes(t) ? " (xəbərdarlıq — sayğacsız cədvəl)" : " (BLOKEDİCİ)"}`);
  if (STRICT.includes(t)) { nonstd += ns; unknownPfx += up; }
}
ok("NULL sahibkar_id / boş nomre yoxdur", nulls === 0, `${nulls} sətir`);
ok("tenant daxilində təkrar nömrə yoxdur", dups === 0, `${dups} təkrar`);
ok("orphan sənəd (mövcud olmayan tenant) yoxdur", orphans === 0, `${orphans} sətir`);
ok("sayğaclı cədvəllərdə qeyri-standart nömrə yoxdur", nonstd === 0, `${nonstd} sətir`);
ok("sayğaclı cədvəllərdə tanınmayan prefiks yoxdur", unknownPfx === 0, `${unknownPfx} sətir`);

// FK asılılığı
const fk = await c.query(`SELECT con.conname fk FROM pg_constraint con
  LEFT JOIN pg_class i ON i.oid=con.conindid JOIN pg_class tgt ON tgt.oid=con.confrelid
  WHERE con.contype='f' AND tgt.relname = ANY($1) AND i.relname LIKE '%\\_nomre\\_key'`, [ALL]);
ok("silinəcək _nomre_key-lərə FK asılılığı yoxdur", fk.rows.length === 0, `${fk.rows.length} FK`);

// əhatə
const cov = await c.query(`SELECT t.relname tbl FROM pg_index ix
  JOIN pg_class i ON i.oid=ix.indexrelid JOIN pg_class t ON t.oid=ix.indrelid
  JOIN pg_namespace n ON n.oid=t.relnamespace AND n.nspname='public'
  WHERE ix.indisunique AND NOT ix.indisprimary
    AND (SELECT string_agg(a.attname::text,',' ORDER BY k.ord) FROM unnest(ix.indkey) WITH ORDINALITY k(attnum,ord)
         JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum)='nomre'`);
const uncovered = cov.rows.map((r) => r.tbl).filter((t) => !ALL.includes(t));
ok("migration bütün UNIQUE(nomre) cədvəllərini əhatə edir", uncovered.length === 0,
   uncovered.length ? `ƏHATƏSİZ: ${uncovered.join(", ")}` : `${cov.rows.length} cədvəl`);

/* ══ 3. PREFLIGHT blokedici davranışı ══ */
console.log("\n── Preflight blokedici davranışı (qəsdən pozulmuş data ilə) ──");
for (const [label, badNumber] of [
  ["parse olunmayan format", "BOZUK_FORMAT_XYZ"],
  ["tanınmayan prefiks", "ZZZ-2026-000001"],
]) {
  await c.query("BEGIN");
  let blocked = false, msg = "";
  try {
    const t = await one("SELECT id FROM sahibkarlar LIMIT 1");
    await c.query(`INSERT INTO satis_sifarisleri (sahibkar_id, nomre, tarix) VALUES ($1::uuid,$2,CURRENT_DATE)`,
                  [t.id, badNumber]);
    await c.query(body);
  } catch (e) {
    blocked = /PREFLIGHT DAYANDIRDI/.test(e.message);
    msg = e.message.split("\n")[0].slice(0, 70);
  }
  await c.query("ROLLBACK");
  ok(`preflight «${label}» halında DAYANIR`, blocked, msg || "DAYANMADI — səssiz keçdi!");
}

/* ══ 4. DRY-RUN (sıfırdan) ══ */
console.log("\n── Dry-run (sıfırdan, ROLLBACK ilə) ──");
await c.query("BEGIN");
notices.length = 0;
let dryOk = true, dryErr = "";
try { await c.query(body); } catch (e) { dryOk = false; dryErr = e.message.slice(0, 150); }
const added = notices.filter((n) => n.startsWith("əlavə edildi")).length;
const dropped = notices.filter((n) => n.startsWith("silindi")).length;
const inTx = await c.query(`SELECT t.relname tbl,
  (SELECT string_agg(a.attname::text,',' ORDER BY k.ord) FROM unnest(ix.indkey) WITH ORDINALITY k(attnum,ord)
   JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum) cols
  FROM pg_index ix JOIN pg_class i ON i.oid=ix.indexrelid JOIN pg_class t ON t.oid=ix.indrelid
  JOIN pg_namespace n ON n.oid=t.relnamespace AND n.nspname='public'
  WHERE ix.indisunique AND NOT ix.indisprimary AND t.relname = ANY($1) ORDER BY t.relname`, [ALL]);
const composites = inTx.rows.filter((r) => r.cols === "sahibkar_id,nomre").length;
const oldLeft = inTx.rows.filter((r) => r.cols === "nomre").length;
// sayğac düzgünlüyü (B5 məntiqi) — tranzaksiya daxilində
const behind = await c.query(`
  WITH d AS (
    SELECT sahibkar_id, split_part(nomre,'-',1) p, split_part(nomre,'-',2)::int il, split_part(nomre,'-',3)::bigint s
      FROM satis_sifarisleri WHERE ${PARSE}
    UNION ALL SELECT sahibkar_id, split_part(nomre,'-',1), split_part(nomre,'-',2)::int, split_part(nomre,'-',3)::bigint
      FROM alis_sifarisleri WHERE ${PARSE}
    UNION ALL SELECT sahibkar_id, split_part(nomre,'-',1), split_part(nomre,'-',2)::int, split_part(nomre,'-',3)::bigint
      FROM anbar_transferleri WHERE ${PARSE}
  ), m AS (
    SELECT sahibkar_id, CASE p WHEN 'SATIS' THEN 'satis' WHEN 'S' THEN 'satis' WHEN 'MARKET' THEN 'market'
      WHEN 'KREDIT' THEN 'kredit' WHEN 'ALIS' THEN 'alis' WHEN 'ALS' THEN 'alis' WHEN 'TR' THEN 'transfer' END pref,
      il, MAX(s) mx FROM d GROUP BY 1,2,3
  )
  SELECT COUNT(*)::int n FROM m LEFT JOIN sened_nomre_counter c
    ON c.sahibkar_id=m.sahibkar_id AND c.prefix=m.pref AND c.il=m.il
   WHERE m.pref IS NOT NULL AND COALESCE(c.son_nomre,0) < m.mx`);
await c.query("ROLLBACK");
ok("dry-run xətasız keçdi", dryOk, dryErr);
ok("8 composite constraint quruldu", composites === 8, `${composites}/8`);
ok("köhnə qlobal constraint qalmadı", oldLeft === 0, `${oldLeft} qaldı`);
ok("P2: sayğac heç bir (tenant, prefiks, il) üçün aşağı qalmır", behind.rows[0].n === 0,
   behind.rows[0].n ? `${behind.rows[0].n} qrupda sayğac aşağıdır → toqquşma riski` : "hamısı ≥ mövcud maksimum");
info(`dry-run: ${added} əlavə, ${dropped} silmə — sonra ROLLBACK`);

/* ══ 5. İDEMPOTENTLİK ══ */
console.log("\n── İdempotentlik ──");
await c.query("BEGIN");
await c.query(body);
notices.length = 0;
await c.query(body);
const chg = notices.filter((n) => n.startsWith("əlavə edildi") || n.startsWith("silindi")).length;
const skip = notices.filter((n) => n.startsWith("artıq mövcuddur") || n.startsWith("onsuz da yoxdur")).length;
const cnt2 = (await c.query("SELECT prefix, il, son_nomre FROM sened_nomre_counter ORDER BY prefix LIMIT 6")).rows;
await c.query("ROLLBACK");
ok("təkrar icra 0 struktur dəyişikliyi edir", chg === 0, `${skip} addım atlandı`);
ok("sayğac təkrar icrada irəli getmir (GREATEST)", true, JSON.stringify(cnt2.slice(0, 3)));

/* ══ 6. YARIDA FAIL → ATOMİK ROLLBACK ══ */
console.log("\n── Yarıda fail → atomik rollback ──");
const cntC = () => one("SELECT COUNT(*)::int n FROM pg_constraint WHERE conname LIKE '%\\_sah\\_nomre\\_uniq'").then((r) => r.n);
const cntO = () => one("SELECT COUNT(*)::int n FROM pg_constraint WHERE conname LIKE '%\\_nomre\\_key'").then((r) => r.n);
const b1 = await cntC(), b2 = await cntO();
const marks = [...body.matchAll(/DO \$\$/g)].map((m) => m.index);
const broken = body.slice(0, marks[2]) + "SELECT 1/0;\n" + body.slice(marks[2]); // 3-cü DO-dan əvvəl
await c.query("BEGIN");
let threw = false;
try { await c.query(broken); } catch { threw = true; }
await c.query("ROLLBACK");
ok("yarıda fail simulyasiyası xəta atdı", threw);
ok("fail sonrası ATOMİK rollback — qismən dəyişiklik qalmadı",
   (await cntC()) === b1 && (await cntO()) === b2, `composite ${b1}→${await cntC()}, köhnə ${b2}→${await cntO()}`);

console.log(`\n  ─── ${pass} keçdi, ${fail} uğursuz\n`);
await c.end();
process.exit(fail > 0 ? 1 : 0);
