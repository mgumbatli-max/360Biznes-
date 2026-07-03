import "server-only";
import { sendEmail } from "@/lib/email/adapter";
import { formatDate } from "@/lib/utils";
import { describeDevice, type DeviceInfo } from "./device-fingerprint";

/**
 * Yeni cihazdan girişdə istifadəçiyə email göndərmə.
 *
 * Çağırış nöqtəsi: `recordLoginAttempt` daxili — yeni cihaz aşkarlandıqda.
 * Fire-and-forget — login axınını ləngitməsin.
 *
 * Email provider yoxdursa (mock mode) — console-a yazılır, real email getmir.
 * Sahibkar Resend/SendGrid açar əlavə etdikdə avtomatik real-ə keçir.
 */

export type NewDeviceEmailOpts = {
  to: string;
  userName: string;
  device: DeviceInfo;
  ip: string | null;
  timestamp: Date;
  /** Sahibkar şirkəti adı (subject-də göstərmək üçün) */
  tenantName?: string;
  /** Şifrə dəyişmə URL-i */
  changePasswordUrl?: string;
};

export async function sendNewDeviceAlert(opts: NewDeviceEmailOpts): Promise<void> {
  const deviceText = describeDevice(opts.device);
  // Bakı vaxtı (deterministik) — server UTC olduğundan toLocaleString AZ istifadəçiyə
  // 4 saat səhv göstərirdi. "3 iyul 2026, cümə 10:05" formatı.
  const timeStr = formatDate(opts.timestamp, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const ipText = opts.ip ?? "naməlum";
  const tenantPrefix = opts.tenantName ? `[${opts.tenantName}] ` : "";
  const subject = `🆕 ${tenantPrefix}Yeni cihazdan giriş — ${deviceText}`;

  const html = `<!DOCTYPE html>
<html lang="az">
<head>
<meta charset="utf-8" />
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1c1e;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f7;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Hero — qırmızı xəbərdarlıq band -->
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:24px 28px;color:#fff;">
              <div style="font-size:32px;line-height:1;">🆕</div>
              <h1 style="margin:8px 0 4px;font-size:20px;font-weight:700;">Yeni cihazdan giriş</h1>
              <p style="margin:0;font-size:14px;opacity:0.95;">
                360Biznes hesabınıza naməlum cihazdan giriş edildi
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#1c1c1e;">
                Salam <strong>${escapeHtml(opts.userName)}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#3c3c43;">
                Bu giriş hadisəsini həyata keçirən siz idinizmi? Aşağıdakı təfsilatlara baxın.
              </p>

              <!-- Details card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f7;border-radius:10px;margin:0 0 20px;">
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #e5e5ea;">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#86868b;">Cihaz</div>
                    <div style="margin-top:2px;font-size:14px;color:#1c1c1e;font-weight:500;">${escapeHtml(deviceText)}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #e5e5ea;">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#86868b;">IP ünvanı</div>
                    <div style="margin-top:2px;font-size:14px;color:#1c1c1e;font-family:ui-monospace,'SF Mono',Monaco,monospace;">${escapeHtml(ipText)}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;">
                    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#86868b;">Vaxt</div>
                    <div style="margin-top:2px;font-size:14px;color:#1c1c1e;">${escapeHtml(timeStr)}</div>
                  </td>
                </tr>
              </table>

              <!-- Action — was it you -->
              <div style="background:#fff7ed;border:2px solid #fed7aa;border-radius:10px;padding:16px;margin:0 0 16px;">
                <div style="font-size:14px;font-weight:600;color:#9a3412;margin-bottom:6px;">
                  Bu siz idinizsə
                </div>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#7c2d12;">
                  Bu emaili saxlaya bilərsiniz — heç bir əməliyyat tələb olunmur.
                  Növbəti girişlərdə həmin cihazdan xəbərdarlıq getməyəcək.
                </p>
              </div>

              <div style="background:#fef2f2;border:2px solid #fecaca;border-radius:10px;padding:16px;margin:0 0 20px;">
                <div style="font-size:14px;font-weight:600;color:#991b1b;margin-bottom:6px;">
                  ⚠️ Bu siz deyilsinizsə
                </div>
                <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#7f1d1d;">
                  Hesabınıza icazəsiz giriş ola bilər. Dərhal addım atın:
                </p>
                <ol style="margin:0;padding-left:20px;font-size:13px;line-height:1.6;color:#7f1d1d;">
                  <li>Şifrənizi indi dəyişin</li>
                  <li>Bütün aktiv sessiyaları sonlandırın</li>
                  <li>Audit log-da son əməliyyatları yoxlayın</li>
                </ol>
                ${opts.changePasswordUrl
                  ? `<a href="${escapeAttr(opts.changePasswordUrl)}"
                       style="display:inline-block;margin-top:12px;padding:8px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">
                       Şifrəni indi dəyiş →
                     </a>`
                  : ""}
              </div>

              <p style="margin:0;font-size:11.5px;line-height:1.5;color:#86868b;">
                Bu mesaj 360Biznes-in avtomatik təhlükəsizlik sistemi tərəfindən göndərilib. Yeni cihaz —
                yəni son 90 gündə eyni cihaz növü + əməliyyat sistemi + brauzer kombinasiyası ilə uğurlu giriş qeydə alınmayıb.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px;background:#f5f5f7;border-top:1px solid #e5e5ea;font-size:11px;color:#86868b;text-align:center;">
              360Biznes ERP · Təhlükəsizlik bildirişi
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${subject}`,
    "",
    `Salam ${opts.userName},`,
    "",
    `360Biznes hesabınıza yeni cihazdan giriş edildi:`,
    `  Cihaz: ${deviceText}`,
    `  IP: ${ipText}`,
    `  Vaxt: ${timeStr}`,
    "",
    "Əgər bu siz deyilsinizsə, dərhal şifrənizi dəyişin və bütün aktiv sessiyaları sonlandırın.",
    "",
    "— 360Biznes Təhlükəsizlik",
  ].join("\n");

  // Fire-and-forget — login axınını ləngitməsin
  try {
    const result = await sendEmail({ to: opts.to, subject, html, text });
    if (!result.ok) {
      console.warn("[new-device-email] failed:", result.error);
    }
  } catch (e) {
    console.warn("[new-device-email] exception:", e);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
