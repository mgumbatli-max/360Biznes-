/**
 * REGRESSION R1 — Sənəd nömrəsi tenant-aware olmalıdır.
 *
 * AUDİT TAPINTISI (təsdiqlənib, prod DB-də yoxlanılıb):
 *   8 cədvəldə `nomre` sütunu QLOBAL UNIQUE-dir, sayğac
 *   (`sened_nomre_counter`) isə `(sahibkar_id, prefix, il)` açarı ilə
 *   tenant-üzrədir və nömrə formatında tenantı fərqləndirən komponent
 *   yoxdur → ikinci kirayəçinin ilk sənədi determinist P2002 ilə sınır.
 *
 * Əlavə: 3 ad-hoc generator (`count()+1` / `max+1`) race-safe deyil və
 * silinmiş sətir olduqda təkrar nömrə qaytarır.
 *
 * BU TEST NƏ YOXLAYIR:
 *   1. DB: hər 8 cədvəldə composite UNIQUE(sahibkar_id, nomre) var
 *   2. DB: tək-sütunlu UNIQUE(nomre) constraint-i QALMAYIB
 *   3. DB (adversarial): iki fərqli tenant EYNİ nömrəni ala bilir
 *   4. DB (adversarial): eyni tenant daxilində təkrar nömrə HƏLƏ DƏ bloklanır
 *   5. Kod: ad-hoc generatorlar qalmayıb, hamısı nextDocNumber işlədir
 *   6. Sxem: schema.prisma composite unique-i əks etdirir
 *
 * DB-yə yazan bütün yoxlamalar BEGIN…ROLLBACK içindədir.
 */
import { connect, withRollback, read, createRunner, twoTenants } from "./_lib.mjs";

const TABLES = [
  "alis_sifarisleri",
  "anbar_transferleri",
  "catdirmalar",
  "inventarizasiyalar",
  "qaytarma_sifarisleri",
  "rezervler",
  "satis_sifarisleri",
  "servis_qeydleri",
];

const r = createRunner("R1 · Sənəd nömrəsi tenant-aware");

const c = await connect();
try {
  /* ── 1 & 2: indeks quruluşu ── */
  const idx = await c.query(
    `SELECT t.relname AS tbl,
            i.relname AS idx,
            (SELECT string_agg(a.attname::text, ',' ORDER BY k.ord)
               FROM unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
               JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum) AS cols
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
      WHERE ix.indisunique AND NOT ix.indisprimary AND t.relname = ANY($1)`,
    [TABLES],
  );

  for (const tbl of TABLES) {
    const rows = idx.rows.filter((x) => x.tbl === tbl);
    const composite = rows.find((x) => x.cols === "sahibkar_id,nomre");
    const globalOnly = rows.find((x) => x.cols === "nomre");
    r.ok(`${tbl}: composite UNIQUE(sahibkar_id, nomre) var`, !!composite, composite?.idx ?? "tapılmadı");
    r.ok(`${tbl}: qlobal UNIQUE(nomre) qalmayıb`, !globalOnly, globalOnly ? `hələ var: ${globalOnly.idx}` : "təmiz");
  }

  /* ── 3 & 4: adversarial davranış (ROLLBACK ilə) ── */
  const { a, b } = await twoTenants(c);
  const NUM = "REGR-TEST-9999-000001";

  // 3) İki tenant eyni nömrəni ala bilməlidir
  await withRollback(c, async () => {
    let crossOk = false;
    let detail = "";
    try {
      await c.query(
        `INSERT INTO satis_sifarisleri (sahibkar_id, nomre, tarix) VALUES ($1::uuid, $2, CURRENT_DATE)`,
        [a.id, NUM],
      );
      await c.query(
        `INSERT INTO satis_sifarisleri (sahibkar_id, nomre, tarix) VALUES ($1::uuid, $2, CURRENT_DATE)`,
        [b.id, NUM],
      );
      crossOk = true;
    } catch (e) {
      detail = String(e.message).slice(0, 110);
    }
    r.ok(
      "iki fərqli tenant EYNİ sənəd nömrəsini ala bilir",
      crossOk,
      crossOk ? `${String(a.id).slice(0, 8)} + ${String(b.id).slice(0, 8)}` : detail,
    );
  });

  // 4) Eyni tenant daxilində təkrar HƏLƏ DƏ bloklanmalıdır (qoruma zəifləməyib)
  await withRollback(c, async () => {
    let blocked = false;
    let detail = "";
    try {
      await c.query(
        `INSERT INTO satis_sifarisleri (sahibkar_id, nomre, tarix) VALUES ($1::uuid, $2, CURRENT_DATE)`,
        [a.id, NUM],
      );
      await c.query(
        `INSERT INTO satis_sifarisleri (sahibkar_id, nomre, tarix) VALUES ($1::uuid, $2, CURRENT_DATE)`,
        [a.id, NUM],
      );
      detail = "təkrar nömrə QƏBUL EDİLDİ — unikallıq itib!";
    } catch (e) {
      blocked = /duplicate key|unique/i.test(e.message);
      detail = blocked ? "unique violation (gözlənilən)" : String(e.message).slice(0, 110);
    }
    r.ok("eyni tenant daxilində təkrar nömrə hələ də bloklanır", blocked, detail);
  });

  /* ── 5: ad-hoc generatorlar qalmayıb ── */
  const adhoc = [
    { file: "features/anbar/transfer/actions.ts", fn: "nextTransferNo" },
    { file: "features/anbar/inventar/actions.ts", fn: "nextInventarNo" },
  ];
  for (const { file, fn } of adhoc) {
    const src = read(file);
    r.ok(
      `${file}: ad-hoc "${fn}" generatoru qalmayıb`,
      !src.includes(`async function ${fn}`),
      src.includes(`async function ${fn}`) ? "hələ mövcuddur" : "silinib",
    );
    r.ok(`${file}: nextDocNumber istifadə edir`, src.includes("nextDocNumber"));
  }

  const servis = read("features/servis/actions.ts");
  r.ok(
    "features/servis/actions.ts: max+1 nömrə generatoru qalmayıb",
    !/orderBy:\s*\{\s*nomre:\s*"desc"\s*\}/.test(servis),
    /orderBy:\s*\{\s*nomre:\s*"desc"\s*\}/.test(servis) ? "hələ max+1 işlədir" : "silinib",
  );
  r.ok("features/servis/actions.ts: nextDocNumber istifadə edir", servis.includes("nextDocNumber"));

  // Release gate 2026-09-02: zəmanət→servis çevrilməsi ayrıca generator işlədirdi
  // və `sened_nomre_counter`-dan xəbərsiz idi → prod-da P2002 riski.
  const zemanet = read("features/servis/zemanet-actions.ts");
  r.ok(
    "features/servis/zemanet-actions.ts: SR- max+1 generatoru qalmayıb",
    !/orderBy:\s*\{\s*nomre:\s*"desc"\s*\}/.test(zemanet),
    /orderBy:\s*\{\s*nomre:\s*"desc"\s*\}/.test(zemanet) ? "hələ max+1 işlədir" : "silinib",
  );
  r.ok(
    "features/servis/zemanet-actions.ts: servis nömrəsi nextDocNumber-dən gəlir",
    /nextDocNumber\(tx,\s*sahibkarId,\s*"servis"\)/.test(zemanet),
  );

  // Bütün repo üzrə: `nomre` üzrə max+1 pattern-i heç bir yerdə qalmamalıdır
  const { execSync } = await import("node:child_process");
  const leftovers = execSync(
    `grep -rlE 'orderBy:[[:space:]]*\\{[[:space:]]*nomre:[[:space:]]*"desc"' --include="*.ts" features lib app || true`,
    { cwd: process.cwd(), encoding: "utf8" },
  ).split("\n").map((s) => s.trim()).filter(Boolean);
  r.ok(
    "repo üzrə `orderBy nomre desc` (max+1) pattern-i qalmayıb",
    leftovers.length === 0,
    leftovers.length ? `qalıb: ${leftovers.join(", ")}` : "təmiz",
  );

  /* ── 6: schema.prisma composite unique-i əks etdirir ── */
  const schema = read("prisma/schema.prisma");
  for (const tbl of TABLES) {
    const block = schema.match(new RegExp(`^model ${tbl} \\{([\\s\\S]*?)^\\}`, "m"));
    if (!block) {
      r.ok(`schema: ${tbl} modeli tapıldı`, false, "model yoxdur");
      continue;
    }
    const body = block[1];
    const hasComposite = /@@unique\(\[sahibkar_id,\s*nomre\]/.test(body);
    const hasFieldUnique = /^\s*nomre\s+String\s+@unique/m.test(body);
    r.ok(`schema ${tbl}: @@unique([sahibkar_id, nomre])`, hasComposite);
    r.ok(`schema ${tbl}: sahə-səviyyəli @unique qalmayıb`, !hasFieldUnique);
  }
} finally {
  await c.end();
}

const { fail } = r.summary();
process.exit(fail > 0 ? 1 : 0);
