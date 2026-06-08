import "server-only";

/**
 * SSRF (Server-Side Request Forgery) müdafiəsi olan `fetch` wrapper.
 *
 * Bu kod istifadəçi tərəfindən təyin olunan URL-lərə outbound HTTP/HTTPS
 * sorğusunu icra edir (webhook test, sosial post publish, marketplace API).
 *
 * Blokladığı hədəflər:
 *   - Yalnız http: və https: schema (file/ftp/gopher rədd)
 *   - Localhost: 127.0.0.0/8, ::1
 *   - Private IP-lər: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 *   - Link-local: 169.254.0.0/16 (AWS metadata!), fe80::/10
 *   - Multicast: 224.0.0.0/4
 *   - "0.0.0.0" və DNS hostnames "*.local"
 *
 * SAFE_FETCH_ALLOWED env-də əlavə domenlər icazə vermək olar
 * (vergüllə ayrılmış suffiks siyahısı).
 */

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const num = Number(p);
    if (!Number.isInteger(num) || num < 0 || num > 255) return null;
    n = (n << 8) + num;
  }
  return n >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  // 10.0.0.0/8
  if ((n & 0xff000000) === 0x0a000000) return true;
  // 172.16.0.0/12
  if ((n & 0xfff00000) === 0xac100000) return true;
  // 192.168.0.0/16
  if ((n & 0xffff0000) === 0xc0a80000) return true;
  // 127.0.0.0/8 (loopback)
  if ((n & 0xff000000) === 0x7f000000) return true;
  // 169.254.0.0/16 (link-local, AWS metadata!)
  if ((n & 0xffff0000) === 0xa9fe0000) return true;
  // 0.0.0.0/8
  if ((n & 0xff000000) === 0x00000000) return true;
  // Multicast 224.0.0.0/4
  if ((n & 0xf0000000) === 0xe0000000) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const lo = ip.toLowerCase();
  // ::1, ::, fe80::/10, fc00::/7, ff00::/8
  if (lo === "::1" || lo === "::" || lo === "0:0:0:0:0:0:0:1" || lo === "0:0:0:0:0:0:0:0") return true;
  if (lo.startsWith("fe80:") || lo.startsWith("fe9") || lo.startsWith("fea") || lo.startsWith("feb")) return true;
  if (lo.startsWith("fc") || lo.startsWith("fd")) return true;
  if (lo.startsWith("ff")) return true;
  return false;
}

/**
 * URL-i validasiya et — schema, host, IP yoxlanması.
 * SSRF-də pozulmuş URL üçün exception atılır.
 */
function validateUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfError("URL səhv formatdadır");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SsrfError(`İcazəsiz schema: ${parsed.protocol}`);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) throw new SsrfError("Hostname boşdur");
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new SsrfError(`İcazəsiz hostname: ${hostname}`);
  }

  // Allowlist: SAFE_FETCH_ALLOWED env-də ayrıca icazə var
  const allowList = (process.env.SAFE_FETCH_ALLOWED ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowList.some((suffix) => hostname === suffix || hostname.endsWith("." + suffix))) {
    return parsed;
  }

  // Hostname numeric IP-dirsə birbaşa yoxla
  // IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isPrivateIpv4(hostname)) throw new SsrfError(`Private IP icazə verilmir: ${hostname}`);
    return parsed;
  }
  // IPv6
  if (hostname.includes(":") || (parsed.hostname.startsWith("[") && parsed.hostname.endsWith("]"))) {
    const ip = hostname.replace(/^\[|\]$/g, "");
    if (isPrivateIpv6(ip)) throw new SsrfError(`Private IPv6 icazə verilmir: ${ip}`);
    return parsed;
  }
  return parsed;
}

export type SafeFetchOptions = RequestInit & {
  timeoutMs?: number;
  maxResponseBytes?: number;
};

/**
 * SSRF-safe `fetch`. Sadəcə standart fetch-i wrap edir, lakin URL-i
 * yoxlayıb private/internal hədəfləri bloklayır + timeout məcburdur.
 *
 * @throws SsrfError — URL yoxlanması uğursuz olarsa
 */
export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {},
): Promise<Response> {
  const parsed = validateUrl(url);
  const timeoutMs = options.timeoutMs ?? 10_000;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { signal: existingSignal, timeoutMs: _t, maxResponseBytes: _m, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Timeout")), timeoutMs);
  try {
    // İstifadəçi öz signal-ını da göndəribsə birləşdir
    if (existingSignal) {
      existingSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    return await fetch(parsed.toString(), {
      ...rest,
      signal: controller.signal,
      redirect: "manual", // Redirect ilə internal IP-yə getməyi bloklayır
    });
  } finally {
    clearTimeout(timer);
  }
}
