import "server-only";
import ExcelJS from "exceljs";
import { TemplateDef } from "./templates";

export type ParsedRow = {
  sira: number;
  raw: Record<string, string | number | null>;
  values: Record<string, string | number | null>;
  errors: string[];
  /** Bloklamayan xəbərdarlıqlar (məs. satış qiyməti mayadan aşağı) — import-a mane olmur */
  warnings: string[];
};

export type ParseResult = {
  rows: ParsedRow[];
  detectedColumns: string[];
  unrecognizedColumns: string[];
  totalRows: number;
  validRows: number;
  errorRows: number;
};

function toStr(v: unknown): string | null {
  if (v == null) return null;
  // ExcelJS rich text/object cells
  if (typeof v === "object" && v !== null) {
    if ("text" in v) return String((v as { text: unknown }).text ?? "").trim() || null;
    if ("result" in v) return String((v as { result: unknown }).result ?? "").trim() || null;
  }
  const s = String(v).trim();
  return s.length ? s : null;
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const s = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(s) ? s : null;
}

function toBool(v: unknown): boolean | null {
  const s = toStr(v);
  if (!s) return null;
  if (["1", "true", "bəli", "beli", "yes", "y", "aktiv"].includes(s.toLowerCase())) return true;
  if (["0", "false", "xeyr", "no", "n", "passiv"].includes(s.toLowerCase())) return false;
  return null;
}

function toDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = toStr(v);
  if (!s) return null;
  // YYYY-MM-DD or DD.MM.YYYY or DD/MM/YYYY
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const fy = y.length === 2 ? `20${y}` : y;
    return `${fy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

const TYPE_COERCERS: Record<string, (v: unknown) => string | number | null> = {
  ad: (v) => toStr(v),
  ad_soyad: (v) => toStr(v),
  email: (v) => {
    const s = toStr(v);
    return s ? s.toLowerCase() : null;
  },
  telefon: (v) => {
    const s = toStr(v);
    if (!s) return null;
    // normalize azerbaijani phone
    const digits = s.replace(/\D/g, "");
    if (digits.startsWith("994")) return "+" + digits;
    if (digits.startsWith("0")) return "+994" + digits.slice(1);
    if (digits.length === 9) return "+994" + digits;
    return s;
  },
  qohum_tel: (v) => toStr(v),
  voen: (v) => toStr(v),
  iban: (v) => {
    const s = toStr(v);
    return s ? s.replace(/\s+/g, "").toUpperCase() : null;
  },
  fin: (v) => {
    const s = toStr(v);
    return s ? s.toUpperCase() : null;
  },
  tarix: (v) => toDate(v),
  qebul_tarix: (v) => toDate(v),
  tehvil_tarix: (v) => toDate(v),
  dogum: (v) => toDate(v),
  ise_qebul: (v) => toDate(v),
  novbeti_elaqe: (v) => toDate(v),
  say: (v) => toNum(v),
  miqdar: (v) => toNum(v),
  alish_qiymeti: (v) => toNum(v),
  satis_qiymeti: (v) => toNum(v),
  topdan_qiymeti: (v) => toNum(v),
  partnyor_qiymeti: (v) => toNum(v),
  vip_qiymeti: (v) => toNum(v),
  maya: (v) => toNum(v),
  qiymet: (v) => toNum(v),
  qaliq: (v) => toNum(v),
  borc: (v) => toNum(v),
  borc_limit: (v) => toNum(v),
  endirim: (v) => toNum(v),
  vergi: (v) => toNum(v),
  dasima: (v) => toNum(v),
  mebleg: (v) => toNum(v),
  yekun_mebleg: (v) => toNum(v),
  maas: (v) => toNum(v),
  kpi: (v) => toNum(v),
  zemanet: (v) => toNum(v),
  odenis_gun: (v) => toNum(v),
  kritik_stok: (v) => toNum(v),
  aktiv: (v) => {
    const b = toBool(v);
    return b == null ? null : b ? 1 : 0;
  },
};

function buildHeaderMap(template: TemplateDef): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of template.columns) {
    m.set(c.header.toLowerCase(), c.key);
    m.set((c.header + " *").toLowerCase(), c.key);
    m.set(c.key, c.key);
    // strip diacritics & punctuation for fuzzy match
    const norm = c.header
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "");
    m.set(norm, c.key);
  }
  // common aliases
  const aliases: Record<string, string> = {
    "məhsul adı": "ad",
    "məhsulun adı": "ad",
    məhsul: "ad",
    sku: "kod",
    "kod (sku)": "kod",
    qiymet: "satis_qiymeti",
    qiymət: "satis_qiymeti",
    "satış qiymət": "satis_qiymeti",
    "pərakəndə qiymət": "satis_qiymeti",
    stok: "say",
    "ilkin stok": "say",
    "stok say": "say",
    "müktiyət": "say",
    "maya": "alish_qiymeti",
    "maya qiyməti": "alish_qiymeti",
    "ilkin balans": "qaliq",
    "balans": "qaliq",
  };
  for (const [k, v] of Object.entries(aliases)) m.set(k.toLowerCase(), v);
  return m;
}

export async function parseExcel(buffer: ArrayBuffer, template: TemplateDef): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];

  if (!sheet) {
    return { rows: [], detectedColumns: [], unrecognizedColumns: [], totalRows: 0, validRows: 0, errorRows: 0 };
  }

  const headerMap = buildHeaderMap(template);
  const colKeyByIdx = new Map<number, string>();
  const detectedColumns: string[] = [];
  const unrecognizedColumns: string[] = [];

  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const text = String(cell.text ?? "").trim();
    const norm = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "");
    const key = headerMap.get(text.toLowerCase()) ?? headerMap.get(norm);
    if (key) {
      colKeyByIdx.set(col, key);
      if (!detectedColumns.includes(key)) detectedColumns.push(key);
    } else if (text) {
      unrecognizedColumns.push(text);
    }
  });

  const rows: ParsedRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const raw: Record<string, string | number | null> = {};
    const values: Record<string, string | number | null> = {};
    let hasAnyValue = false;

    colKeyByIdx.forEach((key, col) => {
      const cell = row.getCell(col);
      const v = (cell.result ?? cell.value ?? cell.text) as unknown;
      raw[key] = (typeof v === "string" || typeof v === "number" ? v : v == null ? null : String(v));

      const coerce = TYPE_COERCERS[key] ?? toStr;
      const coerced = coerce(v);
      values[key] = coerced;
      if (coerced != null && coerced !== "") hasAnyValue = true;
    });

    if (!hasAnyValue) return; // skip blank rows

    // Şablonun "↑ Bu sətr nümunədir..." qeyd sətrini və nümunə sətrini at —
    // əks halda saxta müştəri/məhsul kimi idxal olunurdu (merged xana bütün sütunlara replikasiya olur).
    if (isNoteRow(values) || isSampleRow(values, template)) return;

    const errors: string[] = [];
    const warnings: string[] = [];

    // check required fields
    for (const c of template.columns) {
      if (!c.required) continue;
      const v = values[c.key];
      if (v == null || v === "") {
        errors.push(`«${c.header}» məcburidir`);
      }
    }

    // template-specific sanity checks
    runTemplateChecks(template.key, values, errors, warnings);

    rows.push({ sira: rowNumber, raw, values, errors, warnings });
  });

  const errorRows = rows.filter((r) => r.errors.length > 0).length;

  return {
    rows,
    detectedColumns,
    unrecognizedColumns,
    totalRows: rows.length,
    validRows: rows.length - errorRows,
    errorRows,
  };
}

/** Köhnə şablonun merged qeyd sətri (hər sütuna replikasiya olunur) */
function isNoteRow(values: Record<string, string | number | null>): boolean {
  for (const x of Object.values(values)) {
    if (typeof x === "string") {
      const s = x.trim().toLowerCase();
      if (x.trim().startsWith("↑") || s.includes("nümunədir") || s.includes("numunedir")) return true;
    }
  }
  return false;
}

/** Şablonun öz nümunə sətri (istifadəçi silməyibsə) — əsas sahə dəyəri ilə tutuşdur */
function isSampleRow(values: Record<string, string | number | null>, template: TemplateDef): boolean {
  if (!template.samples?.length) return false;
  const keyCol = template.columns.find((c) => c.required)?.key ?? template.columns[0]?.key;
  if (!keyCol) return false;
  const cur = values[keyCol];
  if (cur == null || cur === "") return false;
  const curS = String(cur).trim().toLowerCase();
  return template.samples.some((s) => String(s[keyCol] ?? "").trim().toLowerCase() === curS && curS.length > 0);
}

function runTemplateChecks(
  key: string,
  v: Record<string, string | number | null>,
  errors: string[],
  warnings: string[]
) {
  // negative number guards
  const nonNeg = (field: string, label: string) => {
    const x = v[field];
    if (typeof x === "number" && x < 0) errors.push(`«${label}» mənfi ola bilməz`);
  };

  switch (key) {
    case "mehsul":
      nonNeg("say", "İlkin stok");
      nonNeg("satis_qiymeti", "Pərakəndə qiymət");
      nonNeg("alish_qiymeti", "Maya qiyməti");
      if (
        typeof v.alish_qiymeti === "number" &&
        typeof v.satis_qiymeti === "number" &&
        v.satis_qiymeti < v.alish_qiymeti
      ) {
        // Xəbərdarlıq — idxalı bloklamır (əvvəl errors-ə düşür, qanuni sətr "xəta" sayılırdı)
        warnings.push("Pərakəndə qiymət mayadan aşağıdır");
      }
      break;
    case "musteri":
      nonNeg("borc", "İlkin borc qalığı");
      // QA: `tip` validasiyası silindi — DB-yə huquqi_fiziki kimi map olunur, sərt enum xəta verirdi
      // ("Şirkət"/"şəxsi" kimi təbii sözlər "xəta" sayılırdı). İndi sərbəst mətn qəbul olunur.
      break;
    case "techizatci":
      nonNeg("borc", "İlkin borc");
      break;
    case "kassa-baslangic":
      nonNeg("qaliq", "İlkin balans");
      if (v.nov && typeof v.nov === "string" && !["negd", "bank", "kart"].includes(v.nov.toLowerCase())) {
        errors.push("Növ yalnız «negd», «bank» və ya «kart» ola bilər");
      }
      break;
    case "alis":
    case "satis":
      nonNeg("miqdar", "Miqdar");
      nonNeg("maya", "Maya qiymət");
      nonNeg("qiymet", "Satış qiyməti");
      break;
    case "stok":
      nonNeg("miqdar", "Miqdar");
      nonNeg("maya", "Maya qiymət");
      break;
    case "emekdas":
      nonNeg("maas", "Maaş");
      if (typeof v.email === "string" && !/^\S+@\S+\.\S+$/.test(v.email)) {
        errors.push("Email formatı düzgün deyil");
      }
      break;
  }
}
