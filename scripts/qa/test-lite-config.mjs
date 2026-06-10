// Lite konfiqurasiya ayar səhifəsi: render + saxlama + dizayn forması tətbiqi + persist.
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3500";
const NAV = { waitUntil: "domcontentloaded", timeout: 60000 };
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));

async function step(n, fn) { try { await fn(); console.log("✓", n); } catch (e) { console.log("✗", n, "—", String(e.message).slice(0, 140)); } }

await step("login", async () => {
  await page.goto(BASE + "/login", NAV);
  await page.fill('input[name="email"]', "test-sahibkar@example.com");
  await page.fill('input[name="password"]', "Test1234!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);
});

await step("ayar səhifəsi render", async () => {
  await page.goto(BASE + "/ayarlar/gorunis", NAV);
  await page.waitForTimeout(2500);
  const design = await page.getByText("Dizayn forması", { exact: false }).count();
  const dashMod = await page.getByText("Ana səhifə (Dashboard)", { exact: false }).count();
  const preview = await page.getByText("Önizləmə", { exact: false }).count();
  console.log("   Dizayn forması:", design, "| Dashboard modulu:", dashMod, "| Önizləmə:", preview);
});

await step("aksent=mavi seç + Top5 blokunu söndür + saxla", async () => {
  await page.locator('button[title="Mavi"]').click();
  await page.waitForTimeout(300);
  // "Top 5 məhsul" checkbox-unu söndür
  const top5 = page.locator('label:has-text("Top 5 məhsul") input[type="checkbox"]').first();
  if (await top5.count()) await top5.uncheck().catch(async () => { await top5.click(); });
  await page.waitForTimeout(200);
  await page.locator('button:has-text("Yadda saxla")').click();
  await page.waitForTimeout(2500);
  const toast = await page.getByText("saxlanıldı", { exact: false }).count();
  console.log("   saxlama toast:", toast ? "VAR ✓" : "yox ⚠");
});

await step("persist: səhifəni yenidən aç, mavi seçili qalsın", async () => {
  await page.goto(BASE + "/ayarlar/gorunis", NAV);
  await page.waitForTimeout(2000);
  const bluePressed = await page.locator('button[title="Mavi"][aria-pressed="true"]').count();
  console.log("   mavi aksent persist:", bluePressed ? "BƏLİ ✓" : "XEYR ⚠");
});

await step("Lite-ə keç → dashboard-da dizayn forması tətbiq", async () => {
  await page.locator('[aria-label="Görünüş rejimi"] button:has-text("Lite")').click().catch(() => {});
  await page.waitForTimeout(2500);
  await page.goto(BASE + "/dashboard", NAV);
  await page.waitForTimeout(4000);
  const ds = await page.evaluate(() => ({
    lite: document.documentElement.dataset.lite,
    accent: document.documentElement.dataset.accent,
    font: document.documentElement.dataset.font,
    density: document.documentElement.dataset.density,
  }));
  console.log("   <html> dataset:", JSON.stringify(ds));
  console.log("   →", ds.lite === "1" && ds.accent === "blue" ? "✓ Lite + mavi aksent tətbiq olundu" : "⚠ tətbiq olunmadı");
});

console.log("\npageerror:", errors.length);
errors.slice(0, 6).forEach((e) => console.log("  💥", e));
await browser.close();
console.log("BİTDİ");
