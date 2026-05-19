import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { getProducts, type ProductFilter } from "@/features/anbar/queries";

function asArray(v: string | string[] | null): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const filter: ProductFilter = {
    search: sp.get("q") ?? undefined,
    kateqoriya_id: sp.getAll("kateq").map(Number).filter(Number.isFinite),
    marka_id: sp.getAll("marka").map(Number).filter(Number.isFinite),
    stok_status: asArray(sp.getAll("stok_status")) as ProductFilter["stok_status"],
  };

  // Fetch ALL pages (capped at 10k for safety)
  const { items } = await getProducts(filter, 1, 10000);

  const wb = new ExcelJS.Workbook();
  wb.creator = "360Biznes";
  wb.created = new Date();
  const ws = wb.addWorksheet("Məhsullar");

  ws.columns = [
    { header: "Ad", key: "ad", width: 40 },
    { header: "Kod", key: "kod", width: 16 },
    { header: "Barkod", key: "barkod", width: 18 },
    { header: "Kateqoriya", key: "kateqoriya", width: 20 },
    { header: "Marka", key: "marka", width: 16 },
    { header: "Maya (AZN)", key: "maya", width: 14 },
    { header: "Satış (AZN)", key: "satis", width: 14 },
    { header: "Margin %", key: "margin", width: 12 },
    { header: "Stok", key: "stok", width: 10 },
    { header: "Kritik stok", key: "kritik", width: 12 },
    { header: "Aktiv", key: "aktiv", width: 8 },
  ];

  // Style header
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2950" } };
  ws.getRow(1).font = { color: { argb: "FFF1F5FB" }, bold: true };

  for (const p of items) {
    const margin = p.alish_qiymeti > 0 ? ((p.satis_qiymeti - p.alish_qiymeti) / p.alish_qiymeti) * 100 : 0;
    ws.addRow({
      ad: p.ad,
      kod: p.kod ?? "",
      barkod: p.barkod ?? "",
      kateqoriya: p.kateqoriya_ad ?? "",
      marka: p.marka_ad ?? "",
      maya: p.alish_qiymeti,
      satis: p.satis_qiymeti,
      margin: p.alish_qiymeti > 0 ? margin / 100 : null,
      stok: p.stok_miqdari,
      kritik: p.kritik_stok ?? "",
      aktiv: p.aktiv ? "Bəli" : "Xeyr",
    });
  }

  // Number formats
  ws.getColumn("maya").numFmt = "#,##0.00";
  ws.getColumn("satis").numFmt = "#,##0.00";
  ws.getColumn("margin").numFmt = "0.0%";
  ws.getColumn("stok").numFmt = "#,##0";
  ws.getColumn("kritik").numFmt = "#,##0";

  // Freeze header
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `mehsullar-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
