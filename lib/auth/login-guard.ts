import "server-only";
import { prismaUnscoped } from "@/lib/db/prisma";
import { safeAuditLog } from "@/lib/audit/safe-log";
import { parseUserAgent, deviceFingerprint, describeDevice } from "./device-fingerprint";
import { sendNewDeviceAlert } from "./new-device-email";

/**
 * Login brute-force qoruması.
 *
 * `giris_cehdleri` modelindən istifadə edirik — bu sahibkar_id-siz cross-tenant
 * cədvəldir, indekslidir (email, ip_adres + yaradildi). Audit_log-a yazmırıq
 * çünki uğursuz cəhdlərdə tenant məlum olmaya bilər; əvəzində bu cədvələ yazıb
 * eyni cədvəldən rate-limit hesablayırıq.
 *
 * Limitlər:
 * - Email-ə görə: 5 uğursuz cəhd / 15 dəqiqə (konkret hesaba brute-force qoruması)
 * - IP-yə görə: 12+ FƏRQLİ email-ə uğursuz cəhd / 15 dəqiqə (enumeration hücumu).
 *   DİQQƏT: əvvəl xam IP-sayı (20) idi — paylaşılan IP-də (ofis, mobil operator
 *   NAT) günahsız istifadəçiləri bloklayırdı. İndi yalnız "çox sayda FƏRQLİ
 *   hesaba hücum" pattern-i bloklanır; eyni IP-dən bir neçə real istifadəçinin
 *   öz şifrəsini səhv yazması bloklamır.
 *
 * Uğurlu giriş tenant məlum olduğu üçün audit_log-a da yazılır.
 */

const WINDOW_MIN = 15;
const EMAIL_LIMIT = 5;
const IP_DISTINCT_EMAIL_LIMIT = 12;

export type LoginGate =
  | { allowed: true }
  | { allowed: false; reason: string; retryAfterSec: number };

export async function checkLoginRate(email: string, ip: string | null): Promise<LoginGate> {
  const since = new Date(Date.now() - WINDOW_MIN * 60_000);
  const normalizedEmail = email.toLowerCase().trim();
  try {
    const [emailFails, ipDistinctEmails] = await Promise.all([
      prismaUnscoped.giris_cehdleri.count({
        where: { email: normalizedEmail, ugurlu: false, yaradildi: { gte: since } },
      }),
      ip
        ? prismaUnscoped.giris_cehdleri
            .findMany({
              where: { ip_adres: ip, ugurlu: false, yaradildi: { gte: since } },
              distinct: ["email"],
              select: { email: true },
            })
            .then((rows) => rows.length)
        : Promise.resolve(0),
    ]);

    if (emailFails >= EMAIL_LIMIT) {
      return {
        allowed: false,
        reason: `Çox uğursuz giriş cəhdi. ${WINDOW_MIN} dəqiqə sonra yenidən cəhd edin.`,
        retryAfterSec: WINDOW_MIN * 60,
      };
    }
    // Yalnız ENUMERATION pattern-i: bir IP-dən çox sayda FƏRQLİ hesaba hücum.
    // Paylaşılan IP-dəki bir neçə real istifadəçi bundan təsirlənmir.
    if (ipDistinctEmails >= IP_DISTINCT_EMAIL_LIMIT) {
      return {
        allowed: false,
        reason: `Bu IP-dən şübhəli aktivlik aşkarlandı. Müvəqqəti olaraq bloklandı.`,
        retryAfterSec: WINDOW_MIN * 60,
      };
    }
    return { allowed: true };
  } catch (e) {
    // DB problemi giriş axınını bloklamasın
    console.warn("[login-guard] check failed, allowing:", e);
    return { allowed: true };
  }
}

/**
 * Bu istifadəçi bu cihazla əvvəl giriş edibmi? Son N gün ərzində audit_log-da
 * eyni fingerprint+istifadəçi cütünün uğurlu giriş qeydi varsa "tanış".
 * Yoxdursa "yeni cihaz" — audit-də işarələnir, UI bunu görür.
 *
 * Niyə fingerprint və IP yox: mobil internet IP-ni dəyişir, mənalı müqayisə
 * üçün cihaz tipi + OS family + brauzer family kombinasiyasına etibar edirik.
 */
const NEW_DEVICE_WINDOW_DAYS = 90;

export async function isKnownDevice(opts: {
  sahibkarId: string;
  istifadeciId: string;
  fingerprint: string;
}): Promise<boolean> {
  const since = new Date(Date.now() - NEW_DEVICE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [kind, osFam, brFam] = opts.fingerprint.split("|");
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      sahibkar_id: opts.sahibkarId,
      istifadeci_id: opts.istifadeciId,
      emeliyyat: { in: ["giris", "yeni_cihaz_giris"] },
      status: "ugur",
      yaradildi: { gte: since },
      cihaz: { contains: kind },
    };
    if (osFam && osFam !== "?") where.os = { contains: osFam };
    if (brFam && brFam !== "?") where.brauzer = { contains: brFam };
    const prev = await prismaUnscoped.audit_log.findFirst({
      where,
      select: { id: true },
    });
    return prev !== null;
  } catch {
    // Sorğu səhvi bizi bloklamasın — false-positive "yeni cihaz" çəkməyək
    return true;
  }
}

export async function recordLoginAttempt(opts: {
  success: boolean;
  email: string;
  ip: string | null;
  ua: string | null;
  sahibkarId?: string | null;
  istifadeciId?: string | null;
  sebeb?: string;
}): Promise<{ newDevice: boolean; deviceLabel: string }> {
  // 1) giris_cehdleri — rate-limit üçün
  try {
    await prismaUnscoped.giris_cehdleri.create({
      data: {
        email: opts.email.toLowerCase().trim(),
        ip_adres: opts.ip ?? undefined,
        ugurlu: opts.success,
        user_agent: opts.ua ?? undefined,
      },
    });
  } catch (e) {
    console.warn("[login-guard] failed to record attempt:", e);
  }

  // 2) Cihaz fingerprint — UA-dan os/brauzer/cihaz çıxar
  const device = parseUserAgent(opts.ua);
  const deviceLabel = describeDevice(device);
  const fp = deviceFingerprint(device);

  // 3) Yeni cihaz aşkarlama — yalnız uğurlu giriş üçün məna kəsb edir
  let newDevice = false;
  if (opts.success && opts.sahibkarId && opts.istifadeciId) {
    const known = await isKnownDevice({
      sahibkarId: opts.sahibkarId,
      istifadeciId: opts.istifadeciId,
      fingerprint: fp,
    });
    newDevice = !known;
  }

  // 4) Yeni cihazdan giriş — istifadəçiyə email bildirişi göndər (fire-and-forget)
  if (newDevice && opts.istifadeciId) {
    // Background — login cavabını ləngitməsin
    void (async () => {
      try {
        const user = await prismaUnscoped.istifadeciler.findUnique({
          where: { id: opts.istifadeciId! },
          select: {
            email: true,
            ad_soyad: true,
            sahibkarlar: { select: { ad: true } },
          },
        });
        if (user?.email) {
          await sendNewDeviceAlert({
            to: user.email,
            userName: user.ad_soyad ?? user.email,
            device,
            ip: opts.ip,
            timestamp: new Date(),
            tenantName: user.sahibkarlar?.ad,
            changePasswordUrl: `${process.env.APP_URL ?? "https://360biznes.app"}/ayarlar/hesab`,
          });
        }
      } catch (e) {
        console.warn("[login-guard] new-device email failed:", e);
      }
    })();
  }

  // 5) audit_log — yalnız tenant məlumdursa (uğurlu giriş və ya mövcud user-ın səhv şifrəsi)
  if (opts.sahibkarId) {
    const sebebFinal = newDevice
      ? `🆕 YENİ CİHAZ — ${deviceLabel}${opts.sebeb ? ` · ${opts.sebeb}` : ""}`
      : opts.sebeb;
    await safeAuditLog({
      sahibkar_id: opts.sahibkarId,
      istifadeci_id: opts.istifadeciId ?? null,
      istifadeci_ad: opts.email.toLowerCase().trim(),
      emeliyyat: opts.success ? (newDevice ? "yeni_cihaz_giris" : "giris") : "uğursuz_giris",
      resurs_nov: "session",
      resurs_id: null,
      status: opts.success ? "ugur" : "ugursuz",
      sebeb: sebebFinal ?? undefined,
      ip_adres: opts.ip ?? undefined,
      user_agent: opts.ua ?? undefined,
      // Audit_log schema-sında bu kolonlar var — istifadə edək
      cihaz: device.cihaz?.slice(0, 20) ?? undefined,
      os: device.os?.slice(0, 60) ?? undefined,
      brauzer: device.brauzer?.slice(0, 60) ?? undefined,
    });
  }

  return { newDevice, deviceLabel };
}
