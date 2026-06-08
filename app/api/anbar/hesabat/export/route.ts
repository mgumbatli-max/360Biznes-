import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import {
  getCategoryReport,
  getAgingReport,
  getProblemReport,
  type ProblemKind,
  type ProblemFilter,
} from "@/features/anbar/hesabat/queries";

const PROBLEM_LABELS: Record<ProblemKind, string> = {
  stokda: "Stokda",
  stoksuz: "Stok yoxdur",
  az_stok: "Az stok",
  kritik: "Kritik stok",
  satilmayan_60: "60+ gün satılmır",
  olu_stok: "Ölü stok (90+ gün)",
  sekilsiz: "Şəkilsiz məhsullar",
  barkodsuz: "Barkodsuz məhsullar",
  mayasiz: "Mayasız məhsullar",
  qiymetsiz: "Qiymətsiz məhsullar",
  kateqoriyasiz: "Kateqoriyasız məhsullar",
  dublikat_ad: "Dublikat ad",
  dublikat_barkod: "Dublikat barkod",
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const mod = sp.get("mod") ?? "kateq";

  const wb = new ExcelJS.Workbook();
  wb.creator = "360Biznes";
  wb.created = new Date();
  const today = new Date().toISOString().slice(0, 10);

  if (mod === "kateq") {
    const rows = await getCategoryReport();
    const ws = wb.addWorksheet("Kateqoriya hesabatı");
    ws.columns = [
      { header: "Kateqoriya", key: "ad", width: 30 },
      { header: "Məhsul sayı", key: "mehsul_say", width: 14 },
      { header: "Stok (ədəd)", key: "stok", width: 14 },
      { header: "Satış dəyəri (AZN)", key: "satis_deyer", width: 20 },
      { header: "Maya dəyəri (AZN)", key: "maya_deyer", width: 20 },
    ];
    rows.forEach((r) => ws.addRow(r));
    formatHeader(ws);
    const buf = await wb.xlsx.writeBuffer();
    return excelResponse(buf, `kateqoriya-hesabati-${today}.xlsx`);
  }

  if (mod === "aging") {
    const r = await getAgingReport();
    const ws = wb.addWorksheet("Yaşlanma hesabatı");
    ws.columns = [
      { header: "Yaş intervalı", key: "interval", width: 30 },
      { header: "Məhsul sayı", key: "say", width: 14 },
    ];
    ws.addRow({ interval: "Son 30 gün satılıb", say: r.son_30 });
    ws.addRow({ interval: "30-60 gün satılmır", say: r.yaslanmis_30_60 });
    ws.addRow({ interval: "60-90 gün satılmır", say: r.yaslanmis_60_90 });
    ws.addRow({ interval: "90+ gün satılmır (ölü stok)", say: r.yaslanmis_90 });
    ws.addRow([]);
    ws.addRow({ interval: "Dondurulmuş maya (AZN)", say: r.olu_maya });
    formatHeader(ws);
    const buf = await wb.xlsx.writeBuffer();
    return excelResponse(buf, `yaslanma-hesabati-${today}.xlsx`);
  }

  // Problem-type reports
  const tip = mod as ProblemKind;
  if (!(tip in PROBLEM_LABELS)) return new NextResponse("Naməlum hesabat növü", { status: 400 });

  const kateqId = Number(sp.get("kateq") ?? "");
  const markaId = Number(sp.get("marka") ?? "");
  const filter: ProblemFilter = {
    q: sp.get("q") ?? undefined,
    kateqId: Number.isFinite(kateqId) && kateqId > 0 ? kateqId : undefined,
    markaId: Number.isFinite(markaId) && markaId > 0 ? markaId : undefined,
    sirala: (sp.get("sirala") as ProblemFilter["sirala"]) ?? "",
  };

  const rows = await getProblemReport(tip, filter);
  const ws = wb.addWorksheet(PROBLEM_LABELS[tip]);
  ws.columns = [
    { header: "Məhsul", key: "ad", width: 40 },
    { header: "Kod", key: "kod", width: 16 },
    { header: "Barkod", key: "barkod", width: 18 },
    { header: "Marka", key: "marka", width: 16 },
    { header: "Stok", key: "stok", width: 10 },
    { header: "Satış qiyməti", key: "satis_qiymeti", width: 14 },
    { header: "Dondurulan maya", key: "dondurulan_maya", width: 16 },
    { header: "Kritik stok", key: "kritik_stok", width: 12 },
    { header: "Min stok", key: "min_stok", width: 10 },
    { header: "Son satış", key: "son_satis", width: 14 },
    { header: "Günlər (satışsız)", key: "gun_evvel", width: 18 },
  ];
  rows.forEach((r) =>
    ws.addRow({
      ...r,
      son_satis: r.son_satis ? new Date(r.son_satis).toISOString().slice(0, 10) : "",
    }),
  );
  formatHeader(ws);
  const buf = await wb.xlsx.writeBuffer();
  return excelResponse(buf, `${tip}-hesabati-${today}.xlsx`);
}

function formatHeader(ws: ExcelJS.Worksheet) {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
}

function excelResponse(buffer: ExcelJS.Buffer, filename: string) {
  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
