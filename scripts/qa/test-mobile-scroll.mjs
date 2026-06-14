// Mobil scroll freeze diaqnostikası: dashboard-da scroll işləyirmi?
import { chromium, devices } from "playwright";

const BASE = process.env.BASE || "http://localhost:3500";
const iPhone = devices["iPhone 13"]; // hasTouch: true
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...iPhone });
const page = await ctx.newPage();
const NAV = { waitUntil: "domcontentloaded", timeout: 60000 };

await page.goto(BASE + "/login", NAV);
await page.fill('input[name="email"]', process.env.QA_TEST_EMAIL);
await page.fill('input[name="password"]', process.env.QA_TEST_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);
await page.goto(BASE + "/dashboard", NAV);
await page.waitForTimeout(4000); // IdleMount + widget-lər yüklənsin (PullToRefresh mount olsun)

const info = await page.evaluate(() => {
  const de = document.documentElement;
  return {
    scrollHeight: de.scrollHeight,
    innerHeight: window.innerHeight,
    scrollable: de.scrollHeight > window.innerHeight + 50,
    htmlOverflow: getComputedStyle(de).overflow,
    bodyOverflow: getComputedStyle(document.body).overflow,
    bodyPosition: getComputedStyle(document.body).position,
    htmlTouchAction: getComputedStyle(de).touchAction,
    bodyTouchAction: getComputedStyle(document.body).touchAction,
    scrollLocked: document.body.hasAttribute("data-scroll-locked") || de.hasAttribute("data-scroll-locked"),
  };
});
console.log("=== layout ===");
console.log(JSON.stringify(info, null, 1));

// Proqram scroll (CSS lock-u istisna et)
await page.evaluate(() => window.scrollTo(0, 400));
await page.waitForTimeout(300);
const y1 = await page.evaluate(() => window.scrollY);
console.log("\nwindow.scrollTo(0,400) sonrası scrollY =", y1, y1 > 0 ? "✓ proqram scroll işləyir" : "⚠ proqram scroll BLOKLU (CSS lock)");

// Touch-drag scroll — streaming widget-lər bitsin deyə uzun gözlə (layout sabit olsun)
await page.waitForTimeout(4000);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
const startEl = await page.evaluate(() => {
  const e = document.elementFromPoint(200, 300);
  return e ? `${e.tagName}.${String(e.className||"").slice(0,30)}` : "yox";
});
console.log("swipe başlanğıc elementi (200,300):", startEl);
const cdp = await ctx.newCDPSession(page);
async function swipe(x, y0, y1) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= 12; i++) {
    const y = y0 + ((y1 - y0) * i) / 12;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
await swipe(200, 300, 60); // content-ortasından yuxarı → aşağı scroll
await page.waitForTimeout(600);
const y2 = await page.evaluate(() => window.scrollY);
console.log("touch swipe (aşағı) sonrası scrollY =", y2, y2 > 0 ? "✓ touch scroll İŞLƏYİR" : "⚠ touch scroll bloklu");

await browser.close();
console.log("\nBİTDİ");
