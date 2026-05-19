import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { withTenant } from "@/lib/db/with-tenant";
import { getPlSummary, getMonthlyPl12 } from "@/features/hesabatlar/maliyye-queries";
import { getExpenseCategories } from "@/features/hesabatlar/pul-queries";
import { parseDateRange } from "@/features/hesabatlar/shared";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const range = parseDateRange({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined, preset: sp.get("preset") ?? undefined });

  const [pl, monthly, expenseCats] = await withTenant(async () =>
    Promise.all([getPlSummary(range), getMonthlyPl12(), getExpenseCategories()])
  );

  const wb = new ExcelJS.Workbook();

  const s1 = wb.addWorksheet("P&L");
  s1.columns = [
    { header: "Sətr", key: "k", width: 38 },
    { header: "Məbləğ (AZN)", key: "v", width: 18 },
  ];
  s1.getRow(1).font = { bold: true };
  s1.addRow({ k: "Dövr", v: `${range.from.toISOString().slice(0, 10)} — ${range.to.toISOString().slice(0, 10)}` });
  s1.addRow({});
  s1.addRow({ k: "Gəlir (satış)", v: pl.revenue });
  s1.addRow({ k: "Qaytarmalar", v: -pl.returns });
  s1.addRow({ k: "COGS", v: -pl.cogs });
  s1.addRow({ k: "Brüt mənfəət", v: pl.gross_profit });
  s1.addRow({ k: "Brüt margin %", v: pl.gross_margin_pct });
  s1.addRow({ k: "OPEX (xərclər)", v: -pl.opex });
  s1.addRow({ k: "Net mənfəət", v: pl.net_profit });
  s1.addRow({ k: "Net margin %", v: pl.net_margin_pct });

  const s2 = wb.addWorksheet("Aylıq");
  s2.columns = [
    { header: "Ay", key: "ay", width: 12 },
    { header: "Gəlir", key: "revenue", width: 16 },
    { header: "COGS", key: "cogs", width: 16 },
    { header: "OPEX", key: "opex", width: 16 },
    { header: "Brüt", key: "gross", width: 16 },
    { header: "Net", key: "net", width: 16 },
  ];
  s2.getRow(1).font = { bold: true };
  for (const r of monthly) s2.addRow(r);

  const s3 = wb.addWorksheet("Xərc kateqoriyaları");
  s3.columns = [
    { header: "Kateqoriya", key: "kateqoriya", width: 28 },
    { header: "Məbləğ", key: "mebleg", width: 16 },
    { header: "Sayı", key: "sayi", width: 10 },
  ];
  s3.getRow(1).font = { bold: true };
  for (const r of expenseCats) s3.addRow(r);

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="maliyye-pl-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
