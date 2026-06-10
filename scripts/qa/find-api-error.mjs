// Mobil POS + AI + skaner axınlarını sürüb "api error"-un mənbəyini tapır.
// İşlədir: node scripts/qa/find-api-error.mjs
import { chromium, devices } from "playwright";

const BASE = process.env.BASE || "http://localhost:3500";
const iPhone = devices["iPhone 13"];

let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
} catch {
  browser = await chromium.launch({ headless: true });
}
const ctx = await browser.newContext({ ...iPhone });
const page = await ctx.newPage();

const consoleErrors = [];
const pageErrors = [];
const failedApi = []; // /api/ cavabları status>=400
const toastTexts = [];

page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 260));
});
page.on("pageerror", (e) => pageErrors.push(String(e.message).slice(0, 260)));
page.on("response", async (res) => {
  try {
    const url = res.url();
    const st = res.status();
    if (st >= 400 && /\/api\//.test(url)) {
      let body = "";
      try { body = (await res.text()).slice(0, 200); } catch {}
      failedApi.push(`${st} ${res.request().method()} ${url.replace(BASE, "")} :: ${body}`);
    }
  } catch {}
});

async function captureToasts() {
  try {
    // Sonner/radix toast mətnlərini topla
    const txts = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('[data-sonner-toast], [role="status"], [role="alert"], .toast, li[data-type]').forEach((el) => {
        const t = (el.textContent || "").trim();
        if (t) out.push(t.slice(0, 200));
      });
      return out;
    });
    for (const t of txts) if (!toastTexts.includes(t)) toastTexts.push(t);
  } catch { /* navigasiya gedir, ötür */ }
}

const NAV = { waitUntil: "domcontentloaded", timeout: 60000 };

async function step(name, fn) {
  try { await fn(); console.log("✓", name); }
  catch (e) { console.log("✗", name, "—", String(e.message).slice(0, 160)); }
  await captureToasts();
}

await step("login", async () => {
  await page.goto(BASE + "/login", NAV);
  await page.fill('input[name="email"]', "test-sahibkar@example.com");
  await page.fill('input[name="password"]', "Test1234!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);
  console.log("   URL:", page.url());
});

// AI köməkçi (komekci) — ən ehtimallı "api error" mənbəyi
await step("komekci AI", async () => {
  await page.goto(BASE + "/komekci", NAV);
  await page.waitForTimeout(1500);
  const inp = page.locator('textarea, input[type="text"]').first();
  if (await inp.count()) {
    await inp.fill("Salam, stok haqqında məsləhət ver");
    // göndər düyməsi və ya Enter
    const sendBtn = page.locator('button[type="submit"], button:has-text("Göndər")').first();
    if (await sendBtn.count()) await sendBtn.click().catch(() => {});
    else await inp.press("Enter");
    await page.waitForTimeout(4000);
  }
});

// AI hesabatlar
await step("hesabatlar AI", async () => {
  await page.goto(BASE + "/hesabatlar/ai", NAV);
  await page.waitForTimeout(1500);
  const btn = page.locator('button:has-text("Yarat"), button:has-text("Generasiya"), button:has-text("AI")').first();
  if (await btn.count()) { await btn.click().catch(() => {}); await page.waitForTimeout(4000); }
});

// POS
await step("pos", async () => {
  await page.goto(BASE + "/pos", NAV);
  await page.waitForTimeout(2500);
  console.log("   URL:", page.url());
});

// Bildiriş zəngi (alerts API)
await step("notification bell", async () => {
  await page.goto(BASE + "/dashboard", NAV);
  await page.waitForTimeout(2000);
  const bell = page.locator('button[aria-label*="bildiriş"], button:has(svg.lucide-bell), [data-notification-bell]').first();
  if (await bell.count()) { await bell.click().catch(() => {}); await page.waitForTimeout(1500); }
});

console.log("\n===== NƏTİCƏ =====");
console.log("Uğursuz /api/ cavabları (status>=400):", failedApi.length);
failedApi.slice(0, 20).forEach((e) => console.log("  🔴", e));
console.log("\nConsole error:", consoleErrors.length);
consoleErrors.slice(0, 15).forEach((e) => console.log("  ⚠", e));
console.log("\nPage error:", pageErrors.length);
pageErrors.slice(0, 10).forEach((e) => console.log("  💥", e));
console.log("\nToast/alert mətnləri:", toastTexts.length);
toastTexts.slice(0, 20).forEach((e) => console.log("  🔔", e));

await browser.close();
console.log("\nBİTDİ");
