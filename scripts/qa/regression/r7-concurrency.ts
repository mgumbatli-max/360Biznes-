/**
 * REGRESSION R7 — Nömrə generatorunun CONCURRENCY/RACE testi.
 *
 * Sual: eyni anda N sorğu gəlsə, ikisi eyni sənəd nömrəsini ala bilərmi?
 *
 * Köhnə generatorlar (`findFirst + max+1`, `count()+1`, `Date.now()`, `random`)
 * bu testdə mütləq uğursuz olardı — hamısı oxu ilə yazı arasında pəncərə
 * buraxırdı. `nextDocNumber` isə `sened_nomre_counter` üzərində atomik
 * `INSERT … ON CONFLICT DO UPDATE … RETURNING` işlədir, yəni nömrə DB-nin
 * özündə, tək ifadə daxilində ayrılır.
 *
 * TƏHLÜKƏSİZLİK: test yalnız LOKAL bazada işləyir (prod URL rədd edilir),
 * müvəqqəti sayğac namespace-indən istifadə edir və sonda onu təmizləyir.
 * Heç bir biznes cədvəlinə toxunmur.
 *
 * İşlət: npx tsx scripts/qa/regression/r7-concurrency.ts
 */
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant-context";
import { nextDocNumber, parseDocNumber } from "@/lib/db/sened-nomre";

const PARALLEL = 40;
/** Test üçün istifadə olunan namespace — real sənəd axınında işlədilmir. */
const TEST_PREFIX = "mexaric" as const;

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) pass++; else fail++;
  console.log(`  ${c ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`);
};

async function main() {
  console.log("\n━━━ R7 · Nömrə generatoru concurrency/race ━━━");

  // Prod bazasına qarşı işləməyi qəti qadağan et
  const host = (process.env.DATABASE_URL ?? "").match(/@([^/:]+)/)?.[1] ?? "";
  const dbHost = await prismaUnscoped.$queryRaw<{ h: string }[]>`SELECT inet_server_addr()::text AS h`
    .catch(() => [{ h: "" }]);
  const version = await prismaUnscoped.$queryRaw<{ v: string }[]>`SELECT version() AS v`;
  const isLocal = /homebrew|darwin/i.test(version[0].v) || /localhost|127\.0\.0\.1/.test(host) || !dbHost[0].h;
  ok("test LOKAL bazada işləyir (prod qorunur)", isLocal,
     isLocal ? version[0].v.split(" ").slice(0, 2).join(" ") : "PROD AŞKARLANDI — dayandırılır");
  if (!isLocal) { await prisma.$disconnect(); await prismaUnscoped.$disconnect(); process.exit(1); }

  const tenant = await prismaUnscoped.sahibkarlar.findFirst({ select: { id: true } });
  if (!tenant) { console.log("  ⚠️ tenant tapılmadı"); process.exit(1); }
  const ctx = {
    sahibkarId: tenant.id,
    istifadeciId: "00000000-0000-0000-0000-000000000000",
    rolId: 1, rolAd: "sahibkar", icazeler: [] as string[],
  };

  const year = new Date().getFullYear();
  // Başlanğıc vəziyyəti təmizlə (əvvəlki test qalığı)
  await prismaUnscoped.sened_nomre_counter.deleteMany({
    where: { sahibkar_id: tenant.id, prefix: TEST_PREFIX, il: year },
  });

  /* ── 1) N paralel çağırış — hamısı UNİKAL nömrə almalıdır ── */
  console.log(`  · ${PARALLEL} paralel nextDocNumber çağırışı…`);
  const results = await Promise.all(
    Array.from({ length: PARALLEL }, () =>
      runWithTenant(ctx, async () => nextDocNumber(prisma, tenant.id, TEST_PREFIX)),
    ),
  );
  const unique = new Set(results);
  ok("bütün nömrələr unikaldır (dublikat yoxdur)", unique.size === PARALLEL,
     `${unique.size}/${PARALLEL} unikal` + (unique.size < PARALLEL
       ? ` — TƏKRARLANAN: ${results.filter((r, i) => results.indexOf(r) !== i).slice(0, 3).join(", ")}`
       : ""));

  /* ── 2) Ardıcıllıq fasiləsiz olmalıdır (1..N) ── */
  const seqs = results.map((r) => parseDocNumber(r).seq).filter((s): s is number => s !== null).sort((a, b) => a - b);
  const contiguous = seqs.length === PARALLEL && seqs[0] === 1 && seqs[PARALLEL - 1] === PARALLEL;
  ok("ardıcıllıq fasiləsizdir (1…N, boşluq yoxdur)", contiguous,
     seqs.length ? `${seqs[0]}…${seqs[seqs.length - 1]}` : "parse olunmadı");

  /* ── 3) Sayğac dəqiq N-ə bərabər olmalıdır ── */
  const counter = await prismaUnscoped.sened_nomre_counter.findFirst({
    where: { sahibkar_id: tenant.id, prefix: TEST_PREFIX, il: year },
    select: { son_nomre: true },
  });
  ok("sayğac dəqiq N-ə bərabərdir (itki/artıqlıq yoxdur)", counter?.son_nomre === PARALLEL,
     `sayğac=${counter?.son_nomre ?? "yox"}, gözlənilən=${PARALLEL}`);

  /* ── 4) Hamısı düzgün parse olunur və sequential sinfindədir ── */
  const allSequential = results.every((r) => parseDocNumber(r).cls === "sequential");
  ok("bütün yaradılan nömrələr «sequential» sinfindədir", allSequential);

  /* ── 5) İkinci dalğa əvvəlkinin üstündən davam edir (kəsişmə yoxdur) ── */
  const wave2 = await Promise.all(
    Array.from({ length: 10 }, () =>
      runWithTenant(ctx, async () => nextDocNumber(prisma, tenant.id, TEST_PREFIX)),
    ),
  );
  const overlap = wave2.filter((n) => unique.has(n));
  ok("ikinci dalğa birinci ilə kəsişmir", overlap.length === 0,
     overlap.length ? `kəsişən: ${overlap.join(", ")}` : `${wave2.length} yeni nömrə`);

  /* ── 6) Tenant izolyasiyası: ikinci tenant öz ardıcıllığını alır ── */
  const t2 = await prismaUnscoped.sahibkarlar.findFirst({
    where: { id: { not: tenant.id } }, select: { id: true },
  });
  if (t2) {
    await prismaUnscoped.sened_nomre_counter.deleteMany({
      where: { sahibkar_id: t2.id, prefix: TEST_PREFIX, il: year },
    });
    const ctx2 = { ...ctx, sahibkarId: t2.id };
    const other = await runWithTenant(ctx2, async () => nextDocNumber(prisma, t2.id, TEST_PREFIX));
    ok("ikinci tenant öz sayğacından 1-dən başlayır (tenant izolyasiyası)",
       parseDocNumber(other).seq === 1, `${other}`);
    ok("iki tenant EYNİ nömrəni ala bilir (composite unique tələbi)",
       results.includes(other) || parseDocNumber(other).seq === 1,
       "ayrı sayğac məkanı");
    await prismaUnscoped.sened_nomre_counter.deleteMany({
      where: { sahibkar_id: t2.id, prefix: TEST_PREFIX, il: year },
    });
  } else {
    console.log("  · ikinci tenant yoxdur — izolyasiya yoxlaması atlandı");
  }

  /* ── Təmizlik ── */
  await prismaUnscoped.sened_nomre_counter.deleteMany({
    where: { sahibkar_id: tenant.id, prefix: TEST_PREFIX, il: year },
  });
  console.log("  · test sayğacı təmizləndi (biznes cədvəllərinə toxunulmadı)");

  console.log(`\n  ─── ${pass} keçdi, ${fail} uğursuz\n`);
  await prisma.$disconnect();
  await prismaUnscoped.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("TEST XƏTASI:", e);
  await prisma.$disconnect().catch(() => {});
  await prismaUnscoped.$disconnect().catch(() => {});
  process.exit(1);
});
