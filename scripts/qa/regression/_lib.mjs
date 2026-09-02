/**
 * Regression test dəstəyi — audit 2026-09-01 düzəlişləri üçün.
 *
 * TƏHLÜKƏSİZLİK QAYDASI: bu testlər PRODUCTION bazasına qoşulur.
 * DB-yə toxunan hər test BEGIN ... ROLLBACK içində işləməlidir —
 * `withRollback()` bunu məcbur edir. Heç bir test COMMIT etmir,
 * heç bir mövcud sətir dəyişdirilmir və ya silinmir.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** .env-dən DATABASE_URL oxu (dotenv asılılığı olmadan). */
export function dbUrl() {
  const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
  const m = env.match(/^DATABASE_URL=["']?([^"'\n]+)/m);
  if (!m) throw new Error(".env-də DATABASE_URL tapılmadı");
  return m[1];
}

export async function connect() {
  const c = new pg.Client({ connectionString: dbUrl() });
  await c.connect();
  return c;
}

/**
 * Verilən funksiyanı tranzaksiya içində işlədir və HƏMİŞƏ ROLLBACK edir.
 * Prod datasına heç nə yazılmır — testlər real constraint davranışını
 * yoxlayır, amma iz qoymur.
 */
export async function withRollback(c, fn) {
  await c.query("BEGIN");
  try {
    return await fn();
  } finally {
    await c.query("ROLLBACK");
  }
}

/** Repo-nisbi faylı oxu. */
export function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

export function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

/* ───────────────────── Assertion runner ───────────────────── */

export function createRunner(title) {
  let pass = 0;
  let fail = 0;
  const failures = [];

  console.log(`\n━━━ ${title} ━━━`);

  const ok = (name, cond, detail = "") => {
    if (cond) {
      pass++;
      console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
    } else {
      fail++;
      failures.push(name);
      console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    }
    return cond;
  };

  const summary = () => {
    console.log(`  ─── ${pass} keçdi, ${fail} uğursuz`);
    return { pass, fail, failures };
  };

  return { ok, summary };
}

/** İki fərqli tenant id-si qaytarır (adversarial cross-tenant testlər üçün). */
export async function twoTenants(c) {
  const r = await c.query(
    `SELECT id, ad FROM sahibkarlar ORDER BY yaradildi NULLS LAST, id LIMIT 2`,
  );
  if (r.rows.length < 2) {
    throw new Error(
      `Cross-tenant test üçün ən azı 2 sahibkar lazımdır, tapıldı: ${r.rows.length}`,
    );
  }
  return { a: r.rows[0], b: r.rows[1] };
}
