import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { withTenant } from "@/lib/db/with-tenant";
import { getCustomersForExport, type CustomerSegment } from "@/features/hesabatlar/musteri-queries";

export const dynamic = "force-dynamic";

const VALID_SEGMENTS: CustomerSegment[] = ["all", "vip", "aktiv", "yatmis", "borclu"];

function csvEscape(s: unknown): string {
  if (s == null) return "";
  const v = String(s);
  if (/[",\n;]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const segParam = req.nextUrl.searchParams.get("segment") ?? "all";
  const segment = (VALID_SEGMENTS as string[]).includes(segParam) ? (segParam as CustomerSegment) : "all";

  const rows = await withTenant(async () => getCustomersForExport(segment, 10000));
  const header = ["Ad", "Telefon", "Email", "Şəhər", "LTV (₼)", "Borc (₼)"];
  const body = rows
    .map((r) => [r.ad, r.telefon ?? "", r.email ?? "", r.sheher ?? "", r.ltv.toFixed(2), r.borc.toFixed(2)].map(csvEscape).join(","))
    .join("\n");
  const csv = "﻿" + header.join(",") + "\n" + body;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="musteri-${segment}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
