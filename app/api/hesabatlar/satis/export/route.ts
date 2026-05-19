import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { withTenant } from "@/lib/db/with-tenant";
import {
  getSalesKpi,
  getTopProductsExt,
  getTopCustomersExt,
  getSalesByUser,
  getPaymentMethodSlices,
  getDailySales,
  getSalesPivot,
  type GroupKey,
} from "@/features/hesabatlar/satis-queries";
import { parseDateRange } from "@/features/hesabatlar/shared";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const range = parseDateRange({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined, preset: sp.get("preset") ?? undefined });
  const filter = {
    range,
    anbar_id: sp.get("anbar") ? Number(sp.get("anbar")) : undefined,
    satici_id: sp.get("satici") ?? undefined,
    odenis_nov: sp.get("odenis") ?? undefined,
  };

  const groupParam = (sp.get("group") ?? "gun") as GroupKey;
  const validGroups: GroupKey[] = ["gun", "hefte", "ay", "menecer", "musteri", "anbar", "odenis"];
  const groupKey: GroupKey = validGroups.includes(groupParam) ? groupParam : "gun";

  const [kpi, daily, byPay, byUser, topProducts, topCustomers, pivot] = await withTenant(async () =>
    Promise.all([
      getSalesKpi(filter),
      getDailySales(filter),
      getPaymentMethodSlices(filter),
      getSalesByUser(filter, 50),
      getTopProductsExt(filter, 100),
      getTopCustomersExt(filter, 100),
      getSalesPivot(filter, groupKey),
    ])
  );

  const wb = new ExcelJS.Workbook();

  // Sheet 1: Xülasə
  const sum = wb.addWorksheet("Xülasə");
  sum.columns = [
    { header: "Göstərici", key: "k", width: 32 },
    { header: "Dəyər", key: "v", width: 20 },
  ];
  sum.getRow(1).font = { bold: true };
  sum.addRow({ k: "Dövr", v: `${range.from.toISOString().slice(0, 10)} — ${range.to.toISOString().slice(0, 10)}` });
  sum.addRow({ k: "Sifariş sayı", v: kpi.total_count });
  sum.addRow({ k: "Cəm məbləğ", v: kpi.total_amount });
  sum.addRow({ k: "Cəm endirim", v: kpi.total_discount });
  sum.addRow({ k: "Orta çek", v: kpi.avg_sale });
  sum.addRow({ k: "Ən böyük satış", v: kpi.max_sale });
  sum.addRow({ k: "Yeni müştəri sayı", v: kpi.new_customers });
  sum.addRow({ k: "Qaytarma sayı", v: kpi.return_count });
  sum.addRow({ k: "Qaytarma %", v: kpi.return_rate });

  // Sheet 2: Daily
  const ds = wb.addWorksheet("Gündəlik");
  ds.columns = [
    { header: "Tarix", key: "d", width: 14 },
    { header: "Sifariş", key: "c", width: 12 },
    { header: "Məbləğ", key: "a", width: 16 },
  ];
  ds.getRow(1).font = { bold: true };
  for (const r of daily) ds.addRow({ d: r.date, c: r.count, a: r.amount });

  // Sheet 3: Top products
  const tp = wb.addWorksheet("Top məhsullar");
  tp.columns = [
    { header: "Məhsul", key: "ad", width: 40 },
    { header: "Kod", key: "kod", width: 16 },
    { header: "Sayı", key: "qty", width: 12 },
    { header: "Cəmi", key: "cemi", width: 16 },
  ];
  tp.getRow(1).font = { bold: true };
  for (const r of topProducts) tp.addRow({ ad: r.ad, kod: r.kod, qty: r.satilan_qty, cemi: r.cemi });

  // Sheet 4: Top customers
  const tc = wb.addWorksheet("Top müştərilər");
  tc.columns = [
    { header: "Müştəri", key: "ad", width: 32 },
    { header: "Sifariş", key: "say", width: 12 },
    { header: "Cəmi", key: "cemi", width: 16 },
  ];
  tc.getRow(1).font = { bold: true };
  for (const r of topCustomers) tc.addRow({ ad: r.ad, say: r.sifaris_say, cemi: r.cemi });

  // Sheet 5: Satıcılar
  const su = wb.addWorksheet("Satıcılar");
  su.columns = [
    { header: "Satıcı", key: "ad", width: 28 },
    { header: "Sifariş", key: "say", width: 12 },
    { header: "Cəmi", key: "cemi", width: 16 },
  ];
  su.getRow(1).font = { bold: true };
  for (const r of byUser) su.addRow({ ad: r.ad, say: r.sifaris_say, cemi: r.cemi });

  // Sheet 6: Ödəniş
  const pay = wb.addWorksheet("Ödəniş növü");
  pay.columns = [
    { header: "Növ", key: "n", width: 20 },
    { header: "Sayı", key: "c", width: 12 },
    { header: "Cəmi", key: "a", width: 16 },
  ];
  pay.getRow(1).font = { bold: true };
  for (const r of byPay) pay.addRow({ n: r.odenis_nov, c: r.count, a: r.amount });

  // Sheet 7: Qruplaşdırma (pivot)
  const pv = wb.addWorksheet(`Qrup — ${groupKey}`);
  pv.columns = [
    { header: "Qrup", key: "label", width: 32 },
    { header: "Əlavə", key: "sub", width: 18 },
    { header: "Sifariş", key: "say", width: 12 },
    { header: "Cəmi", key: "cemi", width: 16 },
    { header: "Orta çek", key: "orta", width: 16 },
  ];
  pv.getRow(1).font = { bold: true };
  for (const r of pivot) pv.addRow({ label: r.label, sub: r.sub ?? "", say: r.sifaris_say, cemi: r.cemi, orta: r.orta_chek });

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="satis-hesabati-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
