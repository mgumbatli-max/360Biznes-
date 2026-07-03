import "server-only";
import ExcelJS from "exceljs";
import { TemplateDef } from "./templates";
import { formatDate } from "@/lib/utils";

export async function generateTemplate(template: TemplateDef): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "360Biznes";
  wb.created = new Date();
  wb.modified = new Date();

  // === MAIN SHEET ===
  const sheet = wb.addWorksheet(template.sheetName, {
    properties: { tabColor: { argb: template.tabColor } },
    views: [{ state: "frozen", ySplit: 1, zoomScale: 100 }],
  });

  sheet.columns = template.columns.map((c) => ({
    key: c.key,
    header: c.header + (c.required ? " *" : ""),
    width: c.width,
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.height = 28;
  header.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: template.tabColor },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF334155" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  // QA: Nümunə sətirləri ARTIQ data səhifəsinə yazılmır — əvvəl onlar (və "↑ nümunədir"
  // qeyd sətri) saxta data kimi idxal olunurdu. Nümunələr indi «Təlimat» səhifəsindədir.
  // Data səhifəsi yalnız başlıq + boş sətirlərlə gəlir → istifadəçi birbaşa doldurur.
  for (let i = 0; i < 30; i++) sheet.addRow({});

  // === INSTRUCTION SHEET ===
  const info = wb.addWorksheet("Təlimat", {
    properties: { tabColor: { argb: "FF64748B" } },
  });
  info.columns = [{ width: 30 }, { width: 80 }];

  // title
  info.addRow(["360BİZNES — " + template.title]).font = { bold: true, size: 14, color: { argb: "FF6366F1" } };
  info.addRow([template.desc]).font = { italic: true, color: { argb: "FF64748B" } };
  info.addRow([]);

  // columns
  info.addRow(["Sütun adı", "Tələblər"]).font = { bold: true };
  for (const c of template.columns) {
    const row = info.addRow([
      c.header,
      [c.required ? "Məcburi ✱" : "Opsional", c.hint].filter(Boolean).join(" — "),
    ]);
    if (c.required) row.getCell(2).font = { color: { argb: "FFDC2626" } };
  }

  info.addRow([]);

  // Nümunə dəyərlər — data səhifəsindən çıxarıldı, burada göstərilir (idxala düşmür)
  if (template.samples.length > 0) {
    info.addRow(["NÜMUNƏ (data səhifəsinə yazmayın)", ""]).font = { bold: true, color: { argb: "FF6366F1" } };
    const sample = template.samples[0];
    for (const c of template.columns) {
      const val = sample[c.key];
      if (val !== undefined && val !== "") info.addRow([c.header, String(val)]);
    }
    info.addRow([]);
  }

  // instructions
  if (template.instructions.length > 0) {
    info.addRow(["İpuçları", ""]).font = { bold: true };
    for (const ins of template.instructions) {
      info.addRow(["•", ins]);
    }
    info.addRow([]);
  }

  info.addRow(["Hədəf cədvəl", template.target]).font = { color: { argb: "FF64748B" } };
  info.addRow(["Yaradıldı", formatDate(new Date(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })]);

  // === DATA VALIDATION FOR ENUM-LIKE FIELDS ===
  applyDataValidations(sheet, template);

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function applyDataValidations(sheet: ExcelJS.Worksheet, template: TemplateDef) {
  // ExcelJS exposes dataValidations via a worksheet property but its TS types
  // do not include it; use a cast to access the API at runtime.
  const dv = (sheet as unknown as {
    dataValidations: { add: (range: string, options: Record<string, unknown>) => void };
  }).dataValidations;
  if (!dv?.add) return;

  const colIdx = (key: string) => template.columns.findIndex((c) => c.key === key) + 1;
  const colLetter = (col: number) => String.fromCharCode(64 + col);
  const range = (col: number, fromRow: number, toRow: number) =>
    `${colLetter(col)}${fromRow}:${colLetter(col)}${toRow}`;

  const enumColumns: Array<{ key: string; values: string; allowBlank?: boolean }> = [
    { key: "aktiv", values: "1,0" },
    { key: "tip", values: "sahib,sirket" },
    { key: "nov", values: "negd,bank,kart", allowBlank: false },
    { key: "qiymet_tipi", values: "adi,topdan,vip,partnyor" },
    { key: "valyuta", values: "AZN,USD,EUR,RUB,TRY" },
    { key: "odenis", values: "negd,kart,koc,borc" },
    { key: "maas_tipi", values: "ayliq,saatliq" },
    { key: "funnel_status", values: "yeni,elaqe,teklif,ugur,itki" },
    { key: "veziyyet", values: "yeni,islenmis" },
    { key: "status", values: "tesdiq,legv,qaytarma,odenildi,aciq,qebul,yoxlanir,hazir,tehvil" },
  ];

  for (const e of enumColumns) {
    const col = colIdx(e.key);
    if (col <= 0) continue;
    dv.add(range(col, 2, 1000), {
      type: "list",
      allowBlank: e.allowBlank !== false,
      formulae: [`"${e.values}"`],
    });
  }
}
