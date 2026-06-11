import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { getCustomerStatement } from "@/features/maliyye/customer-statement";
// QA-orta: maliyyə çıxarışı icazəsiz endirilə bilirdi — maliyyə icazə guard-ı
import { requireMaliyyeActionPerm } from "@/features/maliyye/access-guard";

export const runtime = "nodejs";

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  // QA-orta: tam mühasibat dəftəri yalnız maliyyə icazəsi olanlara (audit-log/export nümunəsi kimi)
  const perm = await requireMaliyyeActionPerm(["maliyye.oxu", "debitor.oxu", "elaqe.borc"]);
  if (!perm.ok) return new NextResponse("İcazə yoxdur", { status: 403 });

  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") && /^\d{4}-\d{2}-\d{2}$/.test(sp.get("from")!) ? new Date(sp.get("from")!) : undefined;
  const to = sp.get("to") && /^\d{4}-\d{2}-\d{2}$/.test(sp.get("to")!) ? new Date(sp.get("to")!) : undefined;

  const data = await getCustomerStatement({ musteri_id: id, from, to });
  if (!data) return new NextResponse("Not found", { status: 404 });

  const header = "Tarix,Növ,Sənəd №,Təsviri,Debet,Kredit,Qalıq";
  const lines = [header];
  lines.push(
    [
      csvCell(data.donem_baslama.toISOString().slice(0, 10)),
      csvCell("Başlanğıc qalıq"),
      "",
      "",
      "",
      "",
      csvCell(data.baslangic_qaliq.toFixed(2)),
    ].join(","),
  );
  for (const r of data.rows) {
    lines.push(
      [
        csvCell(new Date(r.tarix).toISOString().slice(0, 10)),
        csvCell(r.nov),
        csvCell(r.sened_nomresi),
        csvCell(r.tesvir),
        csvCell(r.debet.toFixed(2)),
        csvCell(r.kredit.toFixed(2)),
        csvCell(r.qaliq.toFixed(2)),
      ].join(","),
    );
  }
  lines.push("");
  lines.push(`Cəmi debet,,,,${data.cemi_debet.toFixed(2)},,`);
  lines.push(`Cəmi kredit,,,,,${data.cemi_kredit.toFixed(2)},`);
  lines.push(`Son qalıq,,,,,,${data.son_qaliq.toFixed(2)}`);

  const csv = lines.join("\n");
  const filename = `${data.musteri_ad.replace(/[^a-zA-Z0-9_-]/g, "_")}-hesab-cixaris-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse("﻿" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
