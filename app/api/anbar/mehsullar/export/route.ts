import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { getProducts, type ProductFilter } from "@/features/anbar/queries";
import { withTenant } from "@/lib/db/with-tenant";
import { audit } from "@/lib/audit/log";
import { canViewCost } from "@/lib/auth/finance-permissions";

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

  // İcazə yoxlaması: maya/marja yalnız sahibkar/admin/maya.gor olanlara
  const canSeeCost = await canViewCost();

  // Fetch ALL pages (capped at 10k for safety)
  const { items } = await getProducts(filter, 1, 10000);
  await withTenant(async () => {
    await audit("export", "mehsul_export", null, {
      yeni_data: { count: items.length, filter, can_see_cost: canSeeCost },
      sebeb: "Məhsul siyahısı Excel-ə ixrac edildi",
    });
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "360Biznes";
  wb.created = new Date();
  const ws = wb.addWorksheet("Məhsullar");

  // Dinamik sütunlar — maya/marja yalnız icazəsi olana göstərilir
  const baseColumns: Array<{ header: string; key: string; width: number }> = [
    { header: "Ad", key: "ad", width: 40 },
    { header: "Kod", key: "kod", width: 16 },
    { header: "Barkod", key: "barkod", width: 18 },
    { header: "Kateqoriya", key: "kateqoriya", width: 20 },
    { header: "Marka", key: "marka", width: 16 },
  ];
  const costColumns: Array<{ header: string; key: string; width: number }> = [
    { header: "Maya (AZN)", key: "maya", width: 14 },
  ];
  const tailColumns: Array<{ header: string; key: string; width: number }> = [
    { header: "Satış (AZN)", key: "satis", width: 14 },
  ];
  const marginColumns: Array<{ header: string; key: string; width: number }> = [
    { header: "Margin %", key: "margin", width: 12 },
  ];
  const stokColumns: Array<{ header: string; key: string; width: number }> = [
    { header: "Stok", key: "stok", width: 10 },
    { header: "Kritik stok", key: "kritik", width: 12 },
    { header: "Aktiv", key: "aktiv", width: 8 },
  ];

  ws.columns = [
    ...baseColumns,
    ...(canSeeCost ? costColumns : []),
    ...tailColumns,
    ...(canSeeCost ? marginColumns : []),
    ...stokColumns,
  ];

  // Style header
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2950" } };
  ws.getRow(1).font = { color: { argb: "FFF1F5FB" }, bold: true };

  for (const p of items) {
    const margin = p.alish_qiymeti > 0 ? ((p.satis_qiymeti - p.alish_qiymeti) / p.alish_qiymeti) * 100 : 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: Record<string, any> = {
      ad: p.ad,
      kod: p.kod ?? "",
      barkod: p.barkod ?? "",
      kateqoriya: p.kateqoriya_ad ?? "",
      marka: p.marka_ad ?? "",
      satis: p.satis_qiymeti,
      stok: p.stok_miqdari,
      kritik: p.kritik_stok ?? "",
      aktiv: p.aktiv ? "Bəli" : "Xeyr",
    };
    if (canSeeCost) {
      row.maya = p.alish_qiymeti;
      row.margin = p.alish_qiymeti > 0 ? margin / 100 : null;
    }
    ws.addRow(row);
  }

  // Number formats — yalnız mövcud sütunlar üçün
  if (canSeeCost) {
    ws.getColumn("maya").numFmt = "#,##0.00";
    ws.getColumn("margin").numFmt = "0.0%";
  }
  ws.getColumn("satis").numFmt = "#,##0.00";
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
