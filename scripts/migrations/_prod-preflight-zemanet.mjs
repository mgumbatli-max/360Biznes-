import fs from "node:fs"; import pg from "pg";
const url = fs.readFileSync(".env.prod","utf8").match(/^DIRECT_URL=(.*)$/m)[1].trim(); // preflight_ro
const c = new pg.Client({ connectionString: url }); await c.connect();
await c.query("SET default_transaction_read_only = on");
const ro = async (q,p)=>{ await c.query("BEGIN READ ONLY"); try { return (await c.query(q,p)).rows; } finally { await c.query("ROLLBACK"); } };
const one = async (q,p)=>(await ro(q,p))[0];
let pass=0, fail=0;
const ok=(n,cd,d="")=>{ if(cd)pass++; else fail++; console.log(`  ${cd?"✅":"❌"} ${n}${d?` — ${d}`:""}`); };

console.log("\n╔══════════════════════════════════════════════════════════════════╗");
console.log("║  PROD READ-ONLY PREFLIGHT · zemanetler tenant-scoped             ║");
console.log("╚══════════════════════════════════════════════════════════════════╝");
const v = await one("SELECT version() v");
console.log(`  · ${v.v.split(" on ")[0]} on ${(v.v.split(" on ")[1]??"?").split(",")[0]}`);
let woBlocked=false;
try { await c.query("BEGIN READ ONLY"); await c.query("CREATE TEMP TABLE __p (x int)"); await c.query("ROLLBACK"); }
catch(e){ woBlocked=/read-only|permission denied/i.test(e.message); await c.query("ROLLBACK").catch(()=>{}); }
ok("sessiya READ-ONLY (yazma bloklanır)", woBlocked);

const t = await one(`SELECT COUNT(*)::int total, COUNT(DISTINCT sahibkar_id)::int tenants,
  pg_size_pretty(pg_total_relation_size('zemanetler')) sz FROM zemanetler`);
console.log(`  · zemanetler: ${t.total} sətir · ${t.tenants} tenant · ${t.sz}`);
ok(`lock riski (${t.total} sətir)`, true, t.total > 100000 ? "⚠ böyük cədvəl" : "cədvəl kiçik — anidir");

const n = await one(`SELECT COUNT(*)::int n FROM zemanetler
  WHERE sahibkar_id IS NULL OR unikal_kod IS NULL OR unikal_kod='' OR qr_token IS NULL OR qr_token=''`);
ok("NULL/boş sahə yoxdur", n.n===0, `${n.n}`);
const dt = await one(`SELECT COUNT(*)::int n FROM (SELECT sahibkar_id,unikal_kod FROM zemanetler GROUP BY 1,2 HAVING COUNT(*)>1) z`);
ok("tenant daxilində duplicate yoxdur (composite qurula bilər)", dt.n===0, `${dt.n}`);
const orp = await one(`SELECT COUNT(*)::int n FROM zemanetler z LEFT JOIN sahibkarlar s ON s.id=z.sahibkar_id WHERE s.id IS NULL`);
ok("orphan qeyd yoxdur", orp.n===0, `${orp.n}`);
const unk = await one(`SELECT COUNT(*)::int n FROM zemanetler
  WHERE unikal_kod !~ '^Z-[0-9]{4}-[0-9]+$' AND unikal_kod !~ '^Z-[0-9]{4}-[0-9A-Z]{6}$'`);
ok("naməlum formatlı kod yoxdur", unk.n===0, `${unk.n}`);

const idx = await ro(`SELECT i.relname i, (SELECT string_agg(a.attname::text,',' ORDER BY k.ord)
  FROM unnest(ix.indkey) WITH ORDINALITY k(attnum,ord) JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum) cols
  FROM pg_index ix JOIN pg_class i ON i.oid=ix.indexrelid JOIN pg_class t ON t.oid=ix.indrelid
  WHERE t.relname='zemanetler' AND ix.indisunique`);
idx.forEach(r=>console.log(`    ${r.i.padEnd(34)} (${r.cols})`));
ok("qlobal UNIQUE(unikal_kod) mövcuddur (migration hədəfi)", idx.some(r=>r.cols==="unikal_kod"));
ok("composite hələ yoxdur (tətbiq olunmayıb)", !idx.some(r=>r.cols==="sahibkar_id,unikal_kod"));
ok("qr_token qlobal UNIQUE mövcuddur (toxunulmayacaq)", idx.some(r=>r.cols==="qr_token"));

const fk = await ro(`SELECT con.conname FROM pg_constraint con LEFT JOIN pg_class i ON i.oid=con.conindid
  JOIN pg_class tgt ON tgt.oid=con.confrelid WHERE con.contype='f' AND tgt.relname='zemanetler' AND i.relname LIKE '%unikal%'`);
ok("unikal_kod-a FK asılılığı yoxdur", fk.length===0, `${fk.length}`);
const cnt = await ro(`SELECT COUNT(*)::int n FROM sened_nomre_counter WHERE prefix='zemanet'`);
console.log(`  · mövcud 'zemanet' sayğac sətri: ${cnt[0].n}`);
const act = await ro(`SELECT COUNT(*)::int n FROM pg_stat_activity WHERE datname=current_database()
  AND state<>'idle' AND xact_start < now() - interval '5 seconds'`);
ok("uzun açıq tranzaksiya yoxdur", act[0].n===0, `${act[0].n}`);

console.log(`\n  ─── ${pass} keçdi, ${fail} uğursuz ───\n`);
await c.end(); process.exit(fail>0?1:0);
