/**
 * Manual end-to-end test of the auth flow against biznes_360_next.
 * Run with: npx tsx scripts/test-auth-flow.ts
 *
 * What it tests:
 *  1. signupAction logic (replicated inline) creates sahibkar + abune +
 *     modules + istifadeci + filial + anbar + demo_trials in one transaction.
 *  2. The auth.ts authorize() flow can find that user, verify the password,
 *     load role + permissions, and return a SessionUser.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SAHIBKAR_ROLE_ID = 9;
const DEFAULT_PLAN_KOD = "baslangic";
const DEMO_DAYS = 15;

async function runSignup(input: {
  sirket_adi: string;
  email: string;
  telefon: string;
  sifre: string;
}) {
  const email = input.email.toLowerCase().trim();

  const [existingSahibkar, existingUser] = await Promise.all([
    prisma.sahibkarlar.findUnique({ where: { email } }),
    prisma.istifadeciler.findFirst({ where: { email } }),
  ]);
  if (existingSahibkar || existingUser) throw new Error("Email already in use");

  const plan = await prisma.abune_planlari.findUnique({ where: { kod: DEFAULT_PLAN_KOD } });
  if (!plan) throw new Error("Default plan not found");

  const passwordHash = await bcrypt.hash(input.sifre, 12);
  const bitme = new Date();
  bitme.setDate(bitme.getDate() + DEMO_DAYS);
  const bitmeOnlyDate = new Date(bitme.toISOString().slice(0, 10));

  return prisma.$transaction(async (tx) => {
    const sahibkar = await tx.sahibkarlar.create({
      data: {
        ad: input.sirket_adi,
        email,
        telefon: input.telefon,
        status: "aktiv",
      },
    });

    await tx.abuneler.create({
      data: {
        sahibkar_id: sahibkar.id,
        plan_id: plan.id,
        bitme: bitmeOnlyDate,
        novu: "sinaq",
        status: "aktiv",
      },
    });

    const modullar = await tx.modullar.findMany({ where: { aktiv: true } });
    if (modullar.length) {
      await tx.sahibkar_modullar.createMany({
        data: modullar.map((m) => ({
          sahibkar_id: sahibkar.id,
          modul_kod: m.kod,
          aktiv: true,
          bitme: bitmeOnlyDate,
        })),
        skipDuplicates: true,
      });
    }

    const user = await tx.istifadeciler.create({
      data: {
        ad_soyad: input.sirket_adi,
        email,
        telefon: input.telefon,
        sifre_hash: passwordHash,
        rol_id: SAHIBKAR_ROLE_ID,
        sahibkar_id: sahibkar.id,
        aktiv: true,
      },
    });

    const filial = await tx.filiallar.create({
      data: {
        sahibkar_id: sahibkar.id,
        ad: `${input.sirket_adi} — Mərkəzi filial`.slice(0, 100),
        aktiv: true,
      },
    });

    await tx.anbarlar.create({
      data: {
        sahibkar_id: sahibkar.id,
        ad: "Əsas anbar",
        filial_id: filial.id,
        aktiv: true,
      },
    });

    await tx.demo_trials.create({
      data: {
        sahibkar_id: sahibkar.id,
        bitme: bitmeOnlyDate,
        status: "aktiv",
      },
    });

    return { sahibkar, user, filial };
  });
}

async function runLogin(email: string, password: string) {
  const user = await prisma.istifadeciler.findFirst({
    where: { email: email.toLowerCase().trim(), aktiv: true },
    include: {
      sahibkarlar: {
        include: { abuneler: { orderBy: { yaradildi: "desc" }, take: 1, include: { abune_planlari: true } } },
      },
      roles: true,
    },
  });
  if (!user) return { ok: false, reason: "user_not_found" };

  const ok = await bcrypt.compare(password, user.sifre_hash);
  if (!ok) return { ok: false, reason: "bad_password" };

  if (user.sahibkarlar?.status !== "aktiv") return { ok: false, reason: "tenant_inactive" };

  const abune = user.sahibkarlar?.abuneler?.[0];
  if (abune?.bitme && new Date(abune.bitme) < new Date()) return { ok: false, reason: "subscription_expired" };

  const rolId = user.rol_id ?? 0;
  const icazeRows = rolId
    ? await prisma.rol_icazeleri.findMany({
        where: { rol_id: rolId },
        include: { icazeler: { select: { kod: true } } },
      })
    : [];

  return {
    ok: true as const,
    user: {
      id: user.id,
      email: user.email,
      ad_soyad: user.ad_soyad,
      sahibkar_id: user.sahibkar_id,
      sahibkar_ad: user.sahibkarlar?.ad,
      rol_id: rolId,
      rol_ad: user.roles?.ad,
      plan_kod: abune?.abune_planlari?.kod,
      plan_ad: abune?.abune_planlari?.ad,
      abune_bitme: abune?.bitme,
      icaze_count: icazeRows.length,
    },
  };
}

async function main() {
  const email = `test${Date.now()}@biznes-test.local`;
  console.log(`\n=== Signup test ===\nemail: ${email}`);

  const created = await runSignup({
    sirket_adi: "Test MMC",
    email,
    telefon: "+994501112233",
    sifre: "secret123",
  });
  console.log("✓ sahibkar id:", created.sahibkar.id);
  console.log("✓ user id:", created.user.id);
  console.log("✓ filial:", created.filial.ad);

  console.log(`\n=== Login test (correct password) ===`);
  const goodLogin = await runLogin(email, "secret123");
  console.log(goodLogin.ok ? "✓ login OK" : `✗ login failed: ${goodLogin.reason}`);
  if (goodLogin.ok) console.log("  user:", goodLogin.user);

  console.log(`\n=== Login test (wrong password) ===`);
  const badLogin = await runLogin(email, "wrong-password");
  console.log(!badLogin.ok ? `✓ rejected (${badLogin.reason})` : "✗ should have rejected");

  // Cleanup
  console.log(`\n=== Cleanup ===`);
  await prisma.sahibkarlar.delete({ where: { id: created.sahibkar.id } });
  console.log("✓ test data removed");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
