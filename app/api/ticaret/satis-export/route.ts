import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { withTenant } from "@/lib/db/with-tenant";
import { getSales, type SaleFilter } from "@/features/ticaret/satis-queries";

export const dynamic = "force-dynamic";

function asArray(v: string | null): string[] {
  if (!v) return [];
  return v.split(",").filter(Boolean);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const filter: SaleFilter = {
    search: sp.get("q") ?? undefined,
    status: asArray(sp.get("status")),
    odenis_nov: asArray(sp.get("odenis")),
    from: sp.get("from") ? new Date(sp.get("from") as string) : undefined,
    to: sp.get("to") ? new Date(sp.get("to") + "T23:59:59") : undefined,
    borc:
      sp.get("borc") === "var" || sp.get("borc") === "yox"
        ? (sp.get("borc") as "var" | "yox")
        : undefined,
  };

  const { items } = await withTenant(() => getSales(filter, 1, 5000));

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Satışlar");
  sheet.columns = [
    { header: "Nömrə",      key: "nomre",       width: 18 },
    { header: "Tarix",      key: "tarix",       width: 12 },
    { header: "Müştəri",    key: "musteri_ad",  width: 28 },
    { header: "Satıcı",     key: "satici_ad",   width: 22 },
    { header: "Anbar",      key: "anbar_ad",    width: 18 },
    { header: "Status",     key: "status",      width: 14 },
    { header: "Ödəniş",     key: "odenis_nov",  width: 12 },
    { header: "Cəm",        key: "umumi_mebleg",width: 12 },
    { header: "Endirim",    key: "endirim_mebleg", width: 12 },
    { header: "Yekun",      key: "son_mebleg",  width: 14 },
    { header: "Ödənilib",   key: "odenilmis",   width: 12 },
    { header: "Sətr",       key: "satir_say",   width: 8 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const it of items) {
    sheet.addRow({
      ...it,
      tarix: it.tarix.toISOString().slice(0, 10),
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="satislar-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
