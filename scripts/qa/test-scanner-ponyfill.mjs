// iOS Safari simulyasiyası: window.BarcodeDetector silinir → WASM ponyfill yolu yoxlanır.
// Yoxlayır: (1) /wasm/zxing_reader.wasm yüklənir, (2) "dəstəkləmir" xətası ÇIXMIR,
// (3) skaner "Skan edilir" vəziyyətinə keçir (fake kamera).
import { chromium, devices } from "playwright";

const BASE = process.env.BASE || "http://localhost:3500";
const iPhone = devices["iPhone 13"];

const browser = await chromium.launch({
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const ctx = await browser.newContext({ ...iPhone });
await ctx.grantPermissions(["camera"], { origin: BASE });
// iOS Safari kimi davran — native BarcodeDetector YOXDUR
await ctx.addInitScript(() => {
  // iOS Safari: property ümumiyyətlə mövcud deyil → həm `delete`, həm də typeof guard
  try { delete window.BarcodeDetector; } catch {}
  try { Object.defineProperty(window, "BarcodeDetector", { get() { return undefined; }, configurable: true }); } catch {}
});
const page = await ctx.newPage();

const wasmHits = [];
const consoleErrors = [];
page.on("response", (r) => { if (/\/wasm\/.*\.wasm/.test(r.url())) wasmHits.push(`${r.status()} ${r.url().replace(BASE, "")}`); });
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => consoleErrors.push("PAGEERR: " + String(e.message).slice(0, 200)));

const NAV = { waitUntil: "domcontentloaded", timeout: 60000 };

// login
await page.goto(BASE + "/login", NAV);
await page.fill('input[name="email"]', process.env.QA_TEST_EMAIL);
await page.fill('input[name="password"]', process.env.QA_TEST_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(3500);
console.log("login →", page.url());

// POS
await page.goto(BASE + "/pos", NAV);
await page.waitForTimeout(2500);

// Kassa sessiyası bağlıdırsa aç
const openBtn = page.locator('button:has-text("Sessiyanı aç"), button:has-text("Kassanı aç"), button:has-text("Aç")').first();
if (await openBtn.count()) {
  try { await openBtn.click({ timeout: 3000 }); await page.waitForTimeout(2500); console.log("kassa sessiyası açıldı"); } catch {}
}

// "BarcodeDetector" in window === false olduğunu təsdiq et
const hasNative = await page.evaluate(() => "BarcodeDetector" in window && !!window.BarcodeDetector);
console.log("native BarcodeDetector mövcuddur?", hasNative, "(false gözlənilir = ponyfill yolu)");

// Kamera skan düyməsini tap (POS: !searchQ olanda görünür)
const camBtn = page.locator('button[title*="kamera" i], button:has(svg.lucide-camera), button:has(svg.lucide-scan-barcode)').first();
let opened = false;
if (await camBtn.count()) {
  try { await camBtn.click({ timeout: 4000 }); opened = true; } catch (e) { console.log("kamera düyməsi klik xətası:", e.message.slice(0, 80)); }
}
console.log("skaner açıldı?", opened, "(düymə tapıldı:", await camBtn.count(), ")");

await page.waitForTimeout(6000); // wasm yüklənsin

// Dialoq içində xəta mətni
const dialogText = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  return d ? (d.textContent || "").replace(/\s+/g, " ").trim().slice(0, 400) : "(dialoq yoxdur)";
});
const scanningBadge = await page.evaluate(() => !!Array.from(document.querySelectorAll("*")).find((e) => e.textContent?.trim() === "Skan edilir"));

console.log("\n===== NƏTİCƏ =====");
console.log("WASM yüklənmələri:", wasmHits.length ? wasmHits.join(", ") : "(YOXDUR ⚠)");
console.log('"dəstəkləmir/API xəta" dialoqda?', /dəstəkləmir|yüklənmədi|API-sini/.test(dialogText) ? "BƏLİ ⚠" : "XEYR ✓");
console.log('"Skan edilir" badge görünür?', scanningBadge ? "BƏLİ ✓" : "XEYR");
console.log("Dialoq mətni:", dialogText);
console.log("Console error:", consoleErrors.length);
consoleErrors.slice(0, 8).forEach((e) => console.log("  ⚠", e));

await page.screenshot({ path: "/tmp/shot-scanner-ponyfill.png" });
await browser.close();
console.log("\nBİTDİ — screenshot: /tmp/shot-scanner-ponyfill.png");
