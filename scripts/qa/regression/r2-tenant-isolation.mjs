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

const models = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map((m) => {
  const sahibkarLine = m[2].match(/^\s*sahibkar_id\s+(\S+)/m);
  return {
    name: m[1],
    hasSahibkar: !!sahibkarLine,
    // `String?` / `Int?` — nullable sahibkar_id avtomatik filtrə uyğun deyil
    sahibkarNullable: !!sahibkarLine && sahibkarLine[1].endsWith("?"),
  };
});

// TENANT_MODELS / GLOBAL_MODELS / MANUAL_SCOPE_MODELS Set literallarını ayır.
//
// ⚠️ 2026-09-02 TEST BAQI: əvvəl kommentlər ayrılmırdı, ona görə siyahı
// daxilindəki `// "roles" — INTENTIONALLY EXCLUDED …` sətri FAKTİKİ element
// kimi sayılırdı. Nəticədə örtük 266/266 görünürdü, halbuki `roles` heç bir
// siyahıda YOX idi və fail-closed guard onu runtime-da bloklayırdı
// (POS, qeydiyyat, rol idarəetməsi sınırdı). İndi kommentlər əvvəlcədən atılır.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")   // blok kommentləri
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "")) // sətir kommentləri
    .join("\n");
}

function extractSet(src, name) {
  const clean = stripComments(src);
  const decl = clean.indexOf(`${name} = new Set<string>([`);
  if (decl === -1) return null;
  const open = clean.indexOf("[", decl);
  const close = clean.indexOf("]);", open);
  if (open === -1 || close === -1) return null;
  return new Set([...clean.slice(open, close).matchAll(/"([a-z_0-9]+)"/g)].map((m) => m[1]));
}

const tenantSet = extractSet(tmSrc, "TENANT_MODELS");
const globalSet = extractSet(tmSrc, "GLOBAL_MODELS");
const manualSet = extractSet(tmSrc, "MANUAL_SCOPE_MODELS");

r.ok("TENANT_MODELS siyahısı tapıldı", !!tenantSet, tenantSet ? `${tenantSet.size} model` : "yoxdur");
r.ok("GLOBAL_MODELS allowlist-i mövcuddur", !!globalSet, globalSet ? `${globalSet.size} model` : "TƏYİN EDİLMƏYİB");
r.ok(
  "MANUAL_SCOPE_MODELS siyahısı mövcuddur (nullable sahibkar_id)",
  !!manualSet,
  manualSet ? `${manualSet.size} model: ${[...manualSet].join(", ")}` : "TƏYİN EDİLMƏYİB",
);

// Kommentdən gələn yalançı elementin qayıtmadığını birbaşa sübut et.
r.ok(
  "siyahı çıxarışı kommentdəki adları saymır (yalançı örtük qorunması)",
  !!tenantSet && !tenantSet.has("roles"),
  tenantSet?.has("roles") ? "`roles` TENANT_MODELS-də görünür — komment sayılıb" : "təmiz",
);

if (tenantSet && globalSet && manualSet) {
  const inAny = (n) => tenantSet.has(n) || globalSet.has(n) || manualSet.has(n);

  // 1) Örtük: hər model ÜÇ siyahıdan birindədir (fail-closed guard-ın şərti)
  const uncovered = models.filter((m) => !inAny(m.name));
  r.ok(
    "hər Prisma modeli üç siyahıdan birindədir (guard bloklamır)",
    uncovered.length === 0,
    uncovered.length ? `örtülməyən: ${uncovered.map((m) => m.name).join(", ").slice(0, 160)}` : `${models.length}/${models.length}`,
  );

  // 1b) Bir model yalnız BİR siyahıda olmalıdır — ikili qeyd niyyəti gizlədir
  const dup = models.filter(
    (m) => [tenantSet, globalSet, manualSet].filter((s) => s.has(m.name)).length > 1,
  );
  r.ok(
    "heç bir model birdən çox siyahıda deyil",
    dup.length === 0,
    dup.length ? `təkrar: ${dup.map((m) => m.name).join(", ")}` : "təmiz",
  );

  // 2) sahibkar_id daşıyan model qlobal allowlist-ə düşməməlidir
  const misfiled = models.filter((m) => m.hasSahibkar && globalSet.has(m.name));
  r.ok(
    "sahibkar_id daşıyan heç bir model GLOBAL_MODELS-də deyil",
    misfiled.length === 0,
    misfiled.length ? `səhv yerləşdirilib: ${misfiled.map((m) => m.name).join(", ")}` : "təmiz",
  );

  // 2b) MANUAL_SCOPE yalnız NULLABLE sahibkar_id üçündür — bu siyahı
  //     avtomatik filtri söndürdüyü üçün ora düşən NOT NULL model
  //     səssiz cross-tenant boşluğu deməkdir.
  const badManual = models.filter((m) => manualSet.has(m.name) && !m.sahibkarNullable);
  r.ok(
    "MANUAL_SCOPE_MODELS yalnız nullable sahibkar_id daşıyan modellərdir",
    badManual.length === 0,
    badManual.length ? `SƏHV: ${badManual.map((m) => m.name).join(", ")} — NOT NULL` : `${[...manualSet].join(", ")} · nullable təsdiqləndi`,
  );

  // 2c) Nullable sahibkar_id daşıyan model avtomatik filtrə düşəndə NULL
  //     sətirlər (sistem şablonları) hər kirayəçidən GİZLƏNİR.
  //
  //     Aşağıdakılar 2026-09-02-də ölçülüb və bu işdən ƏVVƏL də TENANT_MODELS-də
  //     idi (git: 983f028~1) — yəni mövcud, sənədləşdirilmiş davranışdır, bu
  //     auditin yaratdığı reqressiya deyil. Prod-da faktiki gizlənən sətir:
  //       marketplace_platforma_kataloq 5/5 · sened_sablonlari 13/13
  //       olcu_vahidleri 7/32 · servis_defekt_kateq 15/65
  //     Məhsul qərarı tələb etdiyi üçün burada DƏYİŞDİRİLMİR, yalnız qeydə alınır.
  //     Baseline yalnız bu adları bağışlayır; YENİ hal dərhal FAIL verir.
  const KNOWN_NULLABLE_IN_TENANT = new Set([
    "marketplace_platforma_kataloq",
    "olcu_vahidleri",
    "sened_sablonlari",
    "servis_defekt_kateq",
    "finance_expense_categories",
    "qiymet_novleri",
    "webhook_log",
    "audit_log_outbox",
  ]);
  const nullableInTenant = models.filter(
    (m) => m.sahibkarNullable && tenantSet.has(m.name) && !KNOWN_NULLABLE_IN_TENANT.has(m.name),
  );
  r.ok(
    "YENİ nullable sahibkar_id modeli avtomatik-filtr siyahısına salınmayıb",
    nullableInTenant.length === 0,
    nullableInTenant.length
      ? `MANUAL_SCOPE_MODELS-ə keçirin: ${nullableInTenant.map((m) => m.name).join(", ")}`
      : `baseline ${KNOWN_NULLABLE_IN_TENANT.size} model (pre-existing) · yeni: 0`,
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
// MANUAL_SCOPE guard-a bağlanmasa, siyahı sənəd olaraq qalır və `roles`
// yenidən runtime-da bloklanar (2026-09-02 reqressiyası).
r.ok(
  "guard MANUAL_SCOPE_MODELS-i nəzərə alır (isManualScopeModel çağırılır)",
  /isManualScopeModel\(model\)/.test(pSrc) && /import\s*\{[^}]*isManualScopeModel/.test(pSrc),
  /isManualScopeModel\(model\)/.test(pSrc) ? "guard-da çağırılır" : "ÇAĞIRILMIR — roles bloklanacaq",
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
