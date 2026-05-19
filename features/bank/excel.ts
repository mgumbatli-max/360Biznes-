import "server-only";
import ExcelJS from "exceljs";

export const BANK_TEMPLATE_COLUMNS = [
  { key: "kod", header: "Satış kodu / Qaimə №", width: 24, required: true },
  { key: "mebleg", header: "Məbləğ (₼)", width: 16, required: false },
  { key: "tarix", header: "Tarix (YYYY-MM-DD)", width: 18, required: false },
  { key: "qarsi_hesab", header: "Qarşı hesab", width: 24, required: false },
  { key: "tesvir", header: "Təsvir / Qeyd", width: 50, required: false },
] as const;

const SAMPLE_ROWS: Record<string, string | number>[] = [
  { kod: "ST-00123", mebleg: 250.5, tarix: "2026-05-14", qarsi_hesab: "AZ77NABZ...", tesvir: "Birmarket köçürmə" },
  { kod: "ST-00124", mebleg: 1290.0, tarix: "2026-05-14", qarsi_hesab: "", tesvir: "POS terminal kart ödənişi" },
  { kod: "BIRMARKET-2026-001", mebleg: 540.75, tarix: "2026-05-13", qarsi_hesab: "Birmarket MMC", tesvir: "Komissiya çıxılıb" },
];

export async function generateBankTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "360Biznes";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Bank Çıxarışı", {
    properties: { tabColor: { argb: "FF3B82F6" } },
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = BANK_TEMPLATE_COLUMNS.map((c) => ({
    key: c.key,
    header: c.header + (c.required ? " *" : ""),
    width: c.width,
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.height = 26;
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "medium", color: { argb: "FF1E40AF" } },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  for (const r of SAMPLE_ROWS) {
    const added = sheet.addRow(r);
    added.font = { italic: true, color: { argb: "FF94A3B8" } };
  }

  const note = sheet.addRow(["↑ Yuxarıda nümunələr — silə bilərsiz. Aşağıya öz bank çıxarışı sətirlərinizi yazın ↓"]);
  note.font = { italic: true, color: { argb: "FFB91C1C" }, size: 10 };
  sheet.mergeCells(`A${note.number}:E${note.number}`);

  for (let i = 0; i < 30; i++) sheet.addRow({});

  // Instruction sheet
  const info = wb.addWorksheet("Təlimat", { properties: { tabColor: { argb: "FF64748B" } } });
  info.columns = [{ width: 30 }, { width: 80 }];

  info.addRow(["360BİZNES — Bank Çıxarışı Şablonu"]).font = { bold: true, size: 14, color: { argb: "FF3B82F6" } };
  info.addRow([
    "Necə işləyir?",
    "Sistem hər sətrin «Satış kodu / Qaimə №» sütununu satış sənədlərindəki qaimə nömrəsi ilə müqayisə edir. Match olsa borcu avto bağlayır.",
  ]);
  info.addRow([]);
  info.addRow(["Sütun", "İzah"]).font = { bold: true };
  for (const c of BANK_TEMPLATE_COLUMNS) {
    info.addRow([c.header, c.required ? "Məcburi ✱" : "Opsional"]);
  }
  info.addRow([]);
  info.addRow(["İpuçları:", ""]);
  info.addRow(["•", "Kod hər satışın qaimə_nömrəsi və ya cek_nömrəsi ilə uyğunlaşdırılır"]);
  info.addRow(["•", "Birmarket/Wolt/Tap üçün öz unikal kod sistemi istifadə edin"]);
  info.addRow(["•", "POS terminal üçün cek nömrəsi yazın"]);
  info.addRow(["•", "Tapılmayan kodlar manual əl ilə təsdiq olunur"]);
  info.addRow(["•", "Komissiya çıxıbsa təsvirə yazın — sistem fərqi xərc kimi qeydə alır"]);

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export type BankRow = {
  sira: number;
  kod: string | null;
  mebleg: number | null;
  tarix: string | null;
  qarsi_hesab: string | null;
  tesvir: string | null;
  errors: string[];
};

export async function parseBankExcel(buffer: ArrayBuffer): Promise<BankRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];

  // Build column index by header text
  const colMap = new Map<number, string>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const text = String(cell.text ?? "").trim().toLowerCase();
    for (const c of BANK_TEMPLATE_COLUMNS) {
      if (text === c.header.toLowerCase() || text === c.header.toLowerCase() + " *") {
        colMap.set(col, c.key);
        break;
      }
    }
    // common aliases
    if (text.includes("kod")) colMap.set(col, "kod");
    else if (text.includes("məbləğ") || text.includes("mebleg") || text.includes("məbleğ")) colMap.set(col, "mebleg");
    else if (text.includes("tarix")) colMap.set(col, "tarix");
    else if (text.includes("təsvir") || text.includes("qeyd") || text.includes("izah")) colMap.set(col, "tesvir");
    else if (text.includes("hesab")) colMap.set(col, "qarsi_hesab");
  });

  if (colMap.size === 0) return [];

  const out: BankRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw: Record<string, unknown> = {};
    colMap.forEach((key, col) => {
      const cell = row.getCell(col);
      raw[key] = cell.result ?? cell.value ?? cell.text;
    });

    const kod = raw.kod ? String(raw.kod).trim() : null;
    const meblegStr = String(raw.mebleg ?? "").replace(",", ".").replace(/[^\d.-]/g, "");
    const mebleg = meblegStr ? Number(meblegStr) : null;

    let tarix: string | null = null;
    const tarixRaw = raw.tarix;
    if (tarixRaw instanceof Date) tarix = tarixRaw.toISOString().slice(0, 10);
    else if (tarixRaw) {
      const s = String(tarixRaw).trim();
      const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) tarix = `${iso[1]}-${iso[2]}-${iso[3]}`;
      else {
        const d = new Date(s);
        if (!Number.isNaN(d.getTime())) tarix = d.toISOString().slice(0, 10);
      }
    }

    const errors: string[] = [];
    if (!kod) errors.push("Kod boşdur (satış nömrəsi tələb olunur)");

    // skip completely empty rows
    if (!kod && mebleg == null && !tarix) return;

    out.push({
      sira: rowNumber,
      kod,
      mebleg,
      tarix,
      qarsi_hesab: raw.qarsi_hesab ? String(raw.qarsi_hesab).trim() : null,
      tesvir: raw.tesvir ? String(raw.tesvir).trim() : null,
      errors,
    });
  });

  return out;
}
