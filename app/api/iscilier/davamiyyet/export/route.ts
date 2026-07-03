import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { getDavamiyyetData } from "@/features/iscilier/davamiyyet-queries";
import { formatDate } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const month = req.nextUrl.searchParams.get("month") ?? undefined;
  const data = await getDavamiyyetData({ month });

  const wb = new ExcelJS.Workbook();
  wb.creator = "360Biznes";
  wb.created = new Date();

  // Sheet 1: Aylıq rapor
  const reportWs = wb.addWorksheet("Aylıq rapor");
  reportWs.columns = [
    { header: "İşçi", key: "ad", width: 32 },
    { header: "Vəzifə", key: "vezife", width: 22 },
    { header: "İş günü", key: "ish_gun", width: 12 },
    { header: "Qaib", key: "qaib", width: 10 },
    { header: "Gecikmə (dq)", key: "gec", width: 14 },
    { header: "Overtime (dq)", key: "overtime", width: 14 },
    { header: "Fasilə (dq)", key: "fasile", width: 12 },
    { header: "İş saat", key: "saat", width: 12 },
  ];
  reportWs.getRow(1).font = { bold: true, color: { argb: "FFF1F5FB" } };
  reportWs.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2950" } };
  for (const r of data.report) {
    reportWs.addRow({
      ad: r.ad_soyad,
      vezife: r.vezife ?? "",
      ish_gun: r.ish_gun,
      qaib: r.qaib_gun,
      gec: r.gec_dq,
      overtime: r.overtime_dq,
      fasile: r.fasile_dq,
      saat: r.ish_saat,
    });
  }
  reportWs.views = [{ state: "frozen", ySplit: 1 }];

  // Sheet 2: Detallı qeydlər
  const detailWs = wb.addWorksheet("Detal");
  detailWs.columns = [
    { header: "Tarix", key: "tarix", width: 12 },
    { header: "İşçi", key: "ad", width: 32 },
    { header: "Növbə", key: "shift", width: 12 },
    { header: "Giriş", key: "giris", width: 10 },
    { header: "Çıxış", key: "cixis", width: 10 },
    { header: "Fasilə (dq)", key: "fasile", width: 12 },
    { header: "İş saat", key: "saat", width: 10 },
    { header: "Gecikmə (dq)", key: "gec", width: 12 },
    { header: "Overtime (dq)", key: "overtime", width: 12 },
    { header: "Status", key: "status", width: 14 },
    { header: "Qeyd", key: "qeyd", width: 40 },
  ];
  detailWs.getRow(1).font = { bold: true, color: { argb: "FFF1F5FB" } };
  detailWs.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2950" } };
  const SHIFT_LABEL: Record<string, string> = { seher: "Səhər", axsam: "Axşam", gece: "Gecə" };
  for (const r of data.rows) {
    detailWs.addRow({
      tarix: new Date(r.tarix).toISOString().slice(0, 10),
      ad: r.istifadeci_ad,
      shift: r.shift ? SHIFT_LABEL[r.shift] ?? r.shift : "",
      giris: r.giris ? formatDate(r.giris, { hour: "2-digit", minute: "2-digit" }) : "",
      cixis: r.cixis ? formatDate(r.cixis, { hour: "2-digit", minute: "2-digit" }) : "",
      fasile: r.fasile_dq,
      saat: r.ish_saatlari ?? 0,
      gec: r.gec_dq,
      overtime: r.overtime_dq,
      status: r.status,
      qeyd: r.qeyd ?? "",
    });
  }
  detailWs.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `davamiyyet-${data.month.il}-${String(data.month.ay).padStart(2, "0")}.xlsx`;
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
