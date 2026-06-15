import "server-only";
import { z } from "zod";
import { prismaUnscoped } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { checkLoginRate, recordLoginAttempt } from "@/lib/auth/login-guard";

const LoginSchema = z.object({
  // .trim() validasiyadan ƏVVƏL — mobil autofill/paste tez-tez sonda boşluq
  // əlavə edir; trim olmasa zod `.email()` rədd edib "giriş alınmır" verərdi.
  email: z.string().trim().email("Email düzgün deyil"),
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

  // Qlobal IP-blok (platform-admin): platforma-sahibi tenantında (SUPER_ADMIN_
  // SAHIBKAR_ID) aktiv ip_bloklari sətri varsa, bu IP-dən girişi blokla.
  // ⚠️ FAIL-OPEN: hər hansı xəta, env yoxdursa, ip null/yanlışdırsa → BLOKU ÖTÜR,
  // girişə icazə ver. Bu auth-un isti yoludur — heç vaxt girişi sındırma.
  const superTenant = (process.env.SUPER_ADMIN_SAHIBKAR_ID ?? "").trim();
  if (superTenant && ip) {
    try {
      const now = new Date();
      const block = await prismaUnscoped.ip_bloklari.findFirst({
        where: {
          sahibkar_id: superTenant,
          aktiv: true,
          ip_adres: ip,
          OR: [{ bitme_tarixi: null }, { bitme_tarixi: { gt: now } }],
        },
        select: { id: true },
      });
      if (block) {
        await recordLoginAttempt({ success: false, email, ip, ua, sebeb: "ip_blocked" });
        return { ok: false, reason: "Bu IP-dən giriş bloklanıb" };
      }
    } catch (e) {
      // Hər hansı xəta (Inet parse, DB) girişi bloklamamalıdır — fail-open.
      console.warn("[auth] global ip-block check failed, allowing:", e);
    }
  }

  // `select` ilə yalnız lazımi sahələr — Prisma daha az JOIN edir,
  // payload kiçik olur. `include` bütün sütunları gətirir.
  //
  // DİQQƏT (hesab-qarışması fix): istifadeciler.email YALNIZ tenant-üzrə
  // unikaldır (@@unique([sahibkar_id, email])). Eyni email bir neçə tenant-da
  // ola bilər (məs. bir tenant-da işçi kimi dəvət, başqasında sahib). Köhnə
  // `findFirst` ARBİTRAR birini seçirdi → şifrə başqa sətrə uyğun gəlsə "giriş
  // alınmır", düşdüyü tenant səhv olsa "loginlər qarışır" idi. Həll: bütün aktiv
  // namizədləri gətir, şifrəyə UYĞUN GƏLƏN hesabı seç (adətən tək namizəd olur).
  // case-INSENSITIVE axtarış: saxlanan email-in registri normalizə olunmaya
  // bilər (komanda dəvəti / import / miqrasiya signup-dan fərqli yolla yaradıb).
  // Postgres `=` registr-həssasdır → `M.Gumbatli@` saxlanmışsa, `m.gumbatli@`
  // sorğusu tapmazdı və "giriş alınmır" olardı. ILIKE bunu həll edir.
  const candidates = await prismaUnscoped.istifadeciler.findMany({
    where: { email: { equals: email.trim(), mode: "insensitive" }, aktiv: true },
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
  if (candidates.length === 0) {
    await recordLoginAttempt({ success: false, email, ip, ua, sebeb: "user_not_found" });
    return { ok: false, reason: "user_not_found" };
  }

  // Şifrəyə görə düzgün hesabı seç.
  let user: (typeof candidates)[number] | null = null;
  for (const c of candidates) {
    if (await verifyPassword(password, c.sifre_hash)) {
      user = c;
      break;
    }
  }
  const tBcrypt = Date.now();
  if (!user) {
    const first = candidates[0];
    await recordLoginAttempt({
      success: false,
      email,
      ip,
      ua,
      sahibkarId: first.sahibkar_id,
      istifadeciId: first.id,
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
