// POS Lite/Pro toggle testi (desktop viewport — ödəniş paneli həmişə görünür).
// Lite: kupon yox, ümumi endirim yox, 3 ödəniş düyməsi, auto-checkbox yox.
// Pro:  kupon var, ümumi endirim var, 4 ödəniş düyməsi (Bank daxil), auto-checkbox var.
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3500";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
const NAV = { waitUntil: "domcontentloaded", timeout: 60000 };

async function visible(text) {
  return (await page.getByText(text, { exact: false }).count()) > 0
    && await page.getByText(text, { exact: false }).first().isVisible().catch(() => false);
}

// login
await page.goto(BASE + "/login", NAV);
await page.fill('input[name="email"]', "test-sahibkar@example.com");
await page.fill('input[name="password"]', "Test1234!");
await page.click('button[type="submit"]');
await page.waitForTimeout(3500);

// POS + sessiya
await page.goto(BASE + "/pos", NAV);
await page.waitForTimeout(2500);
const openBtn = page.locator('button:has-text("Sessiyanı aç"), button:has-text("Kassanı aç")').first();
if (await openBtn.count()) { try { await openBtn.click({ timeout: 3000 }); await page.waitForTimeout(2500); } catch {} }

async function snapshot(label) {
  const couponLabel = await visible("Endirim kodu");
  const endirimRow = await visible("Ümumi endirim");
  const bankBtn = await page.locator('button:has-text("Bank")').count();
  const negdBtn = await page.locator('button:has-text("Nağd")').count();
  const kartBtn = await page.locator('button:has-text("Kart")').count();
  const borcBtn = await page.locator('button:has-text("Borc")').count();
  const autoVergi = await visible("Vergi çeki");
  console.log(`\n[${label}]`);
  console.log("  Kupon (Endirim kodu):", couponLabel ? "VAR" : "yox");
  console.log("  Ümumi endirim sətri :", endirimRow ? "VAR" : "yox");
  console.log("  Ödəniş düymələri    : Nağd=" + negdBtn, "Kart=" + kartBtn, "Borc=" + borcBtn, "Bank=" + bankBtn);
  console.log("  Auto-checkbox (Vergi çeki):", autoVergi ? "VAR" : "yox");
  return { couponLabel, endirimRow, bankBtn, autoVergi };
}

// Lite seç
await page.locator('button:has-text("Lite")').first().click().catch(() => {});
await page.waitForTimeout(800);
const lite = await snapshot("LITE");

// Pro seç
await page.locator('button[aria-pressed]:has-text("Pro"), button:has-text("Pro")').first().click().catch(() => {});
await page.waitForTimeout(800);
const pro = await snapshot("PRO");

// localStorage persist yoxla
const stored = await page.evaluate(() => localStorage.getItem("pos.mode.v1"));
console.log("\nlocalStorage pos.mode.v1 =", stored, "(pro gözlənilir)");

console.log("\n===== QİYMƏTLƏNDİRMƏ =====");
const ok =
  !lite.couponLabel && !lite.endirimRow && lite.bankBtn === 0 && !lite.autoVergi &&
  pro.couponLabel && pro.endirimRow && pro.bankBtn >= 1 && pro.autoVergi;
console.log(ok ? "✓ Lite sadələşir, Pro tam — DÜZGÜN" : "⚠ Gözlənilən fərq alınmadı — yuxarı bax");
console.log("pageerror:", errors.length);
errors.slice(0, 5).forEach((e) => console.log("  💥", e));

await page.screenshot({ path: "/tmp/shot-pos-pro.png", fullPage: false });
await browser.close();
console.log("\nBİTDİ");
