/**
 * REGRESSION R8 — zemanetler.unikal_kod tenant-scoped + race-safe.
 *
 * Audit 2026-09-02: `unikal_kod` qlobal UNIQUE idi və iki race-unsafe
 * generator işlədirdi (nextUnikalKod max+1 → 1/20 unikal; POS Math.random
 * + skipDuplicates → səssiz itki). Bu test hər ikisinin həllini qoruyur.
 *
 * TƏHLÜKƏSİZLİK: yalnız LOKAL baza; yaratdığı hər sətri silir.
 */
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant-context";
import { nextDocNumber, parseDocNumber } from "@/lib/db/sened-nomre";
import { randomBytes } from "node:crypto";

const PARALLEL = 25;
let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) pass++; else fail++;
  console.log(`  ${c ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`);
};

async function main() {
  console.log("\n━━━ R8 · zemanet tenant-scoped + race ━━━");
  const v = await prismaUnscoped.$queryRaw<{ v: string }[]>`SELECT version() AS v`;
  ok("LOKAL baza (prod qorunur)", /homebrew|darwin/i.test(v[0].v));
  if (!/homebrew|darwin/i.test(v[0].v)) process.exit(1);

  /* 1) Schema: composite var, qlobal yoxdur, qr_token qlobal qalır */
  const idx = await prismaUnscoped.$queryRaw<{ i: string; cols: string }[]>`
    SELECT i.relname i, (SELECT string_agg(a.attname::text,',' ORDER BY k.ord)
      FROM unnest(ix.indkey) WITH ORDINALITY k(attnum,ord)
      JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum) cols
    FROM pg_index ix JOIN pg_class i ON i.oid=ix.indexrelid JOIN pg_class t ON t.oid=ix.indrelid
    WHERE t.relname='zemanetler' AND ix.indisunique`;
  ok("composite UNIQUE(sahibkar_id, unikal_kod) var",
     idx.some(r => r.cols === "sahibkar_id,unikal_kod"));
  ok("qlobal UNIQUE(unikal_kod) qalmayıb", !idx.some(r => r.cols === "unikal_kod"));
  ok("qr_token qlobal UNIQUE olaraq QALIR", idx.some(r => r.cols === "qr_token"));

  /* 2) Parser: Z sequential sinfindədir */
  const p = parseDocNumber("Z-2026-00042");
  ok("parser: Z-YYYY-NNNNN → sequential/zemanet", p.cls === "sequential" && p.counterPrefix === "zemanet",
     `${p.cls}/${p.counterPrefix}`);

  /* 3) Generatorlar mərkəzləşdirilib */
  const fs = await import("node:fs");
  const za = fs.readFileSync("features/servis/zemanet-actions.ts", "utf8");
  const px = fs.readFileSync("features/pos/extras-actions.ts", "utf8");
  ok("zemanet-actions: nextUnikalKod() qalmayıb", !/async function nextUnikalKod/.test(za));
  ok("zemanet-actions: nextDocNumber(\"zemanet\") işlədir", /nextDocNumber\([^)]*"zemanet"\)/.test(za));
  ok("POS: Math.random ilə kod qalmayıb", !/unikal_kod:\s*code/.test(px) && !/Math\.random\(\)\.toString\(36\)\.slice\(2,\s*8\)/.test(px));
  ok("POS: nextDocNumber(\"zemanet\") işlədir", /nextDocNumber\([^)]*"zemanet"\)/.test(px));
  // Kommentləri çıxarırıq — sənəddəki «skipDuplicates götürüldü» izahı
  // yanlış müsbət verirdi. Yalnız FAKTİKİ kod yoxlanılır.
  const pxCode = px.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  ok("POS: skipDuplicates workaround-u götürülüb", !/skipDuplicates/.test(pxCode));
  ok("POS: createMany nəticəsi yoxlanılır (səssiz itki qorunması)",
     /created\.count\s*!==\s*zemanetRows\.length/.test(pxCode));

  /* 4) Tenant izolyasiyası + race — REAL sətirlərlə */
  const tenants = await prismaUnscoped.sahibkarlar.findMany({ select: { id: true }, take: 2 });
  if (tenants.length < 2) { console.log("  ⚠️ iki tenant yoxdur"); process.exit(1); }
  const [A, B] = tenants;
  const year = new Date().getFullYear();
  const mk = (id: string) => ({ sahibkarId: id, istifadeciId: "00000000-0000-0000-0000-000000000000",
                                rolId: 1, rolAd: "sahibkar", icazeler: [] as string[] });
  const cleanup = async () => {
    await prismaUnscoped.zemanetler.deleteMany({ where: { mehsul_ad: "__R8_TEST__" } });
    for (const t of [A, B]) await prismaUnscoped.sened_nomre_counter.deleteMany({
      where: { sahibkar_id: t.id, prefix: "zemanet", il: year } });
  };
  await cleanup();

  const row = (sid: string, kod: string) => ({
    sahibkar_id: sid, unikal_kod: kod, qr_token: randomBytes(30).toString("hex").slice(0, 60),
    musteri_ad: "__R8__", mehsul_ad: "__R8_TEST__",
    baslama_tarixi: new Date(), bitme_tarixi: new Date(Date.now() + 86400000),
    ay_sayi: 12, status: "aktiv",
  });

  // tenant A → Z-YYYY-00001
  const kodA = await runWithTenant(mk(A.id), () => nextDocNumber(prisma, A.id, "zemanet"));
  await prismaUnscoped.zemanetler.create({ data: row(A.id, kodA) });
  ok(`tenant A ${kodA} yarada bilir`, kodA === `Z-${year}-00001`, kodA);

  // tenant B → EYNİ kod
  const kodB = await runWithTenant(mk(B.id), () => nextDocNumber(prisma, B.id, "zemanet"));
  let bOk = false;
  try { await prismaUnscoped.zemanetler.create({ data: row(B.id, kodB) }); bOk = true; } catch { /* */ }
  ok(`tenant B EYNİ ${kodB} yarada bilir`, bOk && kodB === kodA, `${kodB} · ${bOk ? "yaradıldı" : "BLOKLANDI"}`);

  // tenant A daxilində təkrar → BLOKLANMALIDIR
  let blocked = false;
  try { await prismaUnscoped.zemanetler.create({ data: row(A.id, kodA) }); }
  catch (e) { blocked = /duplicate key|unique/i.test((e as Error).message); }
  ok("tenant A daxilində ikinci eyni kod BLOKLANIR", blocked);

  /* 5) Concurrency */
  const codes = await Promise.all(Array.from({ length: PARALLEL }, () =>
    runWithTenant(mk(A.id), () => nextDocNumber(prisma, A.id, "zemanet"))));
  const uniq = new Set(codes);
  ok("paralel çağırışlar unikal kod verir", uniq.size === PARALLEL, `${uniq.size}/${PARALLEL}`);
  const seqs = codes.map(c2 => parseDocNumber(c2).seq!).sort((a, b) => a - b);
  ok("ardıcıllıq fasiləsizdir", seqs[seqs.length - 1] - seqs[0] === PARALLEL - 1, `${seqs[0]}…${seqs[seqs.length - 1]}`);

  /* 6) Counter consistency */
  const cnt = await prismaUnscoped.sened_nomre_counter.findFirst({
    where: { sahibkar_id: A.id, prefix: "zemanet", il: year }, select: { son_nomre: true } });
  ok("sayğac düzgün irəliləyib", cnt?.son_nomre === PARALLEL + 1, `sayğac=${cnt?.son_nomre}, gözlənilən=${PARALLEL + 1}`);

  await cleanup();
  console.log("  · test datası təmizləndi");
  console.log(`\n  ─── ${pass} keçdi, ${fail} uğursuz ───\n`);
  await prisma.$disconnect(); await prismaUnscoped.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}
main().catch(async e => { console.error("XƏTA:", e);
  await prisma.$disconnect().catch(()=>{}); await prismaUnscoped.$disconnect().catch(()=>{}); process.exit(1); });
