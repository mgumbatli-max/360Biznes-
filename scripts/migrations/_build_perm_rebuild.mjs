// İcazə sxem köçürməsini tamamlayan konsolidə migrasiya qurur.
// 1) Bütün *permissions*.sql migrasiyalarını oxuyur, sınıq istinadları düzəldir
//    (rollar→roles, r.kod→r.ad, rol-adı normallaşması).
// 2) App-in yoxladığı amma heç bir migrasiyada təyin olunmayan QALAN kodları
//    (alias-lar + migrasiyası olmayan modullar, məs. servis.*) seed + grant edir.
// 3) Tam-giriş rolları (sahibkar/admin/director) BÜTÜN kodları alır (platform.admin xaric).
// Nəticə: idempotent, tək tranzaksiya. Grant-lar r.ad ilə həm sistem, həm
// tenant-klon rollarına tətbiq olunur (avto-backfill).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "scripts/migrations";
const files = readdirSync(DIR)
  .filter((f) => /permissions.*\.sql$/.test(f) && !f.startsWith("_"))
  .sort();

const ROLE_FIX = [
  [/'direktor'/g, "'director'"],
  [/'menecher'/g, "'manecer'"],
  [/'menecer'/g, "'manecer'"],
];

const out = [];
out.push("-- ============================================================================");
out.push("-- 2026-06-16: İCAZƏ SXEM KÖÇÜRMƏSİNİ TAMAMLAYAN REBUILD (auto-generated)");
out.push("-- Sınıq migrasiyalar (rollar/r.kod + DB-də olmayan rollar) atomik fail olmuşdu.");
out.push("-- Bu fayl: yeni kodları kataloqa əlavə + grant-ları real rollara (sistem+klon)");
out.push("-- tətbiq + qalan app kodlarını (alias/servis) seed edir. İdempotent.");
out.push("-- ============================================================================");
out.push("BEGIN;");
out.push("");

// ── HİSSƏ 1: mövcud migrasiyaları düzəldib daxil et ─────────────────────────
for (const f of files) {
  let sql = readFileSync(join(DIR, f), "utf8");
  sql = sql.replace(/^\s*BEGIN\s*;\s*$/gim, "").replace(/^\s*COMMIT\s*;\s*$/gim, "");
  sql = sql.replace(/\brollar\b/g, "roles");
  sql = sql.replace(/\br\.kod\b/g, "r.ad");
  for (const [re, rep] of ROLE_FIX) sql = sql.replace(re, rep);
  out.push(`-- ─── menbe: ${f} ───`);
  out.push(sql.trim());
  out.push("");
}

// ── HİSSƏ 2: app yoxlayır amma hələ kataloqda olmayan QALAN kodlar ───────────
// (still_missing.txt /tmp-də hesablanıb — buraya inline siyahı kimi yazırıq)
const STILL_MISSING = readFileSync("/tmp/still_missing.txt", "utf8")
  .split("\n").map((s) => s.trim()).filter(Boolean)
  .filter((k) => k !== "platform.admin"); // super-admin — rolla verilmir

// resource prefix → (qrup, bu resursu alan operativ rollar). Privileged onsuz da catch-all alır.
const RES = {
  anbar: ["Anbar", ["anbardar", "manecer", "muhasib"]],
  mehsul: ["Anbar", ["anbardar", "manecer"]],
  stok: ["Anbar", ["anbardar", "manecer"]],
  inventar: ["Anbar", ["anbardar", "manecer"]],
  satinalma: ["Anbar", ["anbardar", "manecer", "muhasib"]],
  qiymet: ["Anbar", ["anbardar", "manecer"]],
  bron: ["Anbar", ["anbardar", "manecer", "satici"]],
  konsiqnasiya: ["Anbar", ["anbardar", "manecer"]],
  kateqoriya: ["Anbar", ["anbardar", "manecer"]],
  maya: ["Anbar", ["manecer", "muhasib"]],
  menfeet: ["Maliyyə", ["manecer", "muhasib"]],
  ticaret: ["Ticarət", ["satici", "manecer", "kassir", "anbardar", "muhasib"]],
  satis: ["Ticarət", ["satici", "manecer", "kassir"]],
  alis: ["Ticarət", ["anbardar", "manecer", "muhasib"]],
  teklif: ["Ticarət", ["satici", "manecer"]],
  kredit: ["Ticarət", ["manecer", "muhasib"]],
  qaytarma: ["Ticarət", ["satici", "kassir", "manecer"]],
  komissiya: ["Ticarət", ["manecer", "muhasib"]],
  sales: ["Ticarət", ["satici", "manecer"]],
  maliye: ["Maliyyə", ["muhasib", "manecer"]],
  maliyye: ["Maliyyə", ["muhasib", "manecer"]],
  fin_op: ["Maliyyə", ["muhasib", "manecer"]],
  recurring: ["Maliyyə", ["muhasib", "manecer"]],
  hesab: ["Maliyyə", ["muhasib", "manecer"]],
  bank: ["Maliyyə", ["muhasib"]],
  xerc: ["Maliyyə", ["muhasib", "manecer"]],
  musteri: ["Müştərilər", ["satici", "manecer"]],
  elaqe: ["Müştərilər", ["satici", "manecer"]],
  kampaniya: ["CRM", ["manecer", "smm"]],
  marketing: ["CRM", ["manecer", "smm"]],
  servis: ["Servis", ["servisci", "manecer"]],
  zemanet: ["Servis", ["servisci", "manecer"]],
  hesabat: ["Hesabatlar", ["muhasib", "manecer"]],
  pos: ["POS", ["kassir", "satici", "manecer"]],
  hr: ["Əməkdaşlar", ["manecer"]],
  marketplace: ["Marketplace", ["manecer"]],
  webhook: ["Marketplace", ["manecer"]],
  tesdiq: ["Servis", ["manecer"]],
  // sensitive → yalnız privileged (catch-all): ayar, audit, audit_log, sahibkar
};

out.push("-- ─── HISSE 2: qalan app kodları (alias + migrasiyasız modullar) ───");
const valueRows = [];
const grantByRole = {}; // role → [codes]
for (const kod of STILL_MISSING) {
  const res = kod.split(".")[0];
  const cfg = RES[res];
  const qrup = cfg ? cfg[0] : "Digər";
  const ad = kod; // sadə ad — getPermissionInfo() pattern-dən təsviri derive edir
  valueRows.push(`  ('${kod}', '${ad}', '${qrup}', 'Auto: sxem köçürmə tamamlanması')`);
  if (cfg) for (const role of cfg[1]) (grantByRole[role] ??= []).push(kod);
}
out.push("INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES");
out.push(valueRows.join(",\n"));
out.push("ON CONFLICT (kod) DO NOTHING;");
out.push("");

// operativ rol grant-ları (yeni kodlar üçün) — r.ad ilə sistem+klon
for (const [role, codes] of Object.entries(grantByRole)) {
  const inList = codes.map((c) => `'${c}'`).join(", ");
  out.push(`INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
 WHERE lower(r.ad) = '${role}' AND i.kod IN (${inList})
ON CONFLICT (rol_id, icaze_id) DO NOTHING;`);
  out.push("");
}

// ── HİSSƏ 3: tam-giriş rolları bütün kodları alır (platform.admin xaric) ─────
out.push("-- ─── HISSE 3: tam-giriş rolları (sahibkar/admin/director) — hamısı ───");
out.push(`INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
 WHERE lower(r.ad) IN ('sahibkar', 'admin', 'director')
   AND i.kod <> 'platform.admin'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;`);
out.push("");
out.push("COMMIT;");

const result = out.join("\n");
writeFileSync(join(DIR, "2026-06-16-permissions-rebuild.sql"), result, "utf8");
console.log(`Hisse 1 fayllar: ${files.length}`);
console.log(`Hisse 2 qalan kod: ${STILL_MISSING.length}`);
console.log(`Operativ rol grant blokları: ${Object.keys(grantByRole).length}`);
console.log(`Çıxış: ${result.split("\n").length} sətir`);
