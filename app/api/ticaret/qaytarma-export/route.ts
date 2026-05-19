import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { withTenant } from "@/lib/db/with-tenant";
import { getReturns, type ReturnFilter } from "@/features/qaytarma/queries";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  tesdiqlenmemis: "Gözləyir",
  tamamlandi: "Tamamlandı",
  legv: "Ləğv",
};

const NOV_LABEL: Record<string, string> = {
  satis_qaytarma: "Satış qaytarması",
  alis_qaytarma: "Alış qaytarması",
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const filter: ReturnFilter = {
    search: sp.get("q") ?? undefined,
    nov: (sp.get("nov") as ReturnFilter["nov"]) ?? undefined,
    status: sp.get("status") ?? undefined,
    kontragent_id: sp.get("kontragent") ?? undefined,
    anbar_id: sp.get("anbar") ? Number(sp.get("anbar")) : undefined,
    from: sp.get("from") ? new Date(sp.get("from") as string) : undefined,
    to: sp.get("to") ? new Date(sp.get("to") + "T23:59:59") : undefined,
  };

  const rows = await withTenant(() => getReturns(filter));

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Qaytarmalar");
  sheet.columns = [
    { header: "Nömrə", key: "nomre", width: 18 },
    { header: "Növ", key: "nov", width: 22 },
    { header: "Tarix", key: "tarix", width: 12 },
    { header: "Kontragent", key: "kontragent_ad", width: 28 },
    { header: "Anbar", key: "anbar_ad", width: 18 },
    { header: "Sətir sayı", key: "satir_say", width: 10 },
    { header: "Səbəb", key: "sebeb", width: 32 },
    { header: "Status", key: "status", width: 14 },
    { header: "Məbləğ", key: "umumi_mebleg", width: 14 },
    { header: "Geri qaytarıldı", key: "geri_qaytarildi", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const r of rows) {
    sheet.addRow({
      nomre: r.nomre,
      nov: NOV_LABEL[r.nov] ?? r.nov,
      tarix: r.tarix.toISOString().slice(0, 10),
      kontragent_ad: r.kontragent_ad ?? "",
      anbar_ad: r.anbar_ad ?? "",
      satir_say: r.satir_say,
      sebeb: r.sebeb ?? "",
      status: STATUS_LABEL[r.status] ?? r.status,
      umumi_mebleg: r.umumi_mebleg,
      geri_qaytarildi: r.geri_qaytarildi,
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="qaytarmalar-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
