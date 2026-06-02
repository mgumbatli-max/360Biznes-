import "server-only";

/**
 * User-Agent parser və cihaz fingerprint.
 *
 * Xarici asılılıq YOXDUR — sadə regex pattern. Əgər gələcəkdə daha dəqiqliyə
 * ehtiyac olarsa `ua-parser-js` istifadə oluna bilər.
 *
 * Fingerprint məqsədi: yeni cihazdan giriş aşkarlamaq. Hash deyilir, çünki
 * IP dəyişməsi (mobil internet) bütün fingerprint-i pozur. Komponentlər
 * ayrıca saxlanır ki, müqayisə zamanı IP-ni nəzərə almayaq.
 */

export type DeviceInfo = {
  os: string | null;          // "macOS 14.2", "iOS 17.1", "Windows 11", "Android 13", "Linux"
  brauzer: string | null;     // "Chrome 120", "Safari 17", "Firefox 121", "Edge 120"
  cihaz: "desktop" | "mobile" | "tablet" | "bot" | "naməlum";
  os_family: string | null;   // "macOS", "iOS", "Windows", "Android", "Linux" — versiyasız
  brauzer_family: string | null; // "Chrome", "Safari", "Firefox", "Edge" — versiyasız
};

const BOT_RE = /bot|crawler|spider|wget|curl|axios|httpie|postman/i;

function detectOs(ua: string): { os: string | null; family: string | null } {
  if (!ua) return { os: null, family: null };
  // iOS — daha xüsusi pattern, macOS-dan əvvəl yoxlanmalıdır
  let m = ua.match(/iP(?:hone|ad|od);\s+CPU\s+(?:iPhone\s+)?OS\s+(\d+[_\d]*)/i);
  if (m) return { os: `iOS ${m[1].replace(/_/g, ".")}`, family: "iOS" };
  m = ua.match(/iP(?:hone|ad|od)/i);
  if (m) return { os: "iOS", family: "iOS" };
  // macOS
  m = ua.match(/Mac OS X\s+(\d+[_\d]*)/i);
  if (m) return { os: `macOS ${m[1].replace(/_/g, ".")}`, family: "macOS" };
  // Windows
  m = ua.match(/Windows NT\s+(\d+\.\d+)/);
  if (m) {
    const ver = m[1];
    const map: Record<string, string> = {
      "10.0": "Windows 10/11",
      "6.3": "Windows 8.1",
      "6.2": "Windows 8",
      "6.1": "Windows 7",
    };
    return { os: map[ver] ?? `Windows NT ${ver}`, family: "Windows" };
  }
  // Android
  m = ua.match(/Android\s+(\d+[\d.]*)/i);
  if (m) return { os: `Android ${m[1]}`, family: "Android" };
  // Linux (after Android — Android contains Linux)
  if (/Linux/i.test(ua)) return { os: "Linux", family: "Linux" };
  return { os: null, family: null };
}

function detectBrowser(ua: string): { browser: string | null; family: string | null } {
  if (!ua) return { browser: null, family: null };
  // Edge (chromium) — Chrome-dan əvvəl yoxlanmalıdır
  let m = ua.match(/Edg\/(\d+)/);
  if (m) return { browser: `Edge ${m[1]}`, family: "Edge" };
  // Opera
  m = ua.match(/OPR\/(\d+)/);
  if (m) return { browser: `Opera ${m[1]}`, family: "Opera" };
  // Firefox
  m = ua.match(/Firefox\/(\d+)/);
  if (m) return { browser: `Firefox ${m[1]}`, family: "Firefox" };
  // Chrome (must come before Safari — Safari pattern matches Chrome too)
  m = ua.match(/Chrome\/(\d+)/);
  if (m) return { browser: `Chrome ${m[1]}`, family: "Chrome" };
  // Safari — only after we've ruled out Chrome
  m = ua.match(/Version\/(\d+).*Safari/);
  if (m) return { browser: `Safari ${m[1]}`, family: "Safari" };
  if (/Safari/i.test(ua)) return { browser: "Safari", family: "Safari" };
  return { browser: null, family: null };
}

function detectDeviceKind(ua: string): DeviceInfo["cihaz"] {
  if (!ua) return "naməlum";
  if (BOT_RE.test(ua)) return "bot";
  if (/iPad|Tablet|PlayBook/i.test(ua)) return "tablet";
  // Android tablet — "Mobile" sözü yoxdursa tablet hesab olunur
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return "tablet";
  if (/Mobile|iPhone|iPod|Android.*Mobile/i.test(ua)) return "mobile";
  return "desktop";
}

export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  if (!ua || ua.length < 5) {
    return { os: null, brauzer: null, cihaz: "naməlum", os_family: null, brauzer_family: null };
  }
  const { os, family: os_family } = detectOs(ua);
  const { browser, family: brauzer_family } = detectBrowser(ua);
  const cihaz = detectDeviceKind(ua);
  return { os, brauzer: browser, cihaz, os_family, brauzer_family };
}

/**
 * Cihaz fingerprint — istifadəçinin "tanış cihazı" kimi yadda saxlamaq üçün.
 * IP daxil ETMİR (mobil internet IP-ni dəyişdirir, false positive olar).
 * Cihaz tipi + OS family + brauzer family kombinasiyası — eyni istifadəçinin
 * eyni cihazından gələn girişlər eyni fingerprint qaytarmalıdır.
 */
export function deviceFingerprint(d: DeviceInfo): string {
  return [d.cihaz, d.os_family ?? "?", d.brauzer_family ?? "?"].join("|");
}

/**
 * İnsan üçün qısa təsvir: "macOS · Safari · desktop"
 */
export function describeDevice(d: DeviceInfo): string {
  const parts: string[] = [];
  if (d.os) parts.push(d.os);
  if (d.brauzer) parts.push(d.brauzer);
  if (d.cihaz && d.cihaz !== "naməlum") parts.push(d.cihaz);
  return parts.length > 0 ? parts.join(" · ") : "Naməlum cihaz";
}
