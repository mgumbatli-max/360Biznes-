import "server-only";
import ExcelJS from "exceljs";
import type { MayaParametrleri, MayaSetiriXam, MayaParseResult } from "./types";
import { hesablaMaya } from "./cost-calculator";

type ParseDetail = { sira?: number; field?: string; message: string };

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[\s ,]/g, (m) => (m === "," ? "." : "")));
    return Number.isFinite(n) ? n : 0;
  }
  // ExcelJS may return rich text objects, formulas, dates — coerce to string first
  if (typeof v === "object") {
    const s = (v as { result?: unknown; text?: unknown }).result ?? (v as { result?: unknown; text?: unknown }).text;
    if (s !== undefined) return toNumber(s);
  }
  return 0;
}

function toText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const s = (v as { result?: unknown; text?: unknown }).result ?? (v as { result?: unknown; text?: unknown }).text;
    if (s !== undefined && s !== null) return String(s).trim();
  }
  return String(v).trim();
}

/**
 * Yüklənmiş .xlsx faylından parametrləri və mal sətirlərini oxuyur, hesablayır.
 * Xəta varsa structured details qaytarır ki, UI hansı sətirdə nə səhv olduğunu göstərsin.
 */
export async function parseMayaExcel(arrayBuffer: ArrayBuffer): Promise<MayaParseResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(arrayBuffer);
  } catch {
    return { ok: false, error: "Fayl Excel (.xlsx) formatında deyil və ya zədələnib." };
  }

  const paramsSheet = wb.getWorksheet("Parametrlər") ?? wb.worksheets[0];
  const itemsSheet = wb.getWorksheet("Mallar") ?? wb.worksheets[1];
  if (!paramsSheet || !itemsSheet) {
    return { ok: false, error: "Şablon strukturu yanlışdır. \"Parametrlər\" və \"Mallar\" vərəqləri tapılmadı. Yeni şablon endirin." };
  }

  // Parametrlər — sıra ardıcıllığı: 2..7 (1-ci sıra header)
  // B sütununda dəyər
  const valyuta_kursu = toNumber(paramsSheet.getCell("B2").value);
  const valyuta_kod = toText(paramsSheet.getCell("B3").value);
  const umumi_dasinma = toNumber(paramsSheet.getCell("B4").value);
  const umumi_gomruk = toNumber(paramsSheet.getCell("B5").value);
  const umumi_toplama = toNumber(paramsSheet.getCell("B6").value);
  const ehtiyat_faizi = toNumber(paramsSheet.getCell("B7").value);

  const issues: ParseDetail[] = [];
  if (valyuta_kursu <= 0) issues.push({ field: "valyuta_kursu", message: "Valyuta kursu 0-dan böyük olmalıdır." });
  if (ehtiyat_faizi < 0 || ehtiyat_faizi > 100) issues.push({ field: "ehtiyat_faizi", message: "Ehtiyat faizi 0..100 aralığında olmalıdır." });

  const parametrler: MayaParametrleri = {
    valyuta_kursu,
    umumi_dasinma,
    umumi_gomruk,
    umumi_toplama,
    ehtiyat_faizi,
    valyuta_kod: valyuta_kod || undefined,
  };

  // Mallar sheet — header sırası 1, data 2+
  const setirler: MayaSetiriXam[] = [];
  itemsSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const ad = toText(row.getCell(2).value);
    const kod = toText(row.getCell(3).value);
    const say = toNumber(row.getCell(4).value);
    const qiymet = toNumber(row.getCell(5).value);

    // Tamamilə boş sətirləri ignor et — istifadəçinin əlavə qoyduğu boşluqlar
    if (!ad && !kod && !say && !qiymet) return;

    if (!ad) issues.push({ sira: setirler.length + 1, field: "ad", message: `Sıra ${rowNumber}: məhsul adı boşdur.` });
    if (say <= 0) issues.push({ sira: setirler.length + 1, field: "say", message: `Sıra ${rowNumber}: say 0-dan böyük olmalıdır.` });
    if (qiymet <= 0) issues.push({ sira: setirler.length + 1, field: "vahid_qiymet", message: `Sıra ${rowNumber}: vahid qiymət 0-dan böyük olmalıdır.` });

    setirler.push({ sira: setirler.length + 1, ad, kod: kod || null, say, vahid_qiymet: qiymet });
  });

  if (setirler.length === 0) {
    return { ok: false, error: "\"Mallar\" vərəqində bir dənə də olsun məhsul tapılmadı. Şablona ən azı bir sətir əlavə edin." };
  }
  if (issues.length > 0) {
    return { ok: false, error: "Faylda doldurulmamış və ya yanlış xanalar var.", details: issues };
  }

  return { ok: true, data: hesablaMaya(parametrler, setirler) };
}
