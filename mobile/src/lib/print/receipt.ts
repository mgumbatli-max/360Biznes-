// Qaimə/çek modeli + 58mm HTML və ESC/POS bayt qurucusu.
// HTML expo-print ilə dərhal işlədilir (sistem çap dialoqu → Bluetooth/PDF).
// ESC/POS baytları gələcəkdə birbaşa Bluetooth termal printer üçün hazırdır
// (yalnız nəqliyyat dəyişir — qaimə məntiqi eynidir).

export type ReceiptLine = { ad: string; miqdar: number; qiymet: number; cemi: number };

export type ReceiptData = {
  sirket: string;
  nomre: string; // SAT-2026-000123
  cek: string; // POS-2026-A1B2-00005
  tarix: string; // formatlanmış
  kassir: string | null;
  musteri: string | null;
  lines: ReceiptLine[];
  ara_cemi: number;
  endirim: number;
  yekun: number;
  odenis: string; // etiket: Nağd/Kart/...
  valyuta: string;
};

const SYM: Record<string, string> = { AZN: "₼", USD: "$", EUR: "€", TRY: "₺", RUB: "₽", GBP: "£" };
function money(n: number, v: string): string {
  const sym = SYM[v] ?? v;
  return `${Number(n).toFixed(2)} ${sym}`;
}
function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 58mm termal çek üçün optimallaşdırılmış HTML. */
export function buildReceiptHtml(d: ReceiptData): string {
  const rows = d.lines
    .map(
      (l) => `
      <div class="ln">
        <div class="ln-ad">${esc(l.ad)}</div>
        <div class="ln-d">
          <span>${l.miqdar} × ${money(l.qiymet, d.valyuta)}</span>
          <span class="b">${money(l.cemi, d.valyuta)}</span>
        </div>
      </div>`,
    )
    .join("");

  const endirimRow =
    d.endirim > 0
      ? `<div class="tot"><span>Endirim</span><span>−${money(d.endirim, d.valyuta)}</span></div>`
      : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: 58mm; margin: 0; padding: 4mm 3mm; font-family: 'Courier New', monospace; color: #000; font-size: 11px; line-height: 1.35; }
  .c { text-align: center; }
  .b { font-weight: 700; }
  .big { font-size: 14px; font-weight: 700; }
  .sep { border-top: 1px dashed #000; margin: 5px 0; }
  .muted { font-size: 10px; }
  .ln { margin: 3px 0; }
  .ln-ad { font-weight: 600; }
  .ln-d { display: flex; justify-content: space-between; }
  .tot { display: flex; justify-content: space-between; margin: 2px 0; }
  .yekun { font-size: 13px; font-weight: 700; }
</style></head>
<body>
  <div class="c big">${esc(d.sirket || "Satış")}</div>
  <div class="c muted">Çek: ${esc(d.cek || d.nomre)}</div>
  <div class="c muted">${esc(d.tarix)}</div>
  ${d.kassir ? `<div class="c muted">Kassir: ${esc(d.kassir)}</div>` : ""}
  ${d.musteri ? `<div class="c muted">Müştəri: ${esc(d.musteri)}</div>` : ""}
  <div class="sep"></div>
  ${rows}
  <div class="sep"></div>
  <div class="tot"><span>Ara cəmi</span><span>${money(d.ara_cemi, d.valyuta)}</span></div>
  ${endirimRow}
  <div class="tot yekun"><span>YEKUN</span><span>${money(d.yekun, d.valyuta)}</span></div>
  <div class="tot"><span>Ödəniş</span><span>${esc(d.odenis)}</span></div>
  <div class="sep"></div>
  <div class="c">Təşəkkür edirik! 🙏</div>
  <div class="c muted">${esc(d.nomre)}</div>
</body></html>`;
}

/** Düz mətn çek (32 simvol enli) — ESC/POS və debug üçün. */
export function buildReceiptText(d: ReceiptData, width = 32): string {
  const line = (l: string, r: string) => {
    const space = Math.max(1, width - l.length - r.length);
    return l + " ".repeat(space) + r;
  };
  const center = (s: string) => {
    const pad = Math.max(0, Math.floor((width - s.length) / 2));
    return " ".repeat(pad) + s;
  };
  const sep = "-".repeat(width);
  const out: string[] = [];
  out.push(center(d.sirket || "Satış"));
  out.push(center(`Çek: ${d.cek || d.nomre}`));
  out.push(center(d.tarix));
  if (d.musteri) out.push(center(d.musteri));
  out.push(sep);
  for (const l of d.lines) {
    out.push(l.ad.slice(0, width));
    out.push(line(`  ${l.miqdar} x ${money(l.qiymet, d.valyuta)}`, money(l.cemi, d.valyuta)));
  }
  out.push(sep);
  out.push(line("Ara cəmi", money(d.ara_cemi, d.valyuta)));
  if (d.endirim > 0) out.push(line("Endirim", `-${money(d.endirim, d.valyuta)}`));
  out.push(line("YEKUN", money(d.yekun, d.valyuta)));
  out.push(line("Ödəniş", d.odenis));
  out.push(sep);
  out.push(center("Təşəkkür edirik!"));
  out.push(d.nomre);
  return out.join("\n");
}

/**
 * ESC/POS bayt ardıcıllığı (gələcək birbaşa Bluetooth termal printer üçün).
 * İndi istifadə olunmur — `printReceipt` HTML+sistem dialoqu işlədir. Birbaşa
 * BT modulu əlavə olunanda bu baytlar SPP/BLE üzərindən göndərilə bilər.
 */
export function buildEscPosBytes(d: ReceiptData): number[] {
  const ESC = 0x1b, GS = 0x1d, LF = 0x0a;
  const bytes: number[] = [];
  const push = (...b: number[]) => bytes.push(...b);
  const text = (s: string) => {
    for (const ch of s) push(ch.charCodeAt(0) & 0xff);
  };
  push(ESC, 0x40); // init
  push(ESC, 0x61, 0x01); // center
  push(ESC, 0x21, 0x30); // double size
  text(d.sirket || "Satis"); push(LF);
  push(ESC, 0x21, 0x00); // normal
  text(`Cek: ${d.cek || d.nomre}`); push(LF);
  text(d.tarix); push(LF);
  push(ESC, 0x61, 0x00); // left
  text(buildReceiptText(d).split("\n").slice(d.musteri ? 4 : 3).join("\n"));
  push(LF, LF, LF);
  push(GS, 0x56, 0x42, 0x00); // partial cut
  return bytes;
}
