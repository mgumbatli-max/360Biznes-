/**
 * REGRESSION R2b — CANLI ORM üzərində cross-tenant adversarial test.
 *
 * R2 statik örtüyü yoxlayır; bu test isə əsl Prisma client ilə real hücum
 * ssenarisini icra edir: Tenant A kontekstində Tenant B-nin sətirlərini
 * OXUMAQ, DƏYİŞMƏK və SİLMƏK cəhdi — hədəf sətrin id-si BİLİNDİYİ halda.
 *
 * Gözlənilən davranış (fix sonrası):
 *   • findMany  → B-nin heç bir sətri qayıtmır
 *   • findFirst({where:{id: B_id}}) → null
 *   • updateMany({where:{id: B_id}}) → count 0
 *   • deleteMany({where:{id: B_id}}) → count 0
 *   • siyahıda olmayan model → throw (fail-closed)
 *
 * TƏHLÜKƏSİZLİK: bütün yazma cəhdləri `$transaction` daxilindədir və
 * sonda qəsdən atılan xəta ilə ROLLBACK olunur. Filtr işləməsə belə
 * production datası dəyişmir.
 *
 * İşlət: npx tsx scripts/qa/regression/r2b-tenant-adversarial.ts
 */
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant-context";

const ROLLBACK = "__regression_rollback__";

/** Əvvəl tenant filtrindən kənarda qalmış, `id` sütunu olan modellər. */
const TARGETS = [
  "team_kanal",
  "team_mesaj_log",
  "team_ayar",
  "satinalma_teklif",
  "filial_mesaj",
  "filial_gorunush",
  "audit_log_outbox",
  "vezifeler",
  "defekt_qeydleri",
  "mobil_refresh_tokens",
] as const;

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const model = (client: any, name: string) => client[name];

async function main() {
  console.log("\n━━━ R2b · Cross-tenant adversarial (canlı ORM) ━━━");

  const tenants = await prismaUnscoped.sahibkarlar.findMany({
    select: { id: true, ad: true },
    orderBy: { id: "asc" },
  });
  if (tenants.length < 2) {
    console.log("  ⚠️  İki tenant tapılmadı — test icra edilə bilmir");
    process.exit(1);
  }
  console.log(`  · ${tenants.length} tenant mövcuddur`);

  const mkCtx = (sahibkarId: string) => ({
    sahibkarId,
    istifadeciId: "00000000-0000-0000-0000-000000000000",
    rolId: 1,
    rolAd: "sahibkar",
    icazeler: [] as string[],
  });

  let covered = 0;

  for (const name of TARGETS) {
    // Hər model üçün REAL data daşıyan qurban sətri tap (guard-sız client ilə),
    // sonra hücumçu kimi ONDAN FƏRQLİ tenantı seç. Belə ki, test boş tenant
    // seçilməsi ucbatından yalançı "keçdi" verməsin.
    let victim: { id: string; sahibkar_id: string } | null = null;
    try {
      victim = await model(prismaUnscoped, name).findFirst({
        select: { id: true, sahibkar_id: true },
      });
    } catch {
      continue; // modeldə `id` sütunu yoxdur və ya cədvəl əlçatmazdır
    }
    if (!victim) continue;

    const attacker = tenants.find((t) => t.id !== victim!.sahibkar_id);
    if (!attacker) continue;
    const A = attacker;
    const B = { id: victim.sahibkar_id };
    const ctxA = mkCtx(A.id);
    covered++;
    console.log(
      `  · ${name}: qurban tenant ${B.id.slice(0, 8)}, hücumçu tenant ${A.id.slice(0, 8)}`,
    );

    // ── OXU: id bilinsə belə görünməməlidir ──
    const readBack = await runWithTenant(ctxA, async () =>
      model(prisma, name).findFirst({ where: { id: victim!.id }, select: { id: true } }),
    );
    ok(`${name}: A, B-nin sətrini id ilə OXUYA bilmir`, readBack === null,
       readBack ? `SIZMA — sətir qayıtdı: ${String(readBack.id).slice(0, 8)}` : "null");

    // ── SİYAHI: B-nin sətirləri ümumi siyahıda görünməməlidir ──
    const list = await runWithTenant(ctxA, async () =>
      model(prisma, name).findMany({ select: { id: true }, take: 500 }),
    );
    const leaked = (list as Array<{ id: string }>).some((r) => r.id === victim!.id);
    ok(`${name}: B-nin sətri A-nın siyahısında yoxdur`, !leaked,
       `A-da ${list.length} sətir`);

    // ── DƏYİŞMƏ və SİLMƏ: rollback edilən tranzaksiyada ──
    let updCount = -1;
    let delCount = -1;
    try {
      await prisma.$transaction(async (tx) => {
        await runWithTenant(ctxA, async () => {
          const u = await model(tx, name).updateMany({
            where: { id: victim!.id },
            data: { sahibkar_id: A.id },
          });
          updCount = u.count;
          const d = await model(tx, name).deleteMany({ where: { id: victim!.id } });
          delCount = d.count;
        });
        throw new Error(ROLLBACK);
      });
    } catch (e) {
      if (!(e instanceof Error) || e.message !== ROLLBACK) {
        // Guard throw etdisə bu da qəbul edilən nəticədir
        updCount = updCount === -1 ? 0 : updCount;
        delCount = delCount === -1 ? 0 : delCount;
      }
    }
    ok(`${name}: A, B-nin sətrini DƏYİŞƏ bilmir`, updCount === 0, `updateMany count=${updCount}`);
    ok(`${name}: A, B-nin sətrini SİLƏ bilmir`, delCount === 0, `deleteMany count=${delCount}`);
  }

  if (covered === 0) {
    console.log("  ⚠️  Hədəf modellərin heç birində B tenantına aid sətir tapılmadı");
    fail++;
  } else {
    console.log(`  · ${covered} model üzərində adversarial cəhd icra olundu`);
  }

  // ── Fail-closed: tenant konteksti olmadan tenant modeli sorğusu throw etməlidir ──
  let threw = false;
  try {
    await prisma.team_kanal.findMany({ take: 1 });
  } catch (e) {
    threw = e instanceof Error && /tenant-guard/i.test(e.message);
  }
  ok("tenant konteksti olmadan sorğu bloklanır (fail-closed)", threw);

  /* ── MANUAL_SCOPE: `roles` guard tərəfindən BLOKLANMAMALIDIR ──
   *
   * REQRESSİYA 2026-09-02: `roles` nə TENANT_MODELS, nə GLOBAL_MODELS
   * siyahısında idi; fail-closed guard onu atırdı və POS səhifəsi,
   * qeydiyyat (sistem rollarının klonlanması), rol idarəetməsi və
   * əməkdaşlar modulu sınırdı. Statik örtük testi kommentdəki `"roles"`
   * sözünü saydığı üçün bunu görmürdü. Bu, RUNTIME sübutudur.
   */
  const manualCtx = mkCtx(tenants[0].id);
  let rolesErr: string | null = null;
  let rolesCount = -1;
  try {
    rolesCount = await runWithTenant(manualCtx, () => prisma.roles.count());
  } catch (e) {
    rolesErr = e instanceof Error ? e.message : String(e);
  }
  ok(
    "`roles` sorğusu tenant kontekstində guard tərəfindən bloklanmır",
    rolesErr === null,
    rolesErr ? rolesErr.slice(0, 120) : `count=${rolesCount}`,
  );

  // Sistem rolları (sahibkar_id IS NULL) görünməlidir — avtomatik filtr
  // tətbiq olunsaydı, bunlar itərdi və qeydiyyat klonlaya bilməzdi.
  let sistemRoles = -1;
  try {
    sistemRoles = await runWithTenant(manualCtx, () =>
      prisma.roles.count({ where: { sistem: true } }),
    );
  } catch { /* yuxarıdakı yoxlama xətanı artıq bildirir */ }
  ok(
    "sistem rolları (sahibkar_id NULL) tenant kontekstində görünür",
    sistemRoles > 0,
    `sistem rolu: ${sistemRoles}`,
  );

  console.log(`  ─── ${pass} keçdi, ${fail} uğursuz`);
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
