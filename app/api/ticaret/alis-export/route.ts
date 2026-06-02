import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { withTenant } from "@/lib/db/with-tenant";
import { getPurchases } from "@/features/ticaret/alis-queries";
import { audit } from "@/lib/audit/log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const filterForAudit = {
    search: sp.get("q") ?? undefined,
    status: sp.get("status") ? [sp.get("status") as string] : [],
    from: sp.get("from") ?? null,
    to: sp.get("to") ?? null,
  };
  const { items } = await withTenant(async () => {
    const r = await getPurchases({
      search: sp.get("q") ?? undefined,
      status: sp.get("status") ? [sp.get("status") as string] : [],
      from: sp.get("from") ? new Date(sp.get("from") as string) : undefined,
      to: sp.get("to") ? new Date(sp.get("to") + "T23:59:59") : undefined,
    }, 1, 5000);
    await audit("export", "alis_export", null, {
      yeni_data: { count: r.items.length, filter: filterForAudit },
      sebeb: "Alış siyahısı Excel-ə ixrac edildi",
    });
    return r;
  });

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Alışlar");
  sheet.columns = [
    { header: "Nömrə",         key: "nomre",         width: 18 },
    { header: "Tarix",         key: "tarix",         width: 12 },
    { header: "Təchizatçı",    key: "techizatci_ad", width: 28 },
    { header: "Anbar",         key: "anbar_ad",      width: 18 },
    { header: "Status",        key: "status",        width: 14 },
    { header: "Cəm",           key: "umumi_mebleg",  width: 12 },
    { header: "Ödənilib",      key: "odenilmis",     width: 12 },
    { header: "Sətir",         key: "satir_say",     width: 8 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const it of items) {
    sheet.addRow({ ...it, tarix: it.tarix.toISOString().slice(0, 10) });
  }
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="alislar-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
