import { NextResponse, type NextRequest } from "next/server";
import { getAuditLog, type AuditFilter } from "@/features/audit-log/queries";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n;]/.test(s) ? `"${s}"` : s;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filter: AuditFilter = {
    q: sp.get("q") ?? undefined,
    emeliyyat: sp.get("emeliyyat") ?? undefined,
    resurs_nov: sp.get("resurs_nov") ?? undefined,
    status: sp.get("status") ?? undefined,
    istifadeci_id: sp.get("istifadeci_id") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  };

  const { items } = await getAuditLog(filter, 1, 5000);
  const header = [
    "vaxt",
    "istifadeci",
    "emeliyyat",
    "status",
    "resurs_nov",
    "resurs_id",
    "url",
    "metod",
    "ip",
  ];
  const lines = [header.join(",")];
  for (const r of items) {
    lines.push(
      [
        r.yaradildi?.toISOString() ?? "",
        r.istifadeci_ad ?? "",
        r.emeliyyat,
        r.status ?? "",
        r.resurs_nov,
        r.resurs_id ?? "",
        r.url ?? "",
        r.metod ?? "",
        r.ip_adres ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  const csv = lines.join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
