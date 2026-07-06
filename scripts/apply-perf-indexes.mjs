// Əskik performans indekslərini tətbiq edir. İstifadə:  node scripts/apply-perf-indexes.mjs
// .env-dən DIRECT_URL (yoxdursa DATABASE_URL) oxuyur, 9 hot-path indeksini yaradır (IF NOT EXISTS = idempotent).
// Cədvəllər kiçik olduğu üçün adi CREATE INDEX (CONCURRENTLY-siz) ani işləyir.
import { readFileSync } from "node:fs";

// .env-i əl ilə oxu (dotenv-siz)
let env = "";
try { env = readFileSync(new URL("../.env", import.meta.url), "utf8"); } catch { /* */ }
const pick = (name) => {
  const m = env.match(new RegExp("^" + name + "=(.*)$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
};
const url = pick("DIRECT_URL") || pick("DATABASE_URL");
if (!url) { console.error("✗ .env-də DIRECT_URL/DATABASE_URL tapılmadı"); process.exit(1); }
process.env.DATABASE_URL = url;

const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();

const IDX = [
  ["idx_satis_sah_status_qaralama_tarix", `CREATE INDEX IF NOT EXISTS idx_satis_sah_status_qaralama_tarix ON satis_sifarisleri (sahibkar_id, status, qaralama, tarix DESC)`],
  ["idx_finance_sah_yn_tarix", `CREATE INDEX IF NOT EXISTS idx_finance_sah_yn_tarix ON finance_operations (sahibkar_id, "yön", tarix DESC)`],
  ["idx_stok_sah_anbar", `CREATE INDEX IF NOT EXISTS idx_stok_sah_anbar ON stok (sahibkar_id, anbar_id)`],
  ["idx_servis_sah_status", `CREATE INDEX IF NOT EXISTS idx_servis_sah_status ON servis_qeydleri (sahibkar_id, status)`],
  ["idx_servis_sah_qapanma", `CREATE INDEX IF NOT EXISTS idx_servis_sah_qapanma ON servis_qeydleri (sahibkar_id, qapanma_tarixi DESC)`],
  ["idx_kontragentler_sah_son_temas", `CREATE INDEX IF NOT EXISTS idx_kontragentler_sah_son_temas ON kontragentler (sahibkar_id, son_temas DESC)`],
  ["idx_cfu_sah_status_vaxt", `CREATE INDEX IF NOT EXISTS idx_cfu_sah_status_vaxt ON contact_followups (sahibkar_id, status, vaxt DESC)`],
  ["idx_inmsg_sah_status", `CREATE INDEX IF NOT EXISTS idx_inmsg_sah_status ON inbox_mesajlari (sahibkar_id, status)`],
  ["mp_hes_sah_status_idx", `CREATE INDEX IF NOT EXISTS mp_hes_sah_status_idx ON marketplace_hesablari (sahibkar_id, status)`],
];

console.log("DB-yə qoşulur:", url.replace(/:\/\/[^@]*@/, "://***@").slice(0, 60) + "...");
let ok = 0, fail = 0;
for (const [name, sql] of IDX) {
  try { await p.$executeRawUnsafe(sql); console.log("✅ " + name); ok++; }
  catch (e) { console.log("❌ " + name + " — " + String(e.message).split("\n").pop().slice(0, 90)); fail++; }
}
console.log(`\nYekun: ${ok} tətbiq/mövcud, ${fail} xəta.`);
await p.$disconnect();
process.exit(fail > 0 ? 1 : 0);
