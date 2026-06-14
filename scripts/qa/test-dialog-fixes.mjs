// İşçi tab keçidi (#0) + məhsul wizard donması (#7a) — dialog axınları
import { chromium } from "playwright";
const BASE = "http://localhost:3500";
const NAV = { waitUntil: "domcontentloaded", timeout: 45000 };
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 420, height: 780 } }); // mobil ölçü (donma testi)
const p = await ctx.newPage();
await p.goto(BASE + "/login", NAV);
await p.fill('input[name="email"]', process.env.QA_TEST_EMAIL);
await p.fill('input[name="password"]', process.env.QA_TEST_PASSWORD);
await p.click('button[type="submit"]');
await p.waitForTimeout(3500);

const out = [];

// ── TEST 1: İşçi — Şəxsi doldur → İş tab → geri → Şəxsi qalırmı? ──
try {
  await p.goto(BASE + "/iscilier", NAV);
  await p.waitForTimeout(1500);
  // "Yeni işçi" düyməsi
  const btn = p.getByRole("button", { name: /Yeni işçi/i }).first();
  await btn.click();
  await p.waitForTimeout(800);
  await p.fill('input[name="ad_soyad"]', "Test Tab Adam");
  await p.fill('input[name="email"]', "tabtest@example.com");
  // İş tab-a keç
  await p.getByRole("tab", { name: /İş/i }).first().click();
  await p.waitForTimeout(500);
  // Şəxsi tab-a qayıt
  await p.getByRole("tab", { name: /Şəxsi/i }).first().click();
  await p.waitForTimeout(500);
  const ad = await p.inputValue('input[name="ad_soyad"]').catch(() => "");
  const email = await p.inputValue('input[name="email"]').catch(() => "");
  out.push(`İŞÇİ tab keçidi: ad="${ad}" email="${email}" → ${ad === "Test Tab Adam" && email === "tabtest@example.com" ? "✓ QALDI" : "✗ İTDİ"}`);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
} catch (e) {
  out.push("İŞÇİ test XƏTA: " + String(e.message).slice(0, 100));
}

// ── TEST 2: Məhsul wizard — son addıma get, submit düyməsi görünür/əlçatan? ──
try {
  await p.goto(BASE + "/anbar/mehsullar", NAV);
  await p.waitForTimeout(1500);
  await p.getByRole("button", { name: /Yeni məhsul/i }).first().click();
  await p.waitForTimeout(800);
  // Addım göstəricisi ilə 5-ci addıma keç (Növbəti 4 dəfə)
  for (let i = 0; i < 4; i++) {
    const next = p.getByRole("button", { name: /Növbəti|İrəli|Sonrakı/i }).first();
    if (await next.count()) { await next.click().catch(() => {}); await p.waitForTimeout(300); }
  }
  await p.waitForTimeout(500);
  // "Məhsulu yarat" / "Yarat" submit düyməsi DOM-da və viewport-da görünürmü?
  const submit = p.getByRole("button", { name: /Məhsulu yarat|Yarat|Yadda saxla/i }).last();
  const visible = await submit.isVisible().catch(() => false);
  out.push(`MƏHSUL wizard submit düyməsi (mobil): ${visible ? "✓ GÖRÜNÜR (donma yox)" : "✗ GÖRÜNMÜR"}`);
} catch (e) {
  out.push("MƏHSUL test XƏTA: " + String(e.message).slice(0, 100));
}

await b.close();
console.log("\n=== DIALOG FIX TEST ===");
out.forEach((l) => console.log(" " + l));
