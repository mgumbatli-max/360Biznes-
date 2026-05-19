"use server";

import { prismaUnscoped } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { SignupSchema } from "./schemas";
import { signIn } from "@/auth";

export type SignupActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const SAHIBKAR_ROLE_ID = 9; // System role "sahibkar"
const DEFAULT_PLAN_KOD = "baslangic";
const DEMO_DAYS = 15;

export async function signupAction(_prev: SignupActionResult | null, formData: FormData): Promise<SignupActionResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = SignupSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Forma doldurulmasında xəta var.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const email = data.email.toLowerCase().trim();

  // Email uniqueness check across both sahibkarlar and istifadeciler
  const [existingSahibkar, existingUser] = await Promise.all([
    prismaUnscoped.sahibkarlar.findUnique({ where: { email } }),
    prismaUnscoped.istifadeciler.findFirst({ where: { email } }),
  ]);
  if (existingSahibkar || existingUser) {
    return { ok: false, error: "Bu email artıq qeydiyyatdan keçib.", fieldErrors: { email: ["İstifadədədir"] } };
  }

  const plan = await prismaUnscoped.abune_planlari.findUnique({ where: { kod: DEFAULT_PLAN_KOD } });
  if (!plan) {
    return { ok: false, error: "Plan tapılmadı. İdarəçi ilə əlaqə saxlayın." };
  }

  const passwordHash = await hashPassword(data.sifre);
  const bitme = new Date();
  bitme.setDate(bitme.getDate() + DEMO_DAYS);
  const bitmeOnlyDate = new Date(bitme.toISOString().slice(0, 10));

  try {
    await prismaUnscoped.$transaction(async (tx) => {
      // 1. Create sahibkar (tenant)
      const sahibkar = await tx.sahibkarlar.create({
        data: {
          ad: data.sirket_adi.trim(),
          email,
          telefon: data.telefon.trim(),
          biznes_novu: data.biznes_novu || null,
          magaza_sayi: data.magaza_sayi || null,
          isci_sayi: data.isci_sayi || null,
          seh_r: data.seher || null,
          status: "aktiv",
        },
      });

      // 2. Create subscription (15-day trial)
      await tx.abuneler.create({
        data: {
          sahibkar_id: sahibkar.id,
          plan_id: plan.id,
          bitme: bitmeOnlyDate,
          novu: "sinaq",
          status: "aktiv",
        },
      });

      // 3. Enable all modules for 15 days
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

      // 4. Create owner user
      await tx.istifadeciler.create({
        data: {
          ad_soyad: data.sirket_adi.trim(),
          email,
          telefon: data.telefon.trim(),
          sifre_hash: passwordHash,
          rol_id: SAHIBKAR_ROLE_ID,
          sahibkar_id: sahibkar.id,
          aktiv: true,
        },
      });

      // 5. Create default branch.
      // NOTE: filiallar.ad has a GLOBAL unique constraint in the legacy schema
      // (not scoped by sahibkar_id). To avoid collision across tenants we
      // append the company name. The user can rename it later.
      const filial = await tx.filiallar.create({
        data: {
          sahibkar_id: sahibkar.id,
          ad: `${data.sirket_adi.trim()} — Mərkəzi filial`.slice(0, 100),
          unvan: data.seher || null,
          aktiv: true,
        },
      });

      // 6. Create default warehouse linked to branch
      await tx.anbarlar.create({
        data: {
          sahibkar_id: sahibkar.id,
          ad: "Əsas anbar",
          filial_id: filial.id,
          aktiv: true,
        },
      });

      // 7. Demo trial record (separate tracking from abuneler)
      await tx.demo_trials.create({
        data: {
          sahibkar_id: sahibkar.id,
          bitme: bitmeOnlyDate,
          status: "aktiv",
        },
      });
    });
  } catch (e) {
    console.error("[signup] transaction failed", e);
    return { ok: false, error: "Qeydiyyat zamanı xəta baş verdi. Yenidən cəhd edin." };
  }

  // Auto-login — signIn will set the session cookie and throw NEXT_REDIRECT.
  // Do not wrap in try/catch (would swallow the redirect signal).
  await signIn("credentials", {
    email,
    password: data.sifre,
    redirectTo: "/dashboard",
  });

  return { ok: true };
}
