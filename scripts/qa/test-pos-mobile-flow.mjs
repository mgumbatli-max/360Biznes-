// Tam mobil POS axını (iPhone, Lite default): məhsul əlavə → səbət sətri → ÖDƏNİŞ sheet.
import { chromium, devices } from "playwright";

const BASE = process.env.BASE || "http://localhost:3500";
const iPhone = devices["iPhone 13"];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...iPhone });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text().slice(0, 160)); });
const NAV = { waitUntil: "domcontentloaded", timeout: 60000 };

async function step(name, fn) {
  try { await fn(); console.log("✓", name); } catch (e) { console.log("✗", name, "—", String(e.message).slice(0, 140)); }
}

await step("login", async () => {
  await page.goto(BASE + "/login", NAV);
  await page.fill('input[name="email"]', "test-sahibkar@example.com");
  await page.fill('input[name="password"]', "Test1234!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);
});

await step("pos + sessiya", async () => {
  await page.goto(BASE + "/pos", NAV);
  await page.waitForTimeout(2500);
  const openBtn = page.locator('button:has-text("Sessiyanı aç"), button:has-text("Kassanı aç")').first();
  if (await openBtn.count()) { try { await openBtn.click({ timeout: 3000 }); await page.waitForTimeout(2500); } catch {} }
});

let added = false;
await step("məhsul axtar + əlavə et", async () => {
  const search = page.locator('input[placeholder*="Barkod" i]').first();
  await search.click();
  await search.fill("test");
  await page.waitForTimeout(2000); // server action + debounce
  // Nəticə dropdown-u: div.shadow-xl > button
  const firstResult = page.locator("div.shadow-xl button").first();
  if (await firstResult.count()) {
    try { await firstResult.click({ timeout: 2500 }); added = true; } catch (e) { console.log("   klik xətası:", e.message.slice(0, 80)); }
  } else {
    console.log("   nəticə dropdown-u tapılmadı");
  }
  console.log("   məhsul əlavə olundu?", added);
});

// Lite rejimi təsdiq
const mode = await page.evaluate(() => localStorage.getItem("pos.mode.v1"));
console.log("   rejim:", mode, "(mobildə lite gözlənilir)");

await step("səbət sətri layout (pozulmayıb?)", async () => {
  await page.waitForTimeout(800);
  const rowCount = await page.locator("ul li").count();
  console.log("   səbət/list elementləri:", rowCount);
  await page.screenshot({ path: "/tmp/shot-mobile-cart.png" });
});

await step("mobil ÖDƏNİŞ sticky bar + sheet", async () => {
  const payBar = page.locator('button:has-text("ÖDƏNİŞ"), button:has-text("Ödəniş")').first();
  if (await payBar.count()) {
    await payBar.click({ timeout: 3000 });
    await page.waitForTimeout(1000);
    console.log("   ödəniş sheet açıldı");
  } else {
    console.log("   ÖDƏNİŞ bar tapılmadı (səbət boş ola bilər)");
  }
  await page.screenshot({ path: "/tmp/shot-mobile-sheet.png" });
});

// Sheet-də Lite kontrol yoxla
const sheetCoupon = await page.getByText("Endirim kodu", { exact: false }).count();
const negd = await page.locator('button:has-text("Nağd")').count();
console.log("\nSheet-də kupon:", sheetCoupon ? "VAR (⚠ Lite-da olmamalı)" : "yox ✓", " | Nağd düyməsi:", negd);

console.log("\n===== NƏTİCƏ =====");
console.log("pageerror/console error:", errors.length);
errors.slice(0, 8).forEach((e) => console.log("  💥", e));
await browser.close();
console.log("BİTDİ — /tmp/shot-mobile-cart.png, /tmp/shot-mobile-sheet.png");
