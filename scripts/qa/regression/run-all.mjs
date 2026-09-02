/**
 * Audit 2026-09-01 — təsdiqlənmiş kritik problemlərin regression dəsti.
 *
 * İşlət: node scripts/qa/regression/run-all.mjs
 *
 * Hər test müstəqil işləyir və öz exit kodunu qaytarır; runner ümumi nəticəni
 * yığır. DB-yə toxunan testlər yalnız OXU edir, yaxud BEGIN…ROLLBACK içində
 * işləyir — production datası dəyişmir.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../../..");

const TESTS = [
  ["R1  sənəd nömrəsi tenant-aware", "node", "r1-sened-nomre.mjs"],
  ["R2  tenant izolyasiyası (statik)", "node", "r2-tenant-isolation.mjs"],
  ["R2b cross-tenant adversarial (ORM)", "tsx", "r2b-tenant-adversarial.ts"],
  ["R3  credential sızması", "tsx", "r3-credential-leak.ts"],
  ["R4  bank emalı authorization", "node", "r4-bank-authz.mjs"],
  ["R5  AI təsdiq/avtorizasiya (statik)", "node", "r5-ai-confirm.mjs"],
  ["R5b AI təsdiq davranışı (adversarial)", "tsx", "r5b-ai-confirm-runtime.ts"],
  ["R6  sənəd nömrəsi parseri (unit)", "tsx", "r6-doc-number-parser.ts"],
  ["R7  nömrə generatoru concurrency", "tsx", "r7-concurrency.ts"],
];

const results = [];
for (const [label, runner, file] of TESTS) {
  const cmd = runner === "tsx" ? "npx" : "node";
  const args = runner === "tsx" ? ["tsx", path.join(DIR, file)] : [path.join(DIR, file)];
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8" });
  const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  const m = out.match(/─── (\d+) keçdi, (\d+) uğursuz/);
  results.push({
    label,
    pass: m ? Number(m[1]) : 0,
    fail: m ? Number(m[2]) : -1,
    code: res.status,
    out,
  });
}

console.log("\n╔══════════════════════════════════════════════════════════════════╗");
console.log("║  AUDIT 2026-09-01 — REGRESSION DƏSTİ                             ║");
console.log("╚══════════════════════════════════════════════════════════════════╝\n");

let totalPass = 0;
let totalFail = 0;
for (const r of results) {
  const mark = r.fail === 0 && r.code === 0 ? "✅" : "❌";
  const stat = r.fail < 0 ? "nəticə oxunmadı" : `${r.pass} keçdi, ${r.fail} uğursuz`;
  console.log(`  ${mark} ${r.label.padEnd(40)} ${stat}`);
  if (r.fail > 0 || r.code !== 0) {
    for (const line of r.out.split("\n").filter((l) => l.includes("❌"))) {
      console.log(`       ${line.trim()}`);
    }
  }
  totalPass += Math.max(0, r.pass);
  totalFail += Math.max(0, r.fail);
}

const suitesFailed = results.filter((r) => r.fail !== 0 || r.code !== 0).length;
console.log(`\n  CƏMİ: ${totalPass} yoxlama keçdi, ${totalFail} uğursuz · ${results.length - suitesFailed}/${results.length} dəst təmiz\n`);
process.exit(suitesFailed > 0 ? 1 : 0);
