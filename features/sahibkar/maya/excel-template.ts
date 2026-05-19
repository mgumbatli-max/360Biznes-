import "server-only";
import ExcelJS from "exceljs";

/**
 * Sahibkar üçün maya hesablama Excel şablonu yaradır.
 *
 * Quruluş:
 *  - Sheet 1 "Parametrlər": qlobal xərc parametrləri (kurs, daşınma, gömrük, toplama, ehtiyat %).
 *  - Sheet 2 "Mallar": hər sətir bir məhsul (ad, kod, say, vahid qiymət xarici valyutada).
 *  - Sheet 3 "İzahat": istifadəçi üçün düstur izahı və nümunə.
 */
export async function generateMayaTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "360biznes";
  wb.created = new Date();

  // ---- Sheet 1: Parametrlər
  const params = wb.addWorksheet("Parametrlər", {
    properties: { tabColor: { argb: "FF6366F1" } },
  });
  params.columns = [
    { header: "Parametr", key: "ad", width: 38 },
    { header: "Dəyər", key: "deyer", width: 18 },
    { header: "Vahid", key: "vahid", width: 14 },
    { header: "Qeyd", key: "qeyd", width: 50 },
  ];
  params.getRow(1).font = { bold: true };
  params.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };

  type ParamRow = { ad: string; deyer: number | string; vahid: string; qeyd: string };
  const paramRows: ParamRow[] = [
    { ad: "Valyuta kursu (1 vahid xarici valyuta = ? AZN)", deyer: 1.7, vahid: "AZN", qeyd: "Misal: USD→AZN üçün 1.7" },
    { ad: "Valyuta kodu (məcburi deyil)", deyer: "USD", vahid: "", qeyd: "USD, EUR, TRY, RUB və s." },
    { ad: "Ümumi daşınma", deyer: 0, vahid: "AZN", qeyd: "Bütün partiyaya verilən daşınma — sətirlərə pay üzrə bölünür" },
    { ad: "Ümumi gömrük", deyer: 0, vahid: "AZN", qeyd: "Bütün partiyaya verilən gömrük — sətirlərə pay üzrə bölünür" },
    { ad: "Ümumi toplama (yığma) xərci", deyer: 0, vahid: "AZN", qeyd: "Birdəfəlik anbara yığma xərci — bölünür" },
    { ad: "Ehtiyat / defekt faizi", deyer: 5, vahid: "%", qeyd: "Defekt, itki, anbara ölü qalan üçün ehtiyat (misal 5%)" },
  ];
  paramRows.forEach((r) => params.addRow(r));
  // Parameter rows visual hint
  params.eachRow({ includeEmpty: false }, (row, idx) => {
    if (idx === 1) return;
    row.getCell(2).numFmt = "#,##0.00";
    row.getCell(2).font = { bold: true };
    row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
  });

  // ---- Sheet 2: Mallar (line items)
  const items = wb.addWorksheet("Mallar", {
    properties: { tabColor: { argb: "FF10B981" } },
  });
  items.columns = [
    { header: "#", key: "sira", width: 6 },
    { header: "Məhsul adı *", key: "ad", width: 42 },
    { header: "Kod / SKU", key: "kod", width: 18 },
    { header: "Say *", key: "say", width: 10 },
    { header: "Vahid qiymət (xarici valyuta) *", key: "qiymet", width: 28 },
  ];
  items.getRow(1).font = { bold: true };
  items.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
  items.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  // Nümunə sətir — istifadəçi pozub öz datasını yaza bilər
  const sample = items.addRow({ sira: 1, ad: "Nümunə məhsul (silə bilərsiniz)", kod: "ABC-001", say: 10, qiymet: 25 });
  sample.font = { italic: true, color: { argb: "FF9CA3AF" } };

  // 30 boş sətir əlavə et — istifadəçi xanaları doldurur, sıra avto-yığılır
  for (let i = 2; i <= 31; i++) {
    items.addRow({ sira: i });
  }
  items.eachRow({ includeEmpty: false }, (row, idx) => {
    row.getCell(4).numFmt = "#,##0";
    row.getCell(5).numFmt = "#,##0.00";
    if (idx > 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: "hair", color: { argb: "FFF3F4F6" } },
          left: { style: "hair", color: { argb: "FFF3F4F6" } },
          right: { style: "hair", color: { argb: "FFF3F4F6" } },
          bottom: { style: "hair", color: { argb: "FFF3F4F6" } },
        };
      });
    }
  });

  // ---- Sheet 3: İzahat
  const info = wb.addWorksheet("İzahat", {
    properties: { tabColor: { argb: "FFF59E0B" } },
  });
  info.columns = [{ width: 100 }];
  const lines = [
    "Maya hesablama şablonu — necə doldurulur",
    "",
    "1) \"Parametrlər\" vərəqində 6 qlobal dəyəri doldur:",
    "   • Valyuta kursu — 1 vahid xarici valyuta neçə AZN-ə bərabərdir",
    "   • Ümumi daşınma (AZN) — bütün partiyaya verilən cəm daşınma",
    "   • Ümumi gömrük (AZN) — cəm gömrük rüsumu",
    "   • Ümumi toplama (AZN) — anbara yığma, daşıma və s. birdəfəlik xərc",
    "   • Ehtiyat / defekt faizi — defekt və itki üçün ehtiyat (misal 5%)",
    "",
    "2) \"Mallar\" vərəqində hər sətir bir məhsul: ad, kod, say, vahid qiymət (xarici valyutada).",
    "",
    "3) Faylı sahibkar/maya səhifəsində yükləyin — sistem hər sətrə görə hesablayacaq:",
    "   • Alış AZN-də (say × qiymət × kurs)",
    "   • Pay faizi (sətrin ümumi alışdakı çəkisi)",
    "   • Daşınma / gömrük / toplama payı (pay üzrə bölünür)",
    "   • Ehtiyat dəyəri (alış + paylar × ehtiyat%)",
    "   • Yekun maya AZN-də və vahid maya qiyməti",
    "",
    "Qeyd: boş sətirlər nəzərə alınmır. Sıra nömrəsi avtomatikdir.",
  ];
  lines.forEach((line, idx) => {
    const row = info.addRow([line]);
    if (idx === 0) row.font = { bold: true, size: 14, color: { argb: "FF6366F1" } };
    else if (line.startsWith("   ")) row.font = { color: { argb: "FF6B7280" } };
  });

  // Set active sheet to "Mallar" so user lands there
  wb.views = [{ activeTab: 1, x: 0, y: 0, width: 12000, height: 24000, firstSheet: 0, visibility: "visible" }];

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}
