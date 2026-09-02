/**
 * REGRESSION R6 — Sənəd nömrəsi parseri (UNIT test, DB tələb etmir).
 *
 * Audit 2026-09-01 · prod read-only preflight nəticəsində aşkarlanan bütün
 * real formatlar burada təsbit olunur. Parser dəyişsə və hər hansı format
 * sinfini itirsə, bu test tutur.
 *
 * Üç sinif:
 *   sequential — mərkəzi sayğacdan, MAX hesablamasına DAXİL
 *   external   — kənar/təsadüfi mənbə, sayğaca DAXİL DEYİL
 *   unknown    — nə parse olunur, nə tanınır → preflight DAYANDIRIR
 *
 * İşlət: npx tsx scripts/qa/regression/r6-doc-number-parser.ts
 */
import { parseDocNumber, countsTowardCounter } from "@/lib/db/sened-nomre";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) pass++; else fail++;
  console.log(`  ${c ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`);
};

console.log("\n━━━ R6 · Sənəd nömrəsi parseri (unit) ━━━");

type Case = {
  nomre: string;
  cls: "sequential" | "external" | "unknown";
  counter?: string | null;
  year?: number | null;
  seq?: number | null;
  note: string;
};

/* ── PROD-da FAKTİKİ mövcud formatlar (2026-09-01 read-only preflight) ── */
const PROD_REAL: Case[] = [
  { nomre: "SATIS-2026-202600015", cls: "sequential", counter: "satis", year: 2026, seq: 202600015, note: "cari nextDocNumber" },
  { nomre: "SS-2026-00006", cls: "sequential", counter: "satis", year: 2026, seq: 6, note: "köhnə sistem" },
  { nomre: "WS-2026-00008", cls: "sequential", counter: "satis", year: 2026, seq: 8, note: "köhnə web satış" },
  { nomre: "POS-202600012", cls: "sequential", counter: "satis", year: 2026, seq: 202600012, note: "İKİ SEQMENTLİ köhnə POS" },
  { nomre: "AS-2026-00005", cls: "sequential", counter: "alis", year: 2026, seq: 5, note: "satınalma sifarişi" },
  { nomre: "SR-2026-00007", cls: "sequential", counter: "servis", year: 2026, seq: 7, note: "servis qeydi" },
  { nomre: "CT-2026-563102", cls: "external", counter: null, note: "çatdırma — təsadüfi dəyər" },
  { nomre: "CT-WEB-1777941532471", cls: "external", counter: null, note: "çatdırma — web/timestamp" },
  { nomre: "RZ-2026-902190", cls: "external", counter: null, note: "rezerv — təsadüfi dəyər" },
];

/* ── Lokal bazada mövcud əlavə formatlar ── */
const LOCAL_REAL: Case[] = [
  { nomre: "ALIS-2026-000001", cls: "sequential", counter: "alis", year: 2026, seq: 1, note: "standart alış" },
  { nomre: "ALS-2026-00001", cls: "sequential", counter: "alis", year: 2026, seq: 1, note: "köhnə alış prefiksi" },
  { nomre: "MARKET-2026-000001", cls: "sequential", counter: "market", year: 2026, seq: 1, note: "AYRI namespace" },
  { nomre: "TR-2026-00001", cls: "sequential", counter: "transfer", year: 2026, seq: 1, note: "transfer" },
];

/* ── Kodda mövcud, prod-da hələ yaranmamış formatlar ── */
const CODE_FORMATS: Case[] = [
  { nomre: "WH-WOLT-12345", cls: "external", counter: null, note: "marketplace webhook — funksional açar" },
  { nomre: "WH-BIRMARKET-ORD-99", cls: "external", counter: null, note: "webhook, mürəkkəb external_id" },
  { nomre: "LEAD-2605-1234", cls: "external", counter: null, note: "köhnə CRM random formatı" },
  { nomre: "KREDIT-2026-000003", cls: "sequential", counter: "kredit", year: 2026, seq: 3, note: "AYRI namespace" },
  { nomre: "TEKLIF-2026-000001", cls: "sequential", counter: "teklif", year: 2026, seq: 1, note: "təklif" },
  { nomre: "INV-2026-00002", cls: "sequential", counter: "sayim", year: 2026, seq: 2, note: "inventarizasiya" },
];

/* ── NAMƏLUM — preflight bunlarda DAYANMALIDIR ── */
const MUST_FAIL: Case[] = [
  { nomre: "AS-1777941532471-0", cls: "unknown", note: "köhnə Date.now() formatı (artıq generasiya olunmur)" },
  { nomre: "ZZZ-2026-000001", cls: "unknown", note: "tanınmayan prefiks" },
  { nomre: "BOZUK", cls: "unknown", note: "defis yoxdur" },
  { nomre: "", cls: "unknown", note: "boş" },
  { nomre: "2026-000001", cls: "unknown", note: "prefiks yoxdur" },
  { nomre: "satis-2026-000001", cls: "unknown", note: "kiçik hərf — prefiks tanınmır" },
];

for (const [group, cases] of [
  ["PROD-da faktiki formatlar", PROD_REAL],
  ["lokal bazadakı formatlar", LOCAL_REAL],
  ["kodda mövcud formatlar", CODE_FORMATS],
  ["NAMƏLUM (dayandırıcı)", MUST_FAIL],
] as const) {
  console.log(`\n  ── ${group} ──`);
  for (const c of cases) {
    const p = parseDocNumber(c.nomre);
    const label = `«${c.nomre || "(boş)"}» → ${c.cls}`;
    let good = p.cls === c.cls;
    let detail = c.note;
    if (good && c.counter !== undefined) {
      good = p.counterPrefix === c.counter;
      if (!good) detail = `counter gözlənilən=${c.counter}, alınan=${p.counterPrefix}`;
    }
    if (good && c.year !== undefined) {
      good = p.year === c.year;
      if (!good) detail = `il gözlənilən=${c.year}, alınan=${p.year}`;
    }
    if (good && c.seq !== undefined) {
      good = p.seq === c.seq;
      if (!good) detail = `sıra gözlənilən=${c.seq}, alınan=${p.seq}`;
    }
    if (!good && p.cls !== c.cls) detail = `sinif gözlənilən=${c.cls}, alınan=${p.cls}`;
    ok(label, good, detail);
  }
}

/* ── countsTowardCounter: yalnız sequential sayılmalıdır ── */
console.log("\n  ── sayğaca daxiletmə qaydası ──");
for (const c of [...PROD_REAL, ...LOCAL_REAL, ...CODE_FORMATS, ...MUST_FAIL]) {
  const expected = c.cls === "sequential";
  ok(`«${c.nomre || "(boş)"}» sayğaca ${expected ? "DAXİL" : "daxil DEYİL"}`,
     countsTowardCounter(c.nomre) === expected);
}

/* ── Kritik invariant: external nömrə sayğacı sıçratmamalıdır ── */
console.log("\n  ── kritik invariant ──");
const bigExternal = ["RZ-2026-902190", "CT-2026-563102", "LEAD-2605-9999"];
ok("böyük dəyərli external nömrələr sayğaca girmir (sıçrayış qorunması)",
   bigExternal.every((n) => !countsTowardCounter(n)),
   "RZ-902190 / CT-563102 sayğacı yüz minlərlə irəli aparardı");

console.log(`\n  ─── ${pass} keçdi, ${fail} uğursuz\n`);
process.exit(fail > 0 ? 1 : 0);
