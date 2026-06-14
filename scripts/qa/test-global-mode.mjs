// Qlobal Lite/Pro testi: Topbar toggle + dashboard bölmə fərqi + cookie + mobil default.
import { chromium, devices } from "playwright";
const BASE = process.env.BASE || "http://localhost:3500";
const NAV = { waitUntil: "domcontentloaded", timeout: 60000 };

async function login(page) {
  await page.goto(BASE + "/login", NAV);
  await page.fill('input[name="email"]', process.env.QA_TEST_EMAIL);
  await page.fill('input[name="password"]', process.env.QA_TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);
}
async function dashHeight(page) {
  await page.goto(BASE + "/dashboard", NAV);
  await page.waitForTimeout(5000); // streaming bölmələr otursun
  return page.evaluate(() => document.documentElement.scrollHeight);
}
async function cookieMode(ctx) {
  const cs = await ctx.cookies();
  return cs.find((c) => c.name === "app-mode")?.value ?? "(yox)";
}

const browser = await chromium.launch({ headless: true });

// ── DESKTOP (default pro) ──
console.log("=== DESKTOP ===");
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dp = await dctx.newPage();
await login(dp);
let h = await dashHeight(dp);
console.log("ilk dashboard scrollHeight:", h, "| cookie app-mode:", await cookieMode(dctx));
const toggle = dp.locator('[aria-label="Görünüş rejimi"]');
console.log("Topbar toggle mövcud?", (await toggle.count()) > 0 ? "BƏLİ ✓" : "XEYR ⚠");

// Lite seç
await dp.locator('[aria-label="Görünüş rejimi"] button:has-text("Lite")').click().catch((e) => console.log("Lite klik:", e.message.slice(0, 60)));
await dp.waitForTimeout(3000);
const hLite = await dp.evaluate(() => document.documentElement.scrollHeight);
console.log("LITE scrollHeight:", hLite, "| cookie:", await cookieMode(dctx));

// Pro seç
await dp.locator('[aria-label="Görünüş rejimi"] button:has-text("Pro")').click().catch(() => {});
await dp.waitForTimeout(3000);
const hPro = await dp.evaluate(() => document.documentElement.scrollHeight);
console.log("PRO scrollHeight:", hPro, "| cookie:", await cookieMode(dctx));
console.log(hPro > hLite ? "✓ Pro daha çox bölmə (hündür), Lite daha qısa — DÜZGÜN" : "⚠ fərq gözlənildiyi kimi deyil");

// ── MOBİL (default lite via UA) ──
console.log("\n=== MOBİL (iPhone) ===");
const mctx = await browser.newContext({ ...devices["iPhone 13"] });
const mp = await mctx.newPage();
await login(mp);
await mp.goto(BASE + "/dashboard", NAV);
await mp.waitForTimeout(4000);
console.log("mobil ilk cookie app-mode:", await cookieMode(mctx), "(lite gözlənilir)");
const mToggle = await mp.locator('[aria-label="Görünüş rejimi"]').count();
console.log("mobil topbar toggle:", mToggle > 0 ? "var ✓" : "yox ⚠");

await browser.close();
console.log("\nBİTDİ");
