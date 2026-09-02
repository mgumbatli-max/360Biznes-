import "server-only";
import type { prisma } from "./prisma";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Atomic, race-safe sənəd nömrəsi generatoru.
 *
 * Birinci seçim: `next_sened_nomre(uuid, varchar, int)` PG funksiyası
 *   (`sened_nomre_counter` cədvəli + UPSERT ON CONFLICT DO UPDATE RETURNING).
 *
 * Fallback: PG funksiyası yoxdursa (migration tətbiq olunmayıb), eyni
 * cədvəli inline raw SQL ilə UPSERT et. Cədvəl də yoxdursa, son resort
 * kimi `findFirst(orderBy nomre desc) + 1` istifadə olunur — bu race-safe
 * deyil, amma sistemin tamamilə dayanmasının qarşısını alır.
 *
 * Format: `${prefix.toUpperCase()}-${YYYY}-${pad6(num)}`
 *   məs: SATIS-2026-000123
 *
 * @param prefix - 'satis' | 'alis' | 'kredit' | 'market' | 'qaytarma' | 'teklif' | 'transfer'
 */
export type DocPrefix =
  | "satis"
  | "alis"
  | "kredit"
  | "market"
  | "qaytarma"
  | "teklif"
  | "transfer"
  | "mexaric"
  | "sayim"
  | "servis";

const TABLE_MAP: Partial<Record<DocPrefix, { table: string; field: string }>> = {
  satis: { table: "satis_sifarisleri", field: "nomre" },
  alis: { table: "alis_sifarisleri", field: "nomre" },
  market: { table: "satis_sifarisleri", field: "nomre" },
  qaytarma: { table: "qaytarma_sifarisleri", field: "nomre" },
  teklif: { table: "teklifler", field: "nomre" },
  transfer: { table: "anbar_transferleri", field: "nomre" },
  sayim: { table: "inventarizasiyalar", field: "nomre" },
  servis: { table: "servis_qeydleri", field: "nomre" },
};

/**
 * Görünən nömrə prefiksi və pad uzunluğu.
 *
 * Sayğac açarı (`prefix`) ilə istifadəçiyə görünən prefiks BİR OLMAYA BİLƏR.
 * Transfer/sayım/servis modulları tarixən qısa prefikslə (`TR-`, `INV-`, `SR-`)
 * və 5-rəqəmli pad ilə nömrələnib; həmin modullar ad-hoc generatordan mərkəzi
 * `nextDocNumber`-ə keçirilərkən mövcud format QORUNUR — belə ki, artıq
 * verilmiş sənəd nömrələri ilə sıralama və axtarış pozulmasın.
 *
 * Burada qeyd olunmayan prefikslər üçün default davranış saxlanılır:
 * `PREFIX.toUpperCase()` + 6-rəqəmli pad (məs. `SATIS-2026-000123`).
 */
const DISPLAY: Partial<Record<DocPrefix, { label: string; pad: number }>> = {
  transfer: { label: "TR", pad: 5 },
  sayim: { label: "INV", pad: 5 },
  servis: { label: "SR", pad: 5 },
};

/* ══════════════════ Sənəd nömrəsi parseri və sinifləri ══════════════════ */

/**
 * Nömrə sinifləri (audit 2026-09-01).
 *
 *  • `sequential` — mərkəzi sayğacdan gələn ardıcıl nömrə. Sayğacın MAX
 *    hesablamasına DAXİLDİR. Yeni nömrə həmişə buradan verilir.
 *  • `external`   — kənar sistemə və ya təsadüfi dəyərə bağlı nömrə
 *    (marketplace webhook ID-si, lead random kodu, köhnə çatdırma/rezerv
 *    nömrələri). Etibarlı sənəddir, LAKİN sayğaca QƏTİYYƏN daxil edilmir —
 *    əks halda `MAX()` sayğacı süni şəkildə yüz minlərlə irəli sıçradar
 *    (məs. `RZ-2026-902190` sayğacı 902190-a qaldırardı).
 *  • `unknown`    — nə parse olunur, nə də tanınan prefiksə malikdir.
 *    Preflight belə qeyd tapanda DAYANIR (səssiz davam etmir).
 */
export type DocNumberClass = "sequential" | "external" | "unknown";

/**
 * Görünən prefiks → sayğac namespace-i.
 *
 * DİQQƏT: burada yalnız ARDICIL sayğacdan gələn prefikslər ola bilər.
 * Prod datasında (2026-09-01 read-only preflight) təsdiqlənən tarixi
 * prefikslər — bu repodan əvvəlki sistemdən miqrasiya olunub, generator
 * kodu burada yoxdur:
 *   SS, WS, POS → satis   (yaradılma vaxtına görə fasiləsiz 6→15 ardıcıllığı
 *                          ilə sübut edilib: SS-00006…SS-00011, WS-00008,
 *                          POS-202600012…14, SATIS-2026-202600015)
 *   AS          → alis    (AS-2026-00005/00006 → `alis` sayğacı 202600006)
 */
const SEQUENTIAL_PREFIX_MAP: Record<string, DocPrefix> = {
  // ── satış ailəsi ──
  SATIS: "satis",
  S: "satis",
  SS: "satis", // köhnə sistem (miqrasiya datası)
  WS: "satis", // köhnə sistem — web mənbəli satış
  POS: "satis", // köhnə sistem — POS satışı, iki seqmentli format
  // ── ayrı biznes namespace-ləri (qəsdən birləşdirilMİR) ──
  MARKET: "market",
  KREDIT: "kredit",
  // ── alış ailəsi ──
  ALIS: "alis",
  ALS: "alis", // köhnə prefiks
  AS: "alis", // satınalma sifarişi → alış sənədidir
  // ── digər ──
  QAYTARMA: "qaytarma",
  QAY: "qaytarma",
  TR: "transfer",
  TRANSFER: "transfer",
  INV: "sayim",
  SAYIM: "sayim",
  SR: "servis",
  SERVIS: "servis",
  TEKLIF: "teklif",
  MEXARIC: "mexaric",
};

/**
 * Kənar/təsadüfi mənbədən gələn prefikslər — sayğaca DAXİL EDİLMİR.
 *
 *  WH   — marketplace webhook: `WH-{KANAL}-{external_id}`. Nömrə ləğv
 *         axınında sifarişi tapmaq üçün FUNKSİONAL AÇARdır
 *         (app/api/v1/marketplace/orders/[kanal]/route.ts) — ona görə
 *         mərkəzi sayğaca keçirilmir, formatı qorunur.
 *  LEAD — CRM lead→satış çevrilməsinin köhnə random formatı. Yeni qeydlər
 *         artıq `nextDocNumber("satis")` işlədir; bu sinif yalnız tarixi
 *         data üçün saxlanılır.
 *  CT   — çatdırma (köhnə sistem, `CT-2026-563102`, `CT-WEB-<timestamp>`)
 *  RZ   — rezerv (köhnə sistem, `RZ-2026-902190`)
 */
const EXTERNAL_PREFIXES = new Set(["WH", "LEAD", "CT", "RZ"]);

export type ParsedDocNumber = {
  raw: string;
  /** Nömrənin sinfi — sayğac hesablamasına daxil olub-olmadığını müəyyən edir. */
  cls: DocNumberClass;
  /** Görünən prefiks (`SATIS`, `POS`, `WH`…), tapılmazsa null. */
  displayPrefix: string | null;
  /** Sayğac namespace-i — yalnız `sequential` üçün doludur. */
  counterPrefix: DocPrefix | null;
  /** İl — nömrədən çıxarılır, sənədin tarix sütunundan DEYİL. */
  year: number | null;
  /** Sıra nömrəsi — yalnız `sequential` üçün doludur. */
  seq: number | null;
};

/**
 * Sənəd nömrəsini parse edir və sinfini müəyyən edir.
 *
 * Dəstəklənən formatlar:
 *   1. `PREFIKS-İL-SIRA`  → `SATIS-2026-000123`, `TR-2026-00001`  (standart)
 *   2. `PREFIKS-SIRA`     → `POS-202600012`                        (köhnə sistem;
 *      sıra `il×100000 + nömrə` sxemini daşıyır, ona görə il sıradan çıxarılır)
 *   3. Kənar formatlar    → `WH-WOLT-12345`, `CT-WEB-1777941532471`
 *
 * MÖVCUD NÖMRƏLƏR HEÇ VAXT DƏYİŞDİRİLMİR — bu funksiya yalnız oxuyur.
 */
export function parseDocNumber(nomre: string | null | undefined): ParsedDocNumber {
  const raw = (nomre ?? "").trim();
  const empty: ParsedDocNumber = {
    raw, cls: "unknown", displayPrefix: null, counterPrefix: null, year: null, seq: null,
  };
  if (!raw) return empty;

  const prefix = raw.match(/^([A-Z]+)-/)?.[1] ?? null;
  if (!prefix) return empty;

  // Kənar sinif prefiksdən müəyyən olunur — formatından asılı olmayaraq.
  // `CT-2026-563102` standart formadadır, lakin dəyəri təsadüfidir.
  if (EXTERNAL_PREFIXES.has(prefix)) {
    const y = raw.match(/^[A-Z]+-(\d{4})-/)?.[1];
    return { raw, cls: "external", displayPrefix: prefix, counterPrefix: null,
             year: y ? Number(y) : null, seq: null };
  }

  const counterPrefix = SEQUENTIAL_PREFIX_MAP[prefix];
  if (!counterPrefix) return { ...empty, displayPrefix: prefix };

  // Format 1 — PREFIKS-İL-SIRA
  const m3 = raw.match(/^[A-Z]+-(\d{4})-(\d+)$/);
  if (m3) {
    return { raw, cls: "sequential", displayPrefix: prefix, counterPrefix,
             year: Number(m3[1]), seq: Number(m3[2]) };
  }

  // Format 2 — PREFIKS-SIRA (köhnə POS sxemi: sıra `il*100000 + nömrə`)
  const m2 = raw.match(/^[A-Z]+-(\d+)$/);
  if (m2) {
    const seq = Number(m2[1]);
    // 9+ rəqəmli sıra il komponentini daşıyır: 202600012 → il 2026
    const year = seq >= 100_000_000 ? Math.floor(seq / 100_000) : null;
    return { raw, cls: "sequential", displayPrefix: prefix, counterPrefix, year, seq };
  }

  // Tanınan prefiks, lakin tanınmayan format → naməlum (preflight dayandırır)
  return { ...empty, displayPrefix: prefix };
}

/** Nömrə sayğacın MAX hesablamasına daxil edilməlidirmi? */
export function countsTowardCounter(nomre: string | null | undefined): boolean {
  const p = parseDocNumber(nomre);
  return p.cls === "sequential" && p.counterPrefix !== null && p.seq !== null && p.year !== null;
}

export async function nextDocNumber(
  tx: Tx,
  sahibkarId: string,
  prefix: DocPrefix,
  date?: Date,
): Promise<string> {
  const il = (date ?? new Date()).getFullYear();

  // 1) Birinci cəhd — PG funksiyası.
  //
  // ⚠️ Explicit cast-lar VACİBDİR. Prisma JS template-də:
  //   - JS string → `text` (varchar deyil)
  //   - JS number → `bigint` (integer deyil)
  // PG funksiya overload resolution-u strict-dir və `(uuid, text, bigint)`
  // imzasını `(uuid, varchar, integer)` ilə uyğunlaşdırmır → `42883`.
  try {
    const rows = await tx.$queryRaw<{ next_sened_nomre: number }[]>`
      SELECT next_sened_nomre(
        ${sahibkarId}::uuid,
        ${prefix}::varchar,
        ${il}::integer
      ) AS next_sened_nomre
    `;
    const num = rows[0]?.next_sened_nomre ?? 1;
    return formatDocNumber(prefix, il, num);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Yalnız "function does not exist" / "undefined function" üçün fallback-a düş.
    // Digər DB səhvlərini olduğu kimi qaytarırıq.
    const isMissingFn = /does not exist|undefined function|cannot find function/i.test(msg);
    if (!isMissingFn) throw err;
    console.warn(
      "[nextDocNumber] PG function next_sened_nomre tapılmadı — counter table fallback istifadə olunur. " +
        "Migration `2026-05-26-critical-fixes.sql` tətbiq edilməlidir.",
    );
  }

  // 2) İkinci cəhd — counter cədvəlinə inline UPSERT
  try {
    const rows = await tx.$queryRaw<{ son_nomre: number }[]>`
      INSERT INTO sened_nomre_counter (sahibkar_id, prefix, il, son_nomre, yenilendi)
      VALUES (${sahibkarId}::uuid, ${prefix}::varchar, ${il}::integer, 1, NOW())
      ON CONFLICT (sahibkar_id, prefix, il) DO UPDATE
        SET son_nomre = sened_nomre_counter.son_nomre + 1,
            yenilendi = NOW()
      RETURNING son_nomre
    `;
    const num = rows[0]?.son_nomre ?? 1;
    return formatDocNumber(prefix, il, num);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isMissingTable = /does not exist|undefined table/i.test(msg);
    if (!isMissingTable) throw err;
    console.warn(
      "[nextDocNumber] sened_nomre_counter cədvəli də yoxdur — son resort: max+1 fallback. " +
        "Bu race-safe deyil; migration TƏCİLI tətbiq edilməlidir.",
    );
  }

  // 3) Son resort — orijinal cədvəldən max+1 (race-unsafe, amma sistemi dayanan)
  const mapping = TABLE_MAP[prefix];
  if (!mapping) {
    throw new Error(
      `[nextDocNumber] Sənəd nömrəsi yaradılmadı: 'sened_nomre_counter' cədvəli yoxdur və '${prefix}' üçün fallback cədvəli müəyyən edilməyib. Migration tətbiq edin.`,
    );
  }
  return await fallbackMaxPlusOne(tx, sahibkarId, prefix, il, mapping);
}

function formatDocNumber(prefix: DocPrefix, il: number, num: number): string {
  const d = DISPLAY[prefix];
  const label = d?.label ?? prefix.toUpperCase();
  const pad = d?.pad ?? 6;
  return `${label}-${il}-${String(num).padStart(pad, "0")}`;
}

async function fallbackMaxPlusOne(
  tx: Tx,
  sahibkarId: string,
  prefix: DocPrefix,
  il: number,
  mapping: { table: string; field: string },
): Promise<string> {
  // Yalnız whitelist-dən gələn cədvəl/sahə adı istifadə olunur — SQL injection riski yoxdur.
  // Pattern görünən prefiksdən qurulur (DISPLAY map) — yoxsa TR-/INV-/SR- ilə
  // nömrələnən modullarda max həmişə NULL qayıdar və nömrə 1-ə sıfırlanardı.
  const pattern = `${DISPLAY[prefix]?.label ?? prefix.toUpperCase()}-${il}-%`;
  const rows = await tx.$queryRawUnsafe<{ max_nomre: string | null }[]>(
    `SELECT MAX("${mapping.field}") AS max_nomre
       FROM "${mapping.table}"
      WHERE sahibkar_id = $1::uuid
        AND "${mapping.field}" LIKE $2`,
    sahibkarId,
    pattern,
  );
  const maxStr = rows[0]?.max_nomre ?? null;
  const lastNum = maxStr ? Number(maxStr.split("-").pop()) || 0 : 0;
  return formatDocNumber(prefix, il, lastNum + 1);
}
