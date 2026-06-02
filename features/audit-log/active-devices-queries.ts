import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseUserAgent } from "@/lib/auth/device-fingerprint";

/**
 * Aktiv cihazların izi.
 *
 * "Aktiv cihaz" = audit_log-da son N saatda fəaliyyət göstərən unique
 * (istifadeci_id + cihaz fingerprint) cütü. Fingerprint = cihaz|os|brauzer
 * birləşməsi (login-guard.ts ilə eyni məntiq, daha yumşaq match).
 *
 * Niyə audit_log-dan? Çünki yeganə sistem-wide aktivlik izidir. Hər API
 * çağırışı, hər səhifə naviqasiyası audit log-a düşmür, amma əməliyyatlar
 * və giriş düşür — bu kifayət edir "kim hələ aktivdir?" suala cavab üçün.
 */

export type ActiveDevice = {
  istifadeci_id: string | null;
  istifadeci_ad: string | null;
  istifadeci_email: string | null;
  istifadeci_aktiv: boolean | null;
  rol_ad: string | null;
  // Fingerprint komponentləri
  cihaz: string | null;       // "desktop", "mobile", "tablet"
  os: string | null;          // "macOS 14.2"
  brauzer: string | null;     // "Safari 17"
  // Cari sessiya statistikaları
  ip_adres: string | null;
  son_aktivlik: Date;
  ilk_qeyd: Date;             // bu cihazda ilk audit qeydinin vaxtı (window içində)
  // Aktivlik göstəriciləri (window içində)
  aktivlik_sayi: number;
  yeni_cihazdir: boolean;     // emeliyyat == "yeni_cihaz_giris" qeyd edilibmi
  ip_bloklanib: boolean;      // bu IP ip_bloklari-da aktiv blok varmı
};

export type DeviceSummary = {
  total_active_devices: number;
  total_active_users: number;
  multi_device_users: number; // 2+ cihazlı istifadəçi sayı
  new_devices_24h: number;
  blocked_ips: number;
  failed_logins_24h: number;
};

/**
 * Son N saatda aktiv cihazları çək.
 * @param windowHours default 24 (audit log noise azaltmaq üçün 24s pəncərə)
 */
export async function getActiveDevices(windowHours = 24): Promise<ActiveDevice[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    // İki mərhələ:
    //  1) audit_log-da cihaz field-i NULL olan köhnə qeydlər çoxdur — onları
    //     COALESCE ilə user_agent-dən parse olunmuş NULL-əvəzedicilərlə birləşdir.
    //  2) Yeni qeydlər (audit() helper yeniləndikdən sonra) cihaz/os/brauzer-i
    //     birbaşa cədvələ yazır.
    //
    // Sadəlik üçün group by istifadəçi+user_agent edirik — user_agent eyni olduqda
    // həm köhnə həm yeni qeydlər eyni qrupa düşür.
    const rawRows = await prisma.$queryRaw<Array<{
      istifadeci_id: string | null;
      istifadeci_ad: string | null;
      cihaz: string | null;
      os: string | null;
      brauzer: string | null;
      user_agent: string | null;
      ip_adres: string | null;
      ilk_qeyd: Date;
      son_aktivlik: Date;
      aktivlik_sayi: number;
      yeni_cihazdir: boolean;
    }>>`
      SELECT
        l.istifadeci_id::text AS istifadeci_id,
        MAX(l.istifadeci_ad) AS istifadeci_ad,
        MAX(l.cihaz) AS cihaz,
        MAX(l.os) AS os,
        MAX(l.brauzer) AS brauzer,
        MAX(l.user_agent) AS user_agent,
        MAX(l.ip_adres::text) AS ip_adres,
        MIN(l.yaradildi) AS ilk_qeyd,
        MAX(l.yaradildi) AS son_aktivlik,
        COUNT(*)::int AS aktivlik_sayi,
        BOOL_OR(l.emeliyyat = 'yeni_cihaz_giris') AS yeni_cihazdir
      FROM audit_log l
      WHERE l.sahibkar_id = ${sahibkarId}::uuid
        AND l.yaradildi >= ${since}
        AND l.istifadeci_id IS NOT NULL
      GROUP BY l.istifadeci_id, l.user_agent
      ORDER BY MAX(l.yaradildi) DESC
      LIMIT 200
    `;

    // user_agent-dən parse et — köhnə qeydlərin cihaz/os/brauzer-ini hesabla
    const rows = rawRows.map((r) => {
      // Əgər sahə artıq doludursa, onu saxla; yoxsa user_agent-dən çıxar
      if (r.cihaz && r.os && r.brauzer) return r;
      if (r.user_agent) {
        const parsed = parseUserAgent(r.user_agent);
        return {
          ...r,
          cihaz: r.cihaz ?? (parsed.cihaz !== "naməlum" ? parsed.cihaz : null),
          os: r.os ?? parsed.os,
          brauzer: r.brauzer ?? parsed.brauzer,
        };
      }
      return r;
    }).filter((r) => r.cihaz || r.os || r.brauzer || r.ip_adres);

    if (rows.length === 0) return [];

    // İstifadəçi məlumatlarını ayrıca çək (avatar, rol, status)
    const userIds = Array.from(new Set(rows.map((r) => r.istifadeci_id).filter((x): x is string => !!x)));
    const users = userIds.length > 0
      ? await prisma.istifadeciler.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            email: true,
            aktiv: true,
            roles: { select: { ad: true } },
          },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    // IP blok statusunu ayrıca çək.
    // ip_bloklari.ip_adres Inet tipidir — Prisma `{ in: [...] }` array-i Inet-ə
    // cast etməyə çalışır və bir element yanlış formatdadırsa bütün query
    // sınır (AddrParseError). Buna görə raw SQL ilə text müqayisəsi edirik —
    // bu səhv format olsa belə sadəcə match etmir.
    const uniqIps = Array.from(new Set(rows.map((r) => r.ip_adres).filter((x): x is string => !!x)));
    let blockedIpSet = new Set<string>();
    if (uniqIps.length > 0) {
      try {
        const ipBlocks = await prisma.$queryRaw<{ ip_adres: string }[]>`
          SELECT ip_adres::text AS ip_adres
            FROM ip_bloklari
           WHERE sahibkar_id = ${sahibkarId}::uuid
             AND aktiv = TRUE
             AND ip_adres::text = ANY(${uniqIps}::text[])
        `;
        blockedIpSet = new Set(ipBlocks.map((b) => b.ip_adres));
      } catch (e) {
        console.warn("[active-devices] IP block lookup failed:", e);
      }
    }

    return rows.map((r) => {
      const u = r.istifadeci_id ? userMap.get(r.istifadeci_id) : null;
      return {
        istifadeci_id: r.istifadeci_id,
        istifadeci_ad: r.istifadeci_ad,
        istifadeci_email: u?.email ?? null,
        istifadeci_aktiv: u?.aktiv ?? null,
        rol_ad: u?.roles?.ad ?? null,
        cihaz: r.cihaz,
        os: r.os,
        brauzer: r.brauzer,
        ip_adres: r.ip_adres,
        son_aktivlik: r.son_aktivlik,
        ilk_qeyd: r.ilk_qeyd,
        aktivlik_sayi: r.aktivlik_sayi,
        yeni_cihazdir: r.yeni_cihazdir,
        ip_bloklanib: r.ip_adres ? blockedIpSet.has(r.ip_adres) : false,
      };
    });
  });
}

/**
 * Aktiv cihaz xülasəsi — KPI kartları üçün.
 */
export async function getDeviceSummary(windowHours = 24): Promise<DeviceSummary> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const [agg, blockCount, failedCount] = await Promise.all([
      prisma.$queryRaw<Array<{
        total_devices: number;
        total_users: number;
        multi_device_users: number;
        new_devices: number;
      }>>`
        WITH devices AS (
          SELECT
            istifadeci_id,
            user_agent,
            BOOL_OR(emeliyyat = 'yeni_cihaz_giris') AS is_new
          FROM audit_log
          WHERE sahibkar_id = ${sahibkarId}::uuid
            AND yaradildi >= ${since}
            AND istifadeci_id IS NOT NULL
            AND user_agent IS NOT NULL
          GROUP BY istifadeci_id, user_agent
        ),
        per_user AS (
          SELECT istifadeci_id, COUNT(*) AS device_count
          FROM devices
          GROUP BY istifadeci_id
        )
        SELECT
          (SELECT COUNT(*)::int FROM devices) AS total_devices,
          (SELECT COUNT(*)::int FROM per_user) AS total_users,
          (SELECT COUNT(*)::int FROM per_user WHERE device_count > 1) AS multi_device_users,
          (SELECT COUNT(*)::int FROM devices WHERE is_new = TRUE) AS new_devices
      `.catch(() => []),
      prisma.ip_bloklari.count({ where: { sahibkar_id: sahibkarId, aktiv: true } }).catch(() => 0),
      prisma.audit_log.count({
        where: {
          sahibkar_id: sahibkarId,
          yaradildi: { gte: since },
          emeliyyat: "uğursuz_giris",
        },
      }).catch(() => 0),
    ]);

    const a = agg[0] ?? { total_devices: 0, total_users: 0, multi_device_users: 0, new_devices: 0 };
    return {
      total_active_devices: a.total_devices,
      total_active_users: a.total_users,
      multi_device_users: a.multi_device_users,
      new_devices_24h: a.new_devices,
      blocked_ips: blockCount,
      failed_logins_24h: failedCount,
    };
  });
}
