import { chromium } from "playwright";
const BASE = "http://localhost:3500";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.fill('input[name="email"]', "test-sahibkar@example.com");
await page.fill('input[name="password"]', "Test1234!");
await page.click('button[type="submit"]');
await page.waitForTimeout(3500);

// 1) Təsvir generasiyası
const d = await ctx.request.post(BASE + "/api/anbar/ai/generate-description", {
  data: { ad: "Paslanmayan polad çaydan 3L", kateqoriya: "Mətbəx" },
  timeout: 60000,
});
const dj = await d.json().catch(() => ({}));
console.log("DESC:", d.status(), "is_mock:", dj.is_mock, "| text:", (dj.text ?? dj.error ?? "").slice(0, 220));

// 2) Şəkil generasiyası (Pollinations flux — 50s-ə qədər çəkə bilər)
const i = await ctx.request.post(BASE + "/api/anbar/ai/generate-image", {
  data: { prompt: "Paslanmayan polad çaydan 3L" },
  timeout: 90000,
});
const ij = await i.json().catch(() => ({}));
console.log("IMG:", i.status(), "| provider:", ij.provider, "| url:", ij.url ?? ij.error);

// 3) URL faktiki açılır?
if (ij.url) {
  const img = await ctx.request.get(ij.url.startsWith("http") ? ij.url : BASE + ij.url);
  const buf = await img.body();
  console.log("IMG-FETCH:", img.status(), "| bytes:", buf.length, "| content-type:", img.headers()["content-type"]);
}
await browser.close();
