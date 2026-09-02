/**
 * REGRESSION R4 — Bank çıxarışının emalı server-side authorization tələb edir.
 *
 * AUDİT TAPINTISI (təsdiqlənib):
 *   features/bank/recon-actions.ts — `processBankStatement` yalnız fayl
 *   ölçüsünü və Excel parse-ı yoxlayır; heç bir icazə guard-ı yoxdur, hətta
 *   guard importu belə yoxdur. Səhifə `/ayarlar/bank-inteqrasiya` yalnız
 *   layout route-gate ilə qorunur, Server Action POST-u isə layout
 *   redirect-indən ƏVVƏL icra olunur → istənilən autentifikasiya olunmuş
 *   istifadəçi (kassir, anbardar) saxta Excel yükləyib müştəri borclarını
 *   bağlaya və bank hesabı balansını artıra bilir.
 *
 * BU TEST NƏ YOXLAYIR (statik analiz — real sessiya tələb etmir):
 *   1. `processBankStatement` icazə guard-ı çağırır
 *   2. Guard action gövdəsinin ƏVVƏLİNDƏ — hər hansı fayl/DB emalından öncə
 *   3. Guard uğursuz olanda erkən `return` var (nəticə nəzərə alınır)
 *   4. features/bank/ altındakı BÜTÜN ixrac olunan action-lar guard-lıdır
 *      (regressiya qoruması — yeni guard-sız action əlavə olunarsa tutulur)
 *   5. Authorization UI-dan asılı deyil: guard server faylındadır
 */
import { read, createRunner } from "./_lib.mjs";

const r = createRunner("R4 · Bank emalı authorization");

const src = read("features/bank/recon-actions.ts");

/* ── 1) Guard çağırılır ── */
const GUARD_RE = /require(Maliyye|Bank)ActionPerm|requireMaliyyePerm|permGate/;
r.ok("recon-actions.ts icazə guard-ı çağırır", GUARD_RE.test(src),
     GUARD_RE.test(src) ? "guard tapıldı" : "HEÇ BİR GUARD YOXDUR");

/* ── 2) Guard action gövdəsinin əvvəlindədir ── */
const fnStart = src.indexOf("export async function processBankStatement");
r.ok("processBankStatement funksiyası tapıldı", fnStart !== -1);

if (fnStart !== -1) {
  const body = src.slice(fnStart);
  const guardPos = body.search(GUARD_RE);
  // Emal addımlarının ilk mövqeyi: fayl oxuma, parse, DB yazma
  const workPos = Math.min(
    ...[
      body.indexOf("arrayBuffer"),
      body.indexOf("parseBankExcel"),
      body.indexOf("prisma."),
      body.indexOf("withTenant"),
    ].filter((i) => i !== -1),
  );
  r.ok(
    "guard bütün emal addımlarından ƏVVƏL çağırılır",
    guardPos !== -1 && guardPos < workPos,
    guardPos === -1
      ? "guard yoxdur"
      : `guard@${guardPos} < iş@${workPos}`,
  );

  /* ── 3) Guard nəticəsi nəzərə alınır (erkən return) ── */
  const guardBlock = body.slice(guardPos, guardPos + 320);
  r.ok(
    "guard uğursuz olanda erkən return var",
    /if\s*\(\s*!\s*\w+\.ok\s*\)\s*return/.test(guardBlock),
    /if\s*\(\s*!\s*\w+\.ok\s*\)\s*return/.test(guardBlock) ? "`if (!g.ok) return` mövcuddur" : "nəticə nəzərə alınmır",
  );

  /* ── 4) Konkret icazə kodları tələb olunur ── */
  const codes = guardBlock.match(/"(bank|maliyye|fin_op)\.[a-z_]+"/g) ?? [];
  r.ok("konkret icazə kodları tələb olunur", codes.length > 0, codes.join(", ") || "kod göstərilməyib");
}

/* ── 5) features/bank/ altındakı bütün action-lar guard-lıdır ── */
const bankActionFiles = ["features/bank/recon-actions.ts"];
for (const f of bankActionFiles) {
  const s = read(f);
  const exported = [...s.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  const unguarded = exported.filter((name) => {
    const i = s.indexOf(`export async function ${name}`);
    const next = s.indexOf("\nexport ", i + 10);
    const fnBody = s.slice(i, next === -1 ? undefined : next);
    return !GUARD_RE.test(fnBody);
  });
  r.ok(
    `${f}: bütün ixrac olunan action-lar guard-lıdır`,
    unguarded.length === 0,
    unguarded.length ? `guard-sız: ${unguarded.join(", ")}` : `${exported.length}/${exported.length}`,
  );
}

/* ── 6) Authorization server faylındadır, UI komponentində deyil ── */
const uploader = read("features/bank/components/recon-uploader.tsx");
r.ok(
  "authorization UI komponentindən asılı deyil",
  !/require\w*Perm/.test(uploader),
  "guard yalnız server action-dadır",
);

const { fail } = r.summary();
process.exit(fail > 0 ? 1 : 0);
