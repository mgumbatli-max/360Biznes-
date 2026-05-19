import "server-only";
import ExcelJS from "exceljs";

export const PRODUCT_TEMPLATE_COLUMNS = [
  { key: "ad",                header: "Məhsulun adı",     width: 36, required: true },
  { key: "kod",               header: "Kod (SKU)",        width: 16, required: false },
  { key: "barkod",            header: "Barkod",           width: 18, required: false },
  { key: "kateqoriya",        header: "Kateqoriya",       width: 22, required: false },
  { key: "marka",             header: "Marka",            width: 18, required: false },
  { key: "vahid",             header: "Ölçü vahidi",      width: 12, required: false },
  { key: "say",               header: "Say (stok)",       width: 10, required: true },
  { key: "alish_qiymeti",     header: "Alış qiyməti",     width: 14, required: false },
  { key: "satis_qiymeti",     header: "Satış qiyməti",    width: 14, required: true },
  { key: "min_satis_qiymeti", header: "Min satış qiyməti",width: 16, required: false },
  { key: "topdan_qiymeti",    header: "Topdan qiymət",    width: 14, required: false },
  { key: "kritik_stok",       header: "Kritik stok",      width: 14, required: false },
  { key: "tesvir",            header: "Məhsul haqqında",  width: 50, required: false },
] as const;

const SAMPLE_ROWS: Record<string, string | number>[] = [
  {
    ad: "iPhone 15 Pro 256GB",
    kod: "IPH15PRO-256",
    barkod: "1234567890123",
    kateqoriya: "Telefonlar",
    marka: "Apple",
    vahid: "əd",
    say: 12,
    alish_qiymeti: 2500,
    satis_qiymeti: 2890,
    min_satis_qiymeti: 2600,
    topdan_qiymeti: 2700,
    kritik_stok: 3,
    tesvir: "Apple iPhone 15 Pro, A17 Pro çip",
  },
];

export async function generateProductTemplate(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "360Biznes";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Məhsullar", {
    properties: { tabColor: { argb: "FF6D28D9" } },
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = PRODUCT_TEMPLATE_COLUMNS.map((c) => ({
    key: c.key,
    header: c.header + (c.required ? " *" : ""),
    width: c.width,
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 22;
  header.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF6D28D9" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF4C1D95" } },
    };
  });

  for (const row of SAMPLE_ROWS) sheet.addRow(row);

  // Info sheet
  const info = wb.addWorksheet("Təlimat");
  info.columns = [{ width: 32 }, { width: 70 }];
  info.addRow(["Sütun", "İzah"]).font = { bold: true };
  for (const c of PRODUCT_TEMPLATE_COLUMNS) {
    info.addRow([c.header, c.required ? "Məcburi sahə" : "Könüllü"]);
  }
  info.addRow([]);
  info.addRow(["Qeyd", "Mövcud məhsul (kod və ya barkod uyğunluğu) avtomatik yenilənir."]);
  info.addRow(["", "Yeni məhsul üçün 'Say' sütununa əsasən default anbarda stok əmələ gəlir."]);

  return wb;
}
