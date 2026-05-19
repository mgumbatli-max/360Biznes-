import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { withTenant } from "@/lib/db/with-tenant";
import { getStokRows } from "@/features/anbar/stok-queries";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const rows = await withTenant(() =>
    getStokRows({
      search: sp.get("q") ?? undefined,
      anbar_id: sp.get("anbar") ? Number(sp.get("anbar")) : undefined,
      status:
        sp.get("status") === "az" || sp.get("status") === "ok"
          ? (sp.get("status") as "az" | "ok")
          : undefined,
    })
  );

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Stok");
  sheet.columns = [
    { header: "Məhsul",       key: "ad",          width: 36 },
    { header: "Kod",          key: "kod",         width: 16 },
    { header: "Barkod",       key: "barkod",      width: 18 },
    { header: "Anbar",        key: "anbar_ad",    width: 18 },
    { header: "Qalıq",        key: "miqdar",      width: 12 },
    { header: "Vahid",        key: "vahid",       width: 8 },
    { header: "Min",          key: "min_stok",    width: 10 },
    { header: "Son qiymət",   key: "son_qiymet",  width: 14 },
    { header: "Cəm dəyər",    key: "cem_deyer",   width: 14 },
    { header: "Vəziyyət",     key: "status",      width: 10 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6D28D9" } };
  });
  for (const r of rows) sheet.addRow(r);

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="360biznes-stok.xlsx"',
    },
  });
}
