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

      // 3b. Multi-tenant rollar — sistem rollarının hər birinin kopiyasını yeni
      // sahibkar üçün yarat. Sahibkar onları sərbəst redaktə edə bilir.
      // Sistem rolları template kataloqu kimi qalır.
      const systemRoles = await tx.roles.findMany({
        where: { sistem: true },
        include: { rol_icazeleri: { select: { icaze_id: true } } },
      });
      const roleMap = new Map<number, number>(); // sistemRoleId → yeni rol id
      for (const sysRole of systemRoles) {
        const cloned = await tx.roles.create({
          data: {
            ad: sysRole.ad,
            aciqlamaq: sysRole.aciqlamaq,
            reng: sysRole.reng,
            ikon: sysRole.ikon,
            sahibkar_id: sahibkar.id,
            sistem: false,
          },
        });
        roleMap.set(sysRole.id, cloned.id);
        if (sysRole.rol_icazeleri.length > 0) {
          await tx.rol_icazeleri.createMany({
            data: sysRole.rol_icazeleri.map((r) => ({ rol_id: cloned.id, icaze_id: r.icaze_id })),
            skipDuplicates: true,
          });
        }
      }
      const sahibkarRolId = roleMap.get(SAHIBKAR_ROLE_ID);
      if (!sahibkarRolId) throw new Error("Sahibkar role kopyası tapılmadı");

      // 4. Create owner user — yeni-yaradılmış custom sahibkar rolu ilə
      await tx.istifadeciler.create({
        data: {
          ad_soyad: data.sirket_adi.trim(),
          email,
          telefon: data.telefon.trim(),
          sifre_hash: passwordHash,
          rol_id: sahibkarRolId,
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
