import "server-only";
import { z } from "zod";
import { prismaUnscoped } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { checkLoginRate, recordLoginAttempt } from "@/lib/auth/login-guard";

const LoginSchema = z.object({
  email: z.string().email("Email düzgün deyil"),
  password: z.string().min(6, "Şifrə ən az 6 simvol olmalıdır"),
});

export type AuthorizedUser = {
  id: string;
  email: string;
  ad_soyad: string;
  sahibkar_id: string;
  sahibkar_ad: string;
  rol_id: number;
  rol_ad: string;
  // auth.ts həmişə `?? null` ilə qaytarır — buna görə optional deyil,
  // `string | null` (NextAuth-un augment olunmuş `User`/`SessionUser`
  // tipi ilə eyni). undefined olarsa NextAuth tipi ilə uyğunsuzluq olur.
  plan_kod: string | null;
  plan_ad: string | null;
  abune_bitme: string | null;
  abune_status: string | null;
};

/**
 * Credentials login-in çəyirdəyi — həm NextAuth `authorize` callback-i,
 * həm də mobil login route bunu çağırır (DRY, eyni davranış).
 *
 * ip/ua çağıran tərəfdən ötürülür (NextAuth `headers()`-dən, mobil route
 * isə request başlıqlarından çıxarır) — beləliklə rate-limit + audit
 * qeydləri hər iki kanalda eyni işləyir.
 */
export async function authorizeUser(
  raw: { email?: unknown; password?: unknown },
  meta: { ip?: string | null; ua?: string | null },
): Promise<{ ok: true; user: AuthorizedUser } | { ok: false; reason: string }> {
  const t0 = Date.now();
  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid_input" };
  const { email, password } = parsed.data;

  const ip = meta.ip ?? null;
  const ua = meta.ua ?? null;

  // Brute-force qoruması: son 15 dəq-də limit aşılıbsa, dərhal blok
  const gate = await checkLoginRate(email, ip);
  if (!gate.allowed) {
    await recordLoginAttempt({ success: false, email, ip, ua, sebeb: gate.reason });
    return { ok: false, reason: "rate_limited" };
  }

  // `select` ilə yalnız lazımi sahələr — Prisma daha az JOIN edir,
  // payload kiçik olur. `include` bütün sütunları gətirir.
  const user = await prismaUnscoped.istifadeciler.findFirst({
    where: { email: email.toLowerCase().trim(), aktiv: true },
    select: {
      id: true,
      email: true,
      ad_soyad: true,
      sifre_hash: true,
      sahibkar_id: true,
      rol_id: true,
      sahibkarlar: {
        select: {
          ad: true,
          status: true,
          abuneler: {
            orderBy: { yaradildi: "desc" },
            take: 1,
            select: {
              bitme: true,
              status: true,
              abune_planlari: { select: { kod: true, ad: true } },
            },
          },
        },
      },
      roles: { select: { ad: true } },
    },
  });
  const tDb = Date.now();
  if (!user) {
    await recordLoginAttempt({ success: false, email, ip, ua, sebeb: "user_not_found" });
    return { ok: false, reason: "user_not_found" };
  }

  const ok = await verifyPassword(password, user.sifre_hash);
  const tBcrypt = Date.now();
  if (!ok) {
    await recordLoginAttempt({
      success: false,
      email,
      ip,
      ua,
      sahibkarId: user.sahibkar_id,
      istifadeciId: user.id,
      sebeb: "wrong_password",
    });
    return { ok: false, reason: "wrong_password" };
  }

  // Tenant must be active
  if (user.sahibkarlar?.status !== "aktiv") {
    await recordLoginAttempt({
      success: false, email, ip, ua,
      sahibkarId: user.sahibkar_id,
      istifadeciId: user.id,
      sebeb: "tenant_not_active",
    });
    return { ok: false, reason: "tenant_not_active" };
  }

  // Subscription must not be expired (if any)
  const abune = user.sahibkarlar?.abuneler?.[0];
  if (abune?.bitme && new Date(abune.bitme) < new Date()) {
    await recordLoginAttempt({
      success: false, email, ip, ua,
      sahibkarId: user.sahibkar_id,
      istifadeciId: user.id,
      sebeb: "subscription_expired",
    });
    return { ok: false, reason: "subscription_expired" };
  }
  if (abune && abune.status && !["aktiv", "sinaq"].includes(abune.status)) {
    await recordLoginAttempt({
      success: false, email, ip, ua,
      sahibkarId: user.sahibkar_id,
      istifadeciId: user.id,
      sebeb: `subscription_status:${abune.status}`,
    });
    return { ok: false, reason: `subscription_status:${abune.status}` };
  }

  const rolId = user.rol_id ?? 0;

  // Uğurlu giriş — audit + giris_cehdleri
  await recordLoginAttempt({
    success: true,
    email,
    ip,
    ua,
    sahibkarId: user.sahibkar_id,
    istifadeciId: user.id,
  });

  // Touch last-login timestamp — fire-and-forget, login cavabını bloklamasın.
  void prismaUnscoped.istifadeciler
    .update({ where: { id: user.id }, data: { son_giris: new Date() } })
    .catch(() => {});

  // Diagnostic — Vercel log-larında axtarır: "[auth] timing"
  console.log(
    `[auth] timing db=${tDb - t0}ms bcrypt=${tBcrypt - tDb}ms total=${Date.now() - t0}ms`,
  );

  // NOTE: Permissions are deliberately NOT included here. With 307+
  // codes the JWT exceeds the 4KB cookie limit and gets chunked, which
  // breaks reassembly in some clients. Load via getRequestPermissions().
  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      ad_soyad: user.ad_soyad,
      sahibkar_id: user.sahibkar_id,
      sahibkar_ad: user.sahibkarlar?.ad ?? "",
      rol_id: rolId,
      rol_ad: user.roles?.ad ?? "",
      plan_kod: abune?.abune_planlari?.kod ?? null,
      plan_ad: abune?.abune_planlari?.ad ?? null,
      abune_bitme: abune?.bitme ? new Date(abune.bitme).toISOString() : null,
      abune_status: abune?.status ?? null,
    },
  };
}
