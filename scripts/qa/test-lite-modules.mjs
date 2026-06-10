// Modul blok gating: Lite-da Ticarət "ozet" söndür → xülasə kartları yox olsun; Pro-da görünsün.
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3500";
const NAV = { waitUntil: "domcontentloaded", timeout: 60000 };
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));

async function login() {
  await page.goto(BASE + "/login", NAV);
  await page.fill('input[name="email"]', "test-sahibkar@example.com");
  await page.fill('input[name="password"]', "Test1234!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);
}
async function setMode(m) {
  await page.locator(`[aria-label="Görünüş rejimi"] button:has-text("${m}")`).click().catch(() => {});
  await page.waitForTimeout(2500);
}
async function ticaretOzetVisible() {
  await page.goto(BASE + "/ticaret/satislar", NAV);
  await page.waitForTimeout(3500);
  return (await page.getByText("Bu həftə", { exact: false }).count()) > 0;
}

await login();

// Ticarət "ozet" blokunu söndür
await page.goto(BASE + "/ayarlar/gorunis", NAV);
await page.waitForTimeout(2500);
const ozet = page.locator('label:has-text("Xülasə kartları (bugün") input[type="checkbox"]').first();
console.log("ticaret ozet checkbox tapıldı:", await ozet.count());
await ozet.uncheck().catch(async () => { await ozet.click(); });
await page.waitForTimeout(200);
await page.locator('button:has-text("Yadda saxla")').click();
await page.waitForTimeout(2500);

// LITE: ozet gizli olmalı
await setMode("Lite");
const liteVis = await ticaretOzetVisible();
console.log("LITE-da Ticarət xülasə kartları:", liteVis ? "GÖRÜNÜR ⚠" : "gizli ✓");

// PRO: config nəzərə alınmır → görünməlidir
await setMode("Pro");
const proVis = await ticaretOzetVisible();
console.log("PRO-da Ticarət xülasə kartları:", proVis ? "görünür ✓" : "GİZLİ ⚠");

// Bərpa: ozet-i geri qaytar
await page.goto(BASE + "/ayarlar/gorunis", NAV);
await page.waitForTimeout(2000);
const ozet2 = page.locator('label:has-text("Xülasə kartları (bugün") input[type="checkbox"]').first();
await ozet2.check().catch(async () => { await ozet2.click(); });
await page.locator('button:has-text("Yadda saxla")').click();
await page.waitForTimeout(1500);

console.log("\n===== QİYMƏTLƏNDİRMƏ =====");
console.log(!liteVis && proVis ? "✓ Modul gating DÜZGÜN — Lite config-ə tabe, Pro tam" : "⚠ gözlənilməyən");
console.log("pageerror:", errors.length);
errors.slice(0, 5).forEach((e) => console.log("  💥", e));
await browser.close();
console.log("BİTDİ");
