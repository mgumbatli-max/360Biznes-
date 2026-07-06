// PROD performans indekslərini tətbiq edir (CONCURRENTLY = kilidsiz, böyük cədvəllər üçün təhlükəsiz).
// İSTİFADƏ:
//   1) Vercel dashboard-dan PROD unpooled/direct connection string götür.
//   2) `.env.prod` faylı yarat, içinə TƏK sətir:  DIRECT_URL=postgresql://...   (git-ignore olunur)
//   3) node scripts/apply-perf-indexes-prod.mjs
// QEYD: Neon pooled (-pooler) URL CONCURRENTLY-ni dəstəkləmir → UNPOOLED/direct URL işlət.
import { readFileSync } from "node:fs";
import pg from "pg";

let env = "";
try { env = readFileSync(new URL("../.env.prod", import.meta.url), "utf8"); }
catch { console.error("✗ .env.prod tapılmadı. Yarat: bir sətir  DIRECT_URL=postgresql://...prod...  (Vercel-dən unpooled)"); process.exit(1); }
const pick = (name) => { const m = env.match(new RegExp("^" + name + "=(.*)$", "m")); return m ? m[1].trim().replace(/^["']|["']$/g, "") : ""; };
const url = pick("DIRECT_URL") || pick("DATABASE_URL_UNPOOLED") || pick("DATABASE_URL");
if (!url) { console.error("✗ .env.prod-da DIRECT_URL/DATABASE_URL tapılmadı"); process.exit(1); }

let host = "?"; try { host = new URL(url).hostname; } catch { /* */ }
if (host.includes("localhost") || host.includes("127.0.0.1")) {
  console.error("✗ .env.prod LOKALa işarə edir (" + host + "). Prod URL lazımdır — dayandırıldı."); process.exit(1);
}
const pooled = /-pooler\./.test(url) || /pgbouncer=true/.test(url);

const IDX = [
  ["idx_satis_sah_status_qaralama_tarix", `satis_sifarisleri (sahibkar_id, status, qaralama, tarix DESC)`],
  ["idx_finance_sah_yn_tarix", `finance_operations (sahibkar_id, "yön", tarix DESC)`],
  ["idx_stok_sah_anbar", `stok (sahibkar_id, anbar_id)`],
  ["idx_servis_sah_status", `servis_qeydleri (sahibkar_id, status)`],
  ["idx_servis_sah_qapanma", `servis_qeydleri (sahibkar_id, qapanma_tarixi DESC)`],
  ["idx_kontragentler_sah_son_temas", `kontragentler (sahibkar_id, son_temas DESC)`],
  ["idx_cfu_sah_status_vaxt", `contact_followups (sahibkar_id, status, vaxt DESC)`],
  ["idx_inmsg_sah_status", `inbox_mesajlari (sahibkar_id, status)`],
  ["mp_hes_sah_status_idx", `marketplace_hesablari (sahibkar_id, status)`],
];

const c = new pg.Client({ connectionString: url });
await c.connect();
console.log("PROD host:", host, pooled ? "⚠(pooled — CONCURRENTLY dəstəklənməyə bilər)" : "(direct ✓)");

// Əvvəlcə mövcud vəziyyət
const have = new Set((await c.query("SELECT indexname FROM pg_indexes WHERE schemaname='public'")).rows.map((r) => r.indexname));
const missing = IDX.filter(([n]) => !have.has(n));
console.log(`Mövcud: ${IDX.length - missing.length}/${IDX.length} | Yaradılacaq: ${missing.length}\n`);

let ok = 0, skip = 0, fail = 0;
for (const [name, def] of IDX) {
  if (have.has(name)) { console.log("⏭️  " + name + " (artıq var)"); skip++; continue; }
  const kw = pooled ? "" : "CONCURRENTLY ";
  try { await c.query(`CREATE INDEX ${kw}IF NOT EXISTS ${name} ON ${def}`); console.log("✅ " + name); ok++; }
  catch (e) { console.log("❌ " + name + " — " + String(e.message).split("\n").pop().slice(0, 90)); fail++; }
}
console.log(`\nYekun: ${ok} yeni, ${skip} artıq mövcud, ${fail} xəta.`);
await c.end();
process.exit(fail > 0 ? 1 : 0);
