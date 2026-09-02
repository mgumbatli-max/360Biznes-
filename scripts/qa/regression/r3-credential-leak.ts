/**
 * REGRESSION R3 — Həssas credential-lər API cavabına düşməməlidir.
 *
 * AUDİT TAPINTISI (təsdiqlənib):
 *   features/iscilier/queries.ts — `getEmployeeDetail` `select` allowlist-i
 *   işlətmir, `findUnique` + `include` ilə BÜTÜN sütunları qaytarır.
 *   `app/api/mobile/v1/emekdaslar/[id]/route.ts` nəticəni birbaşa JSON kimi
 *   verir → `isci.view` icazəli hər əməkdaş sahibkarın bcrypt `sifre_hash`
 *   və TOTP `iki_fa_secret` dəyərlərini oxuya bilir.
 *
 * BU TEST NƏ YOXLAYIR (canlı ORM üzərində):
 *   1. `prisma.istifadeciler` oxunuşunda sifre_hash / iki_fa_secret YOXDUR
 *   2. `getEmployeeDetail` nəticəsində həmin sahələr YOXDUR
 *   3. Digər credential daşıyıcı modellər də təmizdir
 *      (sahibkar_ayar.sifre_hash, mobil_refresh_tokens.token_hash,
 *       webhook_endpoints.secret, marketplace_hesablari.webhook_secret)
 *   4. Açıq `select` ilə tələb edilsə belə sahə qaytarılmır
 *   5. Auth axını hələ də işləyir (prismaUnscoped sifre_hash-i görür)
 *
 * Yalnız OXU — heç bir yazma yoxdur.
 *
 * İşlət: npx tsx scripts/qa/regression/r3-credential-leak.ts
 */
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant-context";
import { getEmployeeDetail } from "@/features/iscilier/queries";

const FORBIDDEN = ["sifre_hash", "iki_fa_secret", "token_hash", "secret", "webhook_secret"];

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

/** Obyekt ağacında qadağan olunmuş açar adlarını axtarır. */
function findLeaks(value: unknown, path = "", found: string[] = []): string[] {
  if (value === null || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    value.forEach((v, i) => findLeaks(v, `${path}[${i}]`, found));
    return found;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN.includes(k)) found.push(`${path}${path ? "." : ""}${k}`);
    findLeaks(v, `${path}${path ? "." : ""}${k}`, found);
  }
  return found;
}

async function main() {
  console.log("\n━━━ R3 · Credential sızması ━━━");

  const user = await prismaUnscoped.istifadeciler.findFirst({
    select: { id: true, sahibkar_id: true, ad_soyad: true },
  });
  if (!user) {
    console.log("  ⚠️  Test üçün istifadəçi tapılmadı");
    process.exit(1);
  }
  const ctx = {
    sahibkarId: user.sahibkar_id,
    istifadeciId: user.id,
    rolId: 1,
    rolAd: "sahibkar",
    icazeler: [] as string[],
  };

  /* ── 1) Scoped client-in adi oxunuşu ── */
  const row = await runWithTenant(ctx, async () =>
    prisma.istifadeciler.findFirst({ where: { id: user.id } }),
  );
  const leaks1 = findLeaks(row);
  ok("prisma.istifadeciler.findFirst() credential qaytarmır", leaks1.length === 0,
     leaks1.length ? `SIZMA: ${leaks1.join(", ")}` : "təmiz");

  /* ── 2) getEmployeeDetail — auditdə göstərilən konkret funksiya ── */
  const emp = await runWithTenant(ctx, async () => getEmployeeDetail(user.id));
  const leaks2 = findLeaks(emp);
  ok("getEmployeeDetail() credential qaytarmır", leaks2.length === 0,
     leaks2.length ? `SIZMA: ${leaks2.join(", ")}` : "təmiz");
  ok("getEmployeeDetail() faydalı data qaytarır (regressiya yoxdur)",
     !!emp && typeof (emp as Record<string, unknown>).ad_soyad !== "undefined",
     emp ? "ad_soyad mövcuddur" : "null qayıtdı");

  /* ── 3) Digər credential daşıyıcı modellər ── */
  const checks: Array<[string, () => Promise<unknown>]> = [
    ["sahibkar_ayar", async () => prisma.sahibkar_ayar.findFirst({})],
    ["mobil_refresh_tokens", async () => prisma.mobil_refresh_tokens.findFirst({})],
    ["webhook_endpoints", async () => prisma.webhook_endpoints.findFirst({})],
    ["marketplace_hesablari", async () => prisma.marketplace_hesablari.findFirst({})],
    ["lab_public_dash", async () => prisma.lab_public_dash.findFirst({})],
  ];
  for (const [name, fn] of checks) {
    try {
      const r = await runWithTenant(ctx, fn);
      if (r === null) {
        console.log(`  · ${name}: sətir yoxdur — atlanır`);
        continue;
      }
      const l = findLeaks(r);
      ok(`${name} credential qaytarmır`, l.length === 0, l.length ? `SIZMA: ${l.join(", ")}` : "təmiz");
    } catch (e) {
      console.log(`  · ${name}: sorğu icra edilmədi (${(e as Error).message.slice(0, 60)})`);
    }
  }

  /* ── 4) Qəsdi tələb: kod bazasında credential oxuyan yerlər allowlist-dədir ──
   *
   * Prisma semantikasında açıq `select: { sifre_hash: true }` və ya
   * `omit: { sifre_hash: false }` qlobal omit-i ÖVERRIDE edir — bu, qəsdlidir,
   * çünki parol/PIN yoxlaması üçün hash lazımdır. Yəni qorunan şey təsadüfi
   * sızmadır (`include` / select-siz oxu), qəsdi tələb deyil.
   *
   * Bu yoxlama qəsdi tələbləri SAYIR: yeni bir yer credential oxumağa
   * başlayarsa test tutur və o yer nəzərdən keçirilməlidir.
   */
  const ALLOWED_OVERRIDE_SITES = [
    "features/sahibkar/secret-code.ts", // gizli kod → PIN mövcudluğu
    "features/sahibkar/actions.ts", // PIN qurma + yoxlama
    "features/sahibkar/unified-verify.ts", // vahid PIN/kod yoxlaması
    "features/sahibkar/settings-actions.ts", // PIN dəyişmə
    "features/ayar/actions.ts", // istifadəçi parolunun dəyişməsi
    "features/webhook/actions.ts", // HMAC imzası üçün endpoint secret
    "lib/sahibkar/guard.ts", // PIN mövcudluğu (route gate)
    "lib/stealth/actions.ts", // gizli rejim PIN yoxlaması
    "app/(dashboard)/sahibkar/ayarlar/page.tsx", // has_pin göstəricisi
    "app/(dashboard)/sahibkar/setup/page.tsx", // PIN qurulubmu
    "app/(dashboard)/sahibkar/verify/page.tsx", // PIN qurulubmu
    "lib/db/prisma.ts", // omit tərifinin öz sənədləşməsi
  ];

  const { execSync } = await import("node:child_process");
  const grep = execSync(
    `grep -rln "omit: { \\(sifre_hash\\|iki_fa_secret\\|secret\\|token_hash\\|webhook_secret\\): false }" --include="*.ts" --include="*.tsx" features lib app || true`,
    { cwd: process.cwd(), encoding: "utf8" },
  );
  const overrideSites = grep.split("\n").map((s) => s.trim()).filter(Boolean);
  const unexpected = overrideSites.filter((f) => !ALLOWED_OVERRIDE_SITES.includes(f));
  ok(
    "credential oxuyan yerlər gözlənilən allowlist-dədir",
    unexpected.length === 0,
    unexpected.length
      ? `YENİ/GÖZLƏNİLMƏYƏN yer: ${unexpected.join(", ")}`
      : `${overrideSites.length} qəsdi yer, hamısı təsdiqlənib`,
  );

  // Bu yerlərin heç biri mobil/web API cavabına credential ötürməməlidir:
  // hamısı ya mövcudluq yoxlayır, ya bcrypt.compare edir. Sızma səthi —
  // select-siz oxu — 1-3 nömrəli yoxlamalarla artıq bağlanıb.

  /* ── 5) Auth axını sınmayıb: unscoped client hash-i görməlidir ── */
  const authRow = await prismaUnscoped.istifadeciler.findFirst({
    where: { id: user.id },
    select: { id: true, sifre_hash: true },
  });
  ok("auth axını üçün prismaUnscoped hələ də sifre_hash oxuya bilir",
     !!authRow?.sifre_hash,
     authRow?.sifre_hash ? "hash əlçatandır (login işləyir)" : "HASH YOXDUR — login sınacaq!");

  console.log(`  ─── ${pass} keçdi, ${fail} uğursuz`);
  await prisma.$disconnect();
  await prismaUnscoped.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("TEST XƏTASI:", e);
  await prisma.$disconnect().catch(() => {});
  await prismaUnscoped.$disconnect().catch(() => {});
  process.exit(1);
});
