/**
 * PRODUCTION READ-ONLY PREFLIGHT — 2026-09-01 migration üçün.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  BU SKRIPT PRODUCTION BAZASINA YALNIZ OXUMAQ ÜÇÜN QOŞULUR.               ║
 * ║  • Sessiya `default_transaction_read_only = on` ilə açılır               ║
 * ║  • Hər sorğu `BEGIN READ ONLY … ROLLBACK` içindədir                      ║
 * ║  • Heç bir INSERT/UPDATE/DELETE/ALTER/CREATE/DROP icra edilmir           ║
 * ║  • Connection string heç vaxt çap olunmur (host maskalanır)              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Mənbə: .env.prod → DIRECT_URL (Neon direct/unpooled, `preflight_ro` rolu)
 *
 * İşlət: node scripts/migrations/_prod-preflight-readonly.mjs
 */
import fs from "node:fs";
import pg from "pg";

const STRICT = ["satis_sifarisleri", "alis_sifarisleri", "qaytarma_sifarisleri",
                "anbar_transferleri", "inventarizasiyalar", "servis_qeydleri"];
const LAX = ["catdirmalar", "rezervler"];
const ALL = [...STRICT, ...LAX];

/* Sinif siyahıları — lib/db/sened-nomre.ts parseri ilə EYNİ olmalıdır. */
const SEQ = ["SATIS", "S", "SS", "WS", "POS", "MARKET", "KREDIT", "ALIS", "ALS", "AS",
             "QAYTARMA", "QAY", "TR", "TRANSFER", "INV", "SAYIM", "SR", "SERVIS", "TEKLIF", "MEXARIC"];
const EXT = ["WH", "LEAD", "CT", "RZ"];

/** NULL-safe prefiks (defissiz nömrədə `substring` NULL qaytarır → '' olur). */
const PFX = `COALESCE(substring(nomre from '^([A-Z]+)-'), '')`;
const F3 = `nomre ~ '^[A-Z]+-[0-9]{4}-[0-9]+$'`;   // PREFIKS-İL-SIRA
const F2 = `nomre ~ '^[A-Z]+-[0-9]+$'`;            // PREFIKS-SIRA (köhnə POS)
const SIRA = `CASE WHEN ${F3} THEN split_part(nomre,'-',3)::bigint
                   WHEN ${F2} THEN split_part(nomre,'-',2)::bigint END`;
const SINIF = `CASE
    WHEN ${PFX} = ANY($1) THEN 'external'
    WHEN ${PFX} = ANY($2) AND (${F3} OR ${F2}) THEN 'sequential'
    ELSE 'unknown' END`;
/** Sayğac namespace-i — migration SQL-i və TS parseri ilə eyni map. */
const NS = `CASE ${PFX}
    WHEN 'SATIS' THEN 'satis' WHEN 'S' THEN 'satis' WHEN 'SS' THEN 'satis'
    WHEN 'WS' THEN 'satis' WHEN 'POS' THEN 'satis'
    WHEN 'MARKET' THEN 'market' WHEN 'KREDIT' THEN 'kredit'
    WHEN 'ALIS' THEN 'alis' WHEN 'ALS' THEN 'alis' WHEN 'AS' THEN 'alis'
    WHEN 'QAYTARMA' THEN 'qaytarma' WHEN 'QAY' THEN 'qaytarma'
    WHEN 'TR' THEN 'transfer' WHEN 'TRANSFER' THEN 'transfer'
    WHEN 'INV' THEN 'sayim' WHEN 'SAYIM' THEN 'sayim'
    WHEN 'SR' THEN 'servis' WHEN 'SERVIS' THEN 'servis'
    WHEN 'TEKLIF' THEN 'teklif' WHEN 'MEXARIC' THEN 'mexaric' END`;
/** İl — nömrədən (iki seqmentli formatda sıradan çıxarılır). */
const IL = `CASE WHEN ${F3} THEN split_part(nomre,'-',2)::int
                 WHEN ${F2} AND ${SIRA} >= 100000000 THEN (${SIRA} / 100000)::int END`;

/* ── credential yüklənməsi (heç vaxt çap olunmur) ── */
let raw = "";
try { raw = fs.readFileSync(".env.prod", "utf8"); }
catch { console.error("✗ .env.prod tapılmadı."); process.exit(1); }
const pick = (k) => (raw.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
const url = pick("DIRECT_URL") || pick("DATABASE_URL_UNPOOLED") || pick("DATABASE_URL");
if (!url || url.includes("SENSITIVE")) {
  console.error("✗ .env.prod-da real DIRECT_URL yoxdur (boş və ya [SENSITIVE] placeholder).");
  process.exit(1);
}
let host = "?", pooled = false;
try { const u = new URL(url); host = u.hostname; pooled = host.includes("pooler"); } catch { /* */ }
if (/localhost|127\.0\.0\.1|::1/.test(host)) {
  console.error("✗ DIRECT_URL LOKALa işarə edir. Production URL lazımdır — dayandırıldı.");
  process.exit(1);
}
const maskedHost = host.replace(/^([^.]{0,4})[^.]*/, "$1***");

let pass = 0, fail = 0, warn = 0;
const ok = (n, c, d = "") => { if (c) pass++; else fail++; console.log(`  ${c ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };
const wr = (n, d = "") => { warn++; console.log(`  ⚠️  ${n}${d ? ` — ${d}` : ""}`); };
const info = (s) => console.log(`  · ${s}`);

const client = new pg.Client({ connectionString: url, statement_timeout: 120000 });
await client.connect();
await client.query("SET default_transaction_read_only = on");

async function ro(q, params) {
  await client.query("BEGIN READ ONLY");
  try { return (await client.query(q, params)).rows; }
  finally { await client.query("ROLLBACK"); }
}
const one = async (q, p) => (await ro(q, p))[0];

console.log("\n╔══════════════════════════════════════════════════════════════════╗");
console.log("║  PRODUCTION READ-ONLY PREFLIGHT · 2026-09-01 migration           ║");
console.log("╚══════════════════════════════════════════════════════════════════╝");

/* ══ 0. PRODUCTION TƏSDİQİ ══ */
console.log("\n── 0. Production identifikasiyası ──");
const v = await one("SELECT version() AS v");
const db = await one("SELECT current_database() AS d, current_user AS u");
info(`host: ${maskedHost} · ${pooled ? "⚠ POOLED" : "direct ✓"}`);
info(`server: ${v.v.split(" on ")[0]} on ${(v.v.split(" on ")[1] ?? "?").split(",")[0]}`);
info(`baza: ${db.d} · rol: ${db.u}`);
ok("host Neon domenindədir", /neon\.tech|neon\.build/i.test(host));
ok("server idarə olunan Linux üzərindədir (lokal Homebrew/darwin DEYİL)",
   /linux/i.test(v.v) && !/homebrew|darwin/i.test(v.v));
ok("connection direct/unpooled-dir (CONCURRENTLY üçün vacib)", !pooled);

let woBlocked = false, woMsg = "";
try {
  await client.query("BEGIN READ ONLY");
  await client.query("CREATE TEMP TABLE __ro_probe (x int)");
  await client.query("ROLLBACK");
  woMsg = "YAZMA MÜMKÜN OLDU";
} catch (e) {
  woBlocked = /read-only|permission denied/i.test(e.message);
  woMsg = e.message.split("\n")[0].slice(0, 60);
  await client.query("ROLLBACK").catch(() => {});
}
ok("sessiya həqiqətən READ-ONLY (yazma cəhdi bloklanır)", woBlocked, woMsg);
info(`tenant sayı: ${(await one("SELECT COUNT(*)::int n FROM sahibkarlar")).n}`);

/* ══ 1. ÖLÇÜ + LOCK RİSKİ ══ */
console.log("\n── 1. Cədvəl ölçüləri və lock riski ──");
const sizes = await ro(`
  SELECT c.relname AS t, COALESCE(s.n_live_tup,0)::bigint AS rows,
         pg_size_pretty(pg_total_relation_size(c.oid)) AS sz
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public'
    LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
   WHERE c.relname = ANY($1) ORDER BY rows DESC`, [ALL]);
let maxRows = 0;
for (const r of sizes) {
  maxRows = Math.max(maxRows, Number(r.rows));
  console.log(`    ${r.t.padEnd(24)} ${String(r.rows).padStart(9)} sətir · ${r.sz}`);
}
const strategy = maxRows > 100000 ? "ONLINE (CONCURRENTLY)" : "TRANSACTIONAL";
ok(`lock riski qiymətləndirildi (ən böyük cədvəl: ${maxRows} sətir)`, true, `strategiya: ${strategy}`);
if (maxRows > 100000) wr("böyük cədvəl — tranzaksiyalı yol uzun ACCESS EXCLUSIVE lock verər", "online yol məcburidir");

/* ══ 2. DATA BÜTÖVLÜYÜ ══ */
console.log("\n── 2. Data bütövlüyü ──");
let nulls = 0, dupTenant = 0, dupGlobal = 0, orphans = 0;
for (const t of ALL) {
  nulls += Number((await one(`SELECT COUNT(*)::int n FROM ${t} WHERE sahibkar_id IS NULL OR nomre IS NULL OR nomre=''`)).n);
  dupTenant += Number((await one(`SELECT COUNT(*)::int n FROM (SELECT sahibkar_id,nomre FROM ${t} GROUP BY 1,2 HAVING COUNT(*)>1) z`)).n);
  dupGlobal += Number((await one(`SELECT COUNT(*)::int n FROM (SELECT nomre FROM ${t} GROUP BY nomre HAVING COUNT(*)>1) z`)).n);
  orphans += Number((await one(`SELECT COUNT(*)::int n FROM ${t} d LEFT JOIN sahibkarlar s ON s.id=d.sahibkar_id WHERE s.id IS NULL`)).n);
}
ok("sahibkar_id / nomre NULL və ya boş sətir yoxdur", nulls === 0, `${nulls} sətir`);
ok("tenant daxilində təkrar nömrə yoxdur (composite qurula bilər)", dupTenant === 0, `${dupTenant} təkrar`);
ok("orphan sənəd (mövcud olmayan tenant) yoxdur", orphans === 0, `${orphans} sətir`);
info(`qlobal təkrar (kirayəçilər arası): ${dupGlobal} — migration-dan sonra normaldır`);

/* ══ 3. NÖMRƏ FORMATLARI — SİNİF ÜZRƏ ══ */
console.log("\n── 3. Sənəd nömrəsi formatları (sinif üzrə) ──");
let unknownStrict = 0, overflowStrict = 0, extTotal = 0, seqTotal = 0;
const ICON = { sequential: "  ", external: "ℹ ", unknown: "❌" };
for (const t of ALL) {
  const rows = await ro(`
    SELECT sinif, pfx, COUNT(*)::int AS c, MIN(nomre) AS ex, MAX(sira) AS mx
      FROM (SELECT nomre, ${PFX} AS pfx, ${SINIF} AS sinif, ${SIRA} AS sira FROM ${t}) z
     GROUP BY sinif, pfx ORDER BY sinif, c DESC`, [EXT, SEQ]);
  if (!rows.length) { console.log(`    ${t.padEnd(24)} (boş)`); continue; }
  console.log(`    ${t}:`);
  for (const r of rows) {
    console.log(`      ${ICON[r.sinif] ?? "? "}[${r.sinif}] ${String(r.pfx || "—").padEnd(9)} × ${String(r.c).padStart(5)}  max_sıra=${r.mx ?? "—"}  ${r.ex}`);
    if (r.sinif === "external") extTotal += r.c;
    if (r.sinif === "sequential") seqTotal += r.c;
  }
  const unk = Number((await one(
    `SELECT COUNT(*)::int n FROM (SELECT ${SINIF} AS s FROM ${t}) z WHERE s='unknown'`, [EXT, SEQ])).n);
  const ov = Number((await one(
    `SELECT COUNT(*)::int n FROM (SELECT ${SINIF} AS s, ${SIRA} AS sira FROM ${t}) z
      WHERE s='sequential' AND sira > 2147483647`, [EXT, SEQ])).n);
  if (STRICT.includes(t)) { unknownStrict += unk; overflowStrict += ov; }
  else if (unk) wr(`${t} (sayğacsız): ${unk} naməlum formatlı nömrə`, "migration dayanmır");
}
info(`sequential: ${seqTotal} nömrə (sayğaca daxil) · external: ${extTotal} nömrə (sayğaca DAXİL DEYİL)`);
ok("sayğaclı 6 cədvəldə NAMƏLUM formatlı nömrə yoxdur", unknownStrict === 0, `${unknownStrict} sətir — BLOKEDİCİ`);
ok("sequential sıra integer həddini aşmır", overflowStrict === 0, `${overflowStrict} sətir`);

/* ══ 4. CONSTRAINT / INDEX ══ */
console.log("\n── 4. Mövcud UNIQUE constraint / index ──");
const idx = await ro(`
  SELECT t.relname AS t, i.relname AS i, ix.indisvalid AS valid,
         (SELECT string_agg(a.attname::text,',' ORDER BY k.ord)
            FROM unnest(ix.indkey) WITH ORDINALITY k(attnum,ord)
            JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum) AS cols
    FROM pg_index ix
    JOIN pg_class i ON i.oid=ix.indexrelid
    JOIN pg_class t ON t.oid=ix.indrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace AND n.nspname='public'
   WHERE ix.indisunique AND NOT ix.indisprimary AND t.relname = ANY($1)
   ORDER BY t.relname`, [ALL]);
for (const r of idx) console.log(`    ${r.t.padEnd(24)} ${r.i.padEnd(40)} (${r.cols})${r.valid ? "" : " ❌INVALID"}`);
ok("8 cədvəldə tək-sütunlu UNIQUE(nomre) mövcuddur (migration hədəfi)",
   idx.filter((r) => r.cols === "nomre").length === 8, `${idx.filter((r) => r.cols === "nomre").length}/8`);
ok("composite UNIQUE(sahibkar_id, nomre) hələ yoxdur (migration tətbiq olunmayıb)",
   idx.filter((r) => r.cols === "sahibkar_id,nomre").length === 0);
ok("INVALID indeks yoxdur", idx.filter((r) => !r.valid).length === 0);

const fk = await ro(`
  SELECT con.conname AS fk FROM pg_constraint con
  LEFT JOIN pg_class i ON i.oid=con.conindid
  JOIN pg_class tgt ON tgt.oid=con.confrelid
  WHERE con.contype='f' AND tgt.relname = ANY($1) AND i.relname LIKE '%\\_nomre\\_key'`, [ALL]);
ok("silinəcək _nomre_key-lərə FK asılılığı yoxdur", fk.length === 0, `${fk.length} FK`);

const cov = await ro(`
  SELECT t.relname AS t FROM pg_index ix
  JOIN pg_class i ON i.oid=ix.indexrelid JOIN pg_class t ON t.oid=ix.indrelid
  JOIN pg_namespace n ON n.oid=t.relnamespace AND n.nspname='public'
  WHERE ix.indisunique AND NOT ix.indisprimary
    AND (SELECT string_agg(a.attname::text,',' ORDER BY k.ord) FROM unnest(ix.indkey) WITH ORDINALITY k(attnum,ord)
         JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum)='nomre'`);
const missed = cov.map((r) => r.t).filter((t) => !ALL.includes(t));
ok("migration əhatəsindən kənar UNIQUE(nomre) cədvəli yoxdur", missed.length === 0,
   missed.length ? `ƏHATƏSİZ: ${missed.join(", ")}` : `${cov.length} cədvəl`);

/* ══ 5. SAYĞAC ══ */
console.log("\n── 5. sened_nomre_counter ──");
const cnt = await ro("SELECT prefix, il, COUNT(*)::int tenants, MAX(son_nomre)::bigint mx FROM sened_nomre_counter GROUP BY 1,2 ORDER BY 1,2");
if (!cnt.length) info("sayğac cədvəli BOŞDUR — migration onu ilk dəfə dolduracaq");
for (const r of cnt) console.log(`    ${r.prefix.padEnd(12)} ${r.il}  ${String(r.tenants).padStart(3)} tenant  max=${r.mx}`);
ok("sened_nomre_counter PK (sahibkar_id, prefix, il) mövcuddur",
   Number((await one(`SELECT COUNT(*)::int n FROM pg_constraint con JOIN pg_class t ON t.oid=con.conrelid
     WHERE t.relname='sened_nomre_counter' AND con.contype='p'
       AND pg_get_constraintdef(con.oid)='PRIMARY KEY (sahibkar_id, prefix, il)'`)).n) === 1);

// Migration sonrası sayğacın aşağı qalıb-qalmayacağını ƏVVƏLCƏDƏN hesabla —
// EXTERNAL sinif hesablamadan kənarda saxlanılır (əsas invariant).
const behind = await ro(`
  WITH d AS (
    ${STRICT.map((t) => `SELECT sahibkar_id, ${NS} AS pref, ${IL} AS il, ${SIRA} AS sira,
       ${SINIF} AS sinif FROM ${t}`).join(" UNION ALL ")}
  ), m AS (
    SELECT sahibkar_id, pref, il, MAX(sira) AS mx FROM d
     WHERE sinif='sequential' AND pref IS NOT NULL AND il IS NOT NULL
     GROUP BY 1,2,3
  )
  SELECT COUNT(*)::int n FROM m
   WHERE GREATEST(COALESCE((SELECT son_nomre FROM sened_nomre_counter c
       WHERE c.sahibkar_id=m.sahibkar_id AND c.prefix=m.pref AND c.il=m.il), 0), m.mx) < m.mx`,
  [EXT, SEQ]);
ok("migration sonrası sayğac heç bir qrupda aşağı qalmayacaq", Number(behind[0].n) === 0,
   `${behind[0].n} qrup`);

/* ══ 6. LOCK MÜHİTİ ══ */
console.log("\n── 6. Lock mühiti ──");
try {
  const act = await ro(`SELECT COUNT(*)::int n FROM pg_stat_activity
    WHERE datname=current_database() AND state<>'idle' AND xact_start < now() - interval '5 seconds'`);
  ok("uzun sürən açıq tranzaksiya yoxdur", Number(act[0].n) === 0, `${act[0].n} aktiv`);
} catch { wr("pg_stat_activity oxunmadı", "read-only rolun icazəsi məhduddur"); }

/* ══ 7. BACKUP / PITR ══ */
console.log("\n── 7. Backup / PITR ──");
try {
  info(`wal_level = ${(await one("SELECT current_setting('wal_level') AS w")).w}`);
  wr("PITR statusu SQL-dən TƏSDİQLƏNƏ BİLMİR", "Neon PITR konsol səviyyəsindədir — əl ilə yoxlayın");
} catch { wr("wal_level oxunmadı", "icazə məhdudiyyəti"); }

console.log(`\n  ─── ${pass} keçdi, ${fail} uğursuz, ${warn} xəbərdarlıq ───\n`);
await client.end();
process.exit(fail > 0 ? 1 : 0);
