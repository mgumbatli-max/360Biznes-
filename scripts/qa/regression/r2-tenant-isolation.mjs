/**
 * REGRESSION R2 — Tenant izolyasiyası fail-CLOSED olmalıdır.
 *
 * AUDİT TAPINTISI (təsdiqlənib):
 *   lib/db/prisma.ts — `if (!isTenantModel(model)) return query(args);`
 *   Yəni əl ilə yazılmış TENANT_MODELS siyahısında olmayan model üçün nə
 *   sahibkar_id filtri, nə də xəta var — sorğu FİLTRSİZ icra olunur (fail-OPEN).
 *   Ölçüldü: 228 model sahibkar_id daşıyır, siyahıda 217 var → 11 model
 *   tamamilə qorumasız: team_kanal, team_mesaj_log, team_ayar,
 *   satinalma_teklif, filial_mesaj, filial_gorunush, sened_nomre_counter,
 *   audit_log_outbox, vezifeler, defekt_qeydleri, mobil_refresh_tokens.
 *
 * BU TEST NƏ YOXLAYIR:
 *   1. Örtük: schema.prisma-dakı HƏR model ya TENANT_MODELS, ya GLOBAL_MODELS-dədir
 *   2. sahibkar_id daşıyan heç bir model GLOBAL_MODELS allowlist-ində deyil
 *   3. Əvvəl kənarda qalan 11 modelin hamısı indi TENANT_MODELS-dədir
 *   4. Extension fail-CLOSED-dır: tanınmayan model üçün throw edir
 *   5. Adversarial (canlı DB): Tenant A kontekstində Tenant B-nin sətirləri
 *      OXUNA / DƏYİŞDİRİLƏ / SİLİNƏ bilmir — id bilinsə belə
 *
 * Yazma cəhdləri tranzaksiya içindədir və HƏMİŞƏ rollback olunur.
 */
import { connect, read, createRunner, twoTenants } from "./_lib.mjs";

const PREVIOUSLY_UNGUARDED = [
  "team_kanal",
  "team_mesaj_log",
  "team_ayar",
  "satinalma_teklif",
  "filial_mesaj",
  "filial_gorunush",
  "sened_nomre_counter",
  "audit_log_outbox",
  "vezifeler",
  "defekt_qeydleri",
  "mobil_refresh_tokens",
];

const r = createRunner("R2 · Tenant izolyasiyası fail-closed");

/* ── Statik təhlil ── */
const schema = read("prisma/schema.prisma");
const tmSrc = read("lib/db/tenant-models.ts");

const models = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map((m) => ({
  name: m[1],
  hasSahibkar: /^\s*sahibkar_id\s/m.test(m[2]),
}));

// TENANT_MODELS və GLOBAL_MODELS Set literallarını mənbədən ayır.
// `export const NAME = new Set<string>([ … ]);` blokunun DAXİLİNİ götürür —
// kommentlərdəki və funksiya gövdəsindəki adlar sayılmasın deyə sərhədlər
// dəqiq `new Set<string>([` … `]);` cütü ilə müəyyən edilir.
function extractSet(src, name) {
  const decl = src.indexOf(`${name} = new Set<string>([`);
  if (decl === -1) return null;
  const open = src.indexOf("[", decl);
  const close = src.indexOf("]);", open);
  if (open === -1 || close === -1) return null;
  return new Set([...src.slice(open, close).matchAll(/"([a-z_0-9]+)"/g)].map((m) => m[1]));
}

const tenantSet = extractSet(tmSrc, "TENANT_MODELS");
const globalSet = extractSet(tmSrc, "GLOBAL_MODELS");

r.ok("TENANT_MODELS siyahısı tapıldı", !!tenantSet, tenantSet ? `${tenantSet.size} model` : "yoxdur");
r.ok("GLOBAL_MODELS allowlist-i mövcuddur", !!globalSet, globalSet ? `${globalSet.size} model` : "TƏYİN EDİLMƏYİB");

if (tenantSet && globalSet) {
  // 1) Örtük: hər model bir siyahıdadır
  const uncovered = models.filter((m) => !tenantSet.has(m.name) && !globalSet.has(m.name));
  r.ok(
    "hər Prisma modeli ya tenant, ya qlobal siyahıdadır",
    uncovered.length === 0,
    uncovered.length ? `örtülməyən: ${uncovered.map((m) => m.name).join(", ").slice(0, 160)}` : `${models.length}/${models.length}`,
  );

  // 2) sahibkar_id daşıyan model qlobal allowlist-ə düşməməlidir
  const misfiled = models.filter((m) => m.hasSahibkar && globalSet.has(m.name));
  r.ok(
    "sahibkar_id daşıyan heç bir model GLOBAL_MODELS-də deyil",
    misfiled.length === 0,
    misfiled.length ? `səhv yerləşdirilib: ${misfiled.map((m) => m.name).join(", ")}` : "təmiz",
  );

  // 3) əvvəl qorumasız qalan 11 model
  const stillOut = PREVIOUSLY_UNGUARDED.filter((n) => !tenantSet.has(n));
  r.ok(
    "əvvəl qorumasız qalan 11 model indi TENANT_MODELS-dədir",
    stillOut.length === 0,
    stillOut.length ? `hələ kənarda: ${stillOut.join(", ")}` : "11/11",
  );
}

/* ── 4) Extension fail-CLOSED davranışı ── */
const pSrc = read("lib/db/prisma.ts");
const failOpen = /if\s*\(\s*!isTenantModel\(model\)\s*\)\s*return\s+query\(args\)/.test(pSrc);
r.ok(
  "extension tanınmayan model üçün filtrsiz keçmir (fail-open qalmayıb)",
  !failOpen,
  failOpen ? "hələ `if (!isTenantModel(model)) return query(args)` var" : "silinib",
);
r.ok(
  "extension tanınmayan model üçün throw edir (fail-closed)",
  /isGlobalModel|tenant-guard.*(tanınmayan|unknown)/i.test(pSrc) && /throw new Error/.test(pSrc),
  "GLOBAL_MODELS yoxlaması + throw",
);

/* ── 5) Test datasının mövcudluğu (adversarial ORM testi r2b-dədir) ── */
const c = await connect();
try {
  const { a, b } = await twoTenants(c);
  console.log(`  · Tenant A = ${String(a.id).slice(0, 8)} · Tenant B = ${String(b.id).slice(0, 8)}`);

  const withData = [];
  for (const tbl of PREVIOUSLY_UNGUARDED) {
    const exists = await c.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`public.${tbl}`]);
    if (!exists.rows[0]?.ok) continue;
    const n = await c.query(
      `SELECT COUNT(*)::int AS n FROM ${tbl} WHERE sahibkar_id = $1::uuid`,
      [b.id],
    );
    if (n.rows[0].n > 0) withData.push(`${tbl}(${n.rows[0].n})`);
  }
  console.log(
    `  · B tenantında data olan modellər: ${withData.length ? withData.join(", ") : "yoxdur"}`,
  );
  console.log("  · Canlı ORM adversarial testi: r2b-tenant-adversarial.ts");
} finally {
  await c.end();
}

const { fail } = r.summary();
process.exit(fail > 0 ? 1 : 0);
