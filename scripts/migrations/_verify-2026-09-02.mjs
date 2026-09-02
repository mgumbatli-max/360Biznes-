import fs from "node:fs"; import pg from "pg";
const url = fs.readFileSync(".env","utf8").match(/^DATABASE_URL="?([^"\n]+)/m)[1];
const sql = fs.readFileSync("scripts/migrations/2026-09-02-zemanet-tenant-scoped-kod.sql","utf8");
const body = sql.split("COMMIT;")[0].replace(/^SET [^;]+;/gm,"").replace(/^BEGIN;/m,"");
let pass=0, fail=0;
const ok=(n,c,d="")=>{ if(c)pass++; else fail++; console.log(`  ${c?"✅":"❌"} ${n}${d?` — ${d}`:""}`); };
const c = new pg.Client({ connectionString: url }); const notices=[];
c.on("notice", m=>notices.push(m.message)); await c.connect();
const one = async q => (await c.query(q)).rows[0];

// statik
const D=/\bDROP\s+(TABLE|COLUMN|DATABASE|SCHEMA)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i;
const strip=s=>s.split("\n").filter(l=>!/^\s*--/.test(l)).join("\n");
ok("destructive əməliyyat yoxdur", !D.test(strip(sql)));
ok("lock_timeout var", /SET\s+lock_timeout/i.test(sql));
ok("qr_token qorunması yoxlanılır", /zemanetler_qr_token_key/.test(sql));
ok("composite yoxdursa köhnə silinmir (mühafizə)", /DAYAN: composite constraint yaradılmayıb/.test(sql));

const cntC=()=>one("SELECT COUNT(*)::int n FROM pg_constraint WHERE conname='zemanetler_sah_unikal_kod_uniq'").then(r=>r.n);
const cntO=()=>one("SELECT COUNT(*)::int n FROM pg_constraint WHERE conname='zemanetler_unikal_kod_key'").then(r=>r.n);
const cntQ=()=>one("SELECT COUNT(*)::int n FROM pg_constraint WHERE conname='zemanetler_qr_token_key'").then(r=>r.n);
const b1=await cntC(), b2=await cntO(), b3=await cntQ();

// dry-run
await c.query("BEGIN");
notices.length=0;
let dryOk=true, err="";
try { await c.query(body); } catch(e){ dryOk=false; err=e.message.slice(0,150); }
const inC=await cntC(), inO=await cntO(), inQ=await cntQ();
await c.query("ROLLBACK");
ok("dry-run xətasız keçdi", dryOk, err);
ok("composite quruldu", inC===1, `${inC}`);
ok("köhnə qlobal silindi", inO===0, `${inO}`);
ok("qr_token qlobal UNIQUE TOXUNULMADI", inQ===1, `${inQ}`);
ok("ROLLBACK sonrası baseline bərpa olundu", (await cntC())===b1 && (await cntO())===b2 && (await cntQ())===b3);

// idempotentlik
await c.query("BEGIN"); await c.query(body); notices.length=0; await c.query(body);
const chg=notices.filter(n=>n.startsWith("əlavə edildi")||n.startsWith("silindi")).length;
await c.query("ROLLBACK");
ok("təkrar icra 0 struktur dəyişikliyi edir", chg===0, `${chg}`);

// yarıda fail → atomik rollback
const marks=[...body.matchAll(/DO \$\$/g)].map(m=>m.index);
const broken=body.slice(0,marks[2])+"SELECT 1/0;\n"+body.slice(marks[2]);
await c.query("BEGIN"); let threw=false;
try { await c.query(broken); } catch { threw=true; }
await c.query("ROLLBACK");
ok("yarıda fail xəta atdı", threw);
ok("fail sonrası atomik rollback", (await cntC())===b1 && (await cntO())===b2 && (await cntQ())===b3);

console.log(`\n  ─── ${pass} keçdi, ${fail} uğursuz ───\n`);
await c.end(); process.exit(fail>0?1:0);
