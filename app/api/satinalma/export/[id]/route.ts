import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { getProposalDetail } from "@/features/satinalma/queries";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });

  const { id } = await ctx.params;
  const teklif = await getProposalDetail(Number(id));
  if (!teklif) return NextResponse.json({ error: "Tapılmadı" }, { status: 404 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "360Biznes";
  wb.created = new Date();

  // === MAIN SHEET ===
  const sheet = wb.addWorksheet("Təklif", {
    properties: { tabColor: { argb: "FF10B981" } },
    views: [{ state: "frozen", ySplit: 6 }],
  });

  // Title block
  sheet.mergeCells("A1:H1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `Satınalma Təklifi — ${teklif.kod}`;
  titleCell.font = { size: 16, bold: true, color: { argb: "FF10B981" } };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 26;

  const metaRows: Array<[string, string]> = [
    ["Təklif kodu:", teklif.kod],
    ["Ad:", teklif.ad ?? "—"],
    ["Yaradan:", teklif.yaradan?.ad_soyad ?? "—"],
    ["Filial:", teklif.filial?.ad ?? "—"],
    ["Yaradıldı:", new Date(teklif.yaradildi).toLocaleString("az-AZ")],
    ["Status:", teklif.status],
  ];
  for (let i = 0; i < metaRows.length; i++) {
    const row = sheet.getRow(2 + i);
    row.getCell(1).value = metaRows[i][0];
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = metaRows[i][1];
  }

  // Header
  const headers = [
    "#",
    "Məhsul adı",
    "Kod",
    "Marka",
    "Kateqoriya",
    "Vahid",
    "Miqdar",
    "Bazar qiyməti",
    "Son alış",
    "Təklif qiymət",
    "Sat. qiymət",
    "Marja %",
    "Cəmi (təklif)",
    "Cəmi (maya)",
    "Mənfəət",
    "Təchizatçı",
    "Təyinat",
    "Şəkil",
    "Yeni məh.",
    "Servis",
    "Qeyd",
  ];
  const headerRow = sheet.getRow(9);
  for (let i = 0; i < headers.length; i++) {
    const cell = headerRow.getCell(i + 1);
    cell.value = headers[i];
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10B981" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin" } };
  }
  headerRow.height = 32;

  // Body
  let total_meblegh = 0;
  let total_maya = 0;
  for (let i = 0; i < teklif.satirlar.length; i++) {
    const s = teklif.satirlar[i];
    const miqdar = Number(s.miqdar);
    const teklifQ = Number(s.teklif_qiymeti ?? 0);
    const sonAlish = Number(s.son_alish_qiymeti ?? 0);
    const satisQ = Number(s.satis_qiymeti ?? 0);
    const cemiTeklif = miqdar * teklifQ;
    const cemiMaya = miqdar * sonAlish;
    const mənfeet = (satisQ - teklifQ) * miqdar;
    const marja = teklifQ > 0 ? ((satisQ - teklifQ) / teklifQ) * 100 : 0;
    total_meblegh += cemiTeklif;
    total_maya += cemiMaya;

    const r = sheet.getRow(10 + i);
    r.getCell(1).value = i + 1;
    r.getCell(2).value = s.mehsul_adi;
    r.getCell(3).value = s.mehsul_kod ?? "";
    r.getCell(4).value = s.marka ?? "";
    r.getCell(5).value = s.kateqoriya ?? "";
    r.getCell(6).value = s.vahid ?? "ed";
    r.getCell(7).value = miqdar;
    r.getCell(8).value = Number(s.bazar_qiymeti ?? 0);
    r.getCell(9).value = sonAlish;
    r.getCell(10).value = teklifQ;
    r.getCell(11).value = satisQ;
    r.getCell(12).value = marja.toFixed(1) + "%";
    r.getCell(13).value = cemiTeklif;
    r.getCell(14).value = cemiMaya;
    r.getCell(15).value = mənfeet;
    r.getCell(16).value = s.techizatci?.ad ?? s.techizatci_ad ?? "";
    r.getCell(17).value = s.teyinat ?? "";
    r.getCell(18).value = s.shekil_url ?? "";
    r.getCell(19).value = s.yeni_mehsul ? "BƏLİ" : "";
    r.getCell(20).value = s.servis_mehsulu ? "BƏLİ" : "";
    r.getCell(21).value = s.qeyd ?? "";

    // money formatting
    [8, 9, 10, 11, 13, 14, 15].forEach((c) => {
      r.getCell(c).numFmt = "#,##0.00 ₼";
    });
    if (mənfeet < 0) r.getCell(15).font = { color: { argb: "FFDC2626" } };
  }

  // Totals row
  const totalRow = sheet.getRow(10 + teklif.satirlar.length + 1);
  totalRow.getCell(1).value = "CƏM";
  totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(7).value = teklif.satirlar.reduce((s, l) => s + Number(l.miqdar), 0);
  totalRow.getCell(13).value = total_meblegh;
  totalRow.getCell(14).value = total_maya;
  totalRow.getCell(15).value = total_meblegh - total_maya;
  [7, 13, 14, 15].forEach((c) => {
    totalRow.getCell(c).font = { bold: true };
    totalRow.getCell(c).numFmt = c === 7 ? "#,##0" : "#,##0.00 ₼";
  });

  // column widths
  const widths = [4, 36, 14, 14, 16, 8, 10, 14, 14, 14, 14, 10, 16, 16, 16, 22, 30, 30, 10, 10, 30];
  for (let i = 0; i < widths.length; i++) sheet.getColumn(i + 1).width = widths[i];

  // === SUMMARY SHEET ===
  const summary = wb.addWorksheet("Xülasə", {
    properties: { tabColor: { argb: "FF6366F1" } },
  });
  summary.columns = [{ width: 28 }, { width: 24 }];

  const rows: Array<[string, string | number]> = [
    ["Satınalma Təklifi", teklif.kod],
    ["", ""],
    ["Yaradan əməkdaş", teklif.yaradan?.ad_soyad ?? "—"],
    ["Email", teklif.yaradan?.email ?? "—"],
    ["Filial", teklif.filial?.ad ?? "—"],
    ["Yaradıldı", new Date(teklif.yaradildi).toLocaleString("az-AZ")],
    ["Status", teklif.status],
    ["", ""],
    ["Cəmi sətir", teklif.satirlar.length],
    ["Cəmi miqdar", teklif.satirlar.reduce((s, l) => s + Number(l.miqdar), 0)],
    ["Cəmi məbləğ (təklif)", `${total_meblegh.toFixed(2)} ₼`],
    ["Cəmi maya", `${total_maya.toFixed(2)} ₼`],
    ["Gözlənilən mənfəət", `${(total_meblegh - total_maya).toFixed(2)} ₼`],
    ["", ""],
    ["Yeni məhsullar", teklif.satirlar.filter((s) => s.yeni_mehsul).length],
    ["Servis məhsulları", teklif.satirlar.filter((s) => s.servis_mehsulu).length],
  ];
  for (const [k, v] of rows) {
    const r = summary.addRow([k, v]);
    if (k) r.getCell(1).font = { bold: true };
  }

  if (teklif.qeyd) {
    summary.addRow([]);
    summary.addRow(["Qeyd:", teklif.qeyd]).getCell(1).font = { bold: true };
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(arrayBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="satinalma_${teklif.kod}.xlsx"`,
      "Cache-Control": "no-cache",
    },
  });
}
