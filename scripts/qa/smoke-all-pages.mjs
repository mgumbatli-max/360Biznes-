// ERP smoke: əsas səhifələri aç, console/server/404 error + render vəziyyəti tut.
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3500";
const NAV = { waitUntil: "domcontentloaded", timeout: 45000 };

const PAGES = [
  "/dashboard","/nezaret-merkezi","/xeberdarliqlar","/pos",
  "/ticaret","/ticaret/satislar","/ticaret/teklif","/ticaret/alislar","/ticaret/qaytarma","/ticaret/market-satis","/ticaret/kredit","/ticaret/emeliyyat",
  "/anbar/mehsullar","/anbar/stok","/anbar/hereketler","/anbar/transfer","/anbar/inventar","/anbar/anomali","/anbar/bron","/anbar/konsiqnasiya","/anbar/hesabat",
  "/maliyye/emeliyyat","/maliyye/debitor","/maliyye/kreditor","/maliyye/xercler","/maliyye/marketplace","/maliyye/recurring","/maliyye/edv",
  "/elaqe/musteriler","/elaqe/techizatcilar","/crm/leadler","/crm/inbox","/crm/broadcast",
  "/servis","/iscilier","/iscilier/menim-profilim","/tapshiriqlar",
  "/kampaniyalar","/kampaniyalar/loyalty",
  "/hesabatlar","/hesabatlar/maliyye","/hesabatlar/marja","/hesabatlar/musteri","/hesabatlar/pul","/hesabatlar/emekdas",
  "/ayarlar","/ayarlar/rollar","/ayarlar/istifadeci","/ayarlar/gorunis","/audit-log","/tesdiq",
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(BASE + "/login", NAV);
await page.fill('input[name="email"]', "test-sahibkar@example.com");
await page.fill('input[name="password"]', "Test1234!");
await page.click('button[type="submit"]');
await page.waitForTimeout(3500);

const results = [];
for (const path of PAGES) {
  const consoleErr = [];
  const netErr = [];
  const onConsole = (m) => { if (m.type() === "error") consoleErr.push(m.text().slice(0, 160)); };
  const onResp = (r) => { const s = r.status(); if (s >= 400 && /\/(api|_next|ticaret|anbar|maliyye|elaqe|crm|servis|iscilier|tapshiriqlar|kampaniyalar|hesabatlar|ayarlar|dashboard|pos|tesdiq|audit)/.test(r.url())) netErr.push(`${s} ${r.url().replace(BASE,"").slice(0,70)}`); };
  page.on("console", onConsole);
  page.on("response", onResp);
  let status = 0, finalUrl = "", rendered = "?";
  try {
    const resp = await page.goto(BASE + path, NAV);
    status = resp ? resp.status() : 0;
    await page.waitForTimeout(2200);
    finalUrl = page.url().replace(BASE, "");
    // error boundary / boş yoxla
    rendered = await page.evaluate(() => {
      const t = document.body.innerText;
      if (/Something went wrong|Xəta baş verdi|Application error|500|Internal Server/i.test(t)) return "ERROR-BOUNDARY";
      const main = document.querySelector("main");
      return main && main.innerText.trim().length > 20 ? "ok" : "boş?";
    });
  } catch (e) {
    rendered = "NAV-FAIL: " + String(e.message).slice(0, 60);
  }
  page.off("console", onConsole);
  page.off("response", onResp);
  const redirected = finalUrl && !finalUrl.startsWith(path) && finalUrl !== path;
  results.push({ path, status, finalUrl, rendered, redirected, consoleErr, netErr });
}
await browser.close();

// Hesabat
let problems = 0;
console.log("=== SMOKE NƏTİCƏ (problemli səhifələr) ===");
for (const r of results) {
  const bad = r.status >= 400 || r.rendered.startsWith("ERROR") || r.rendered.startsWith("NAV") || r.rendered === "boş?" || r.consoleErr.length || r.netErr.length || (r.redirected && !r.finalUrl.includes("/login"));
  if (bad) {
    problems++;
    console.log(`\n⚠ ${r.path}  [status ${r.status}, render ${r.rendered}${r.redirected ? `, → ${r.finalUrl}` : ""}]`);
    r.netErr.slice(0, 3).forEach((e) => console.log("    net:", e));
    r.consoleErr.slice(0, 3).forEach((e) => console.log("    console:", e));
  }
}
console.log(`\n=== XÜLASƏ: ${PAGES.length} səhifə, ${problems} problemli, ${PAGES.length - problems} təmiz ===`);
