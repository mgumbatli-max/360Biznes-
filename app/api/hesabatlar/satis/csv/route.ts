import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { withTenant } from "@/lib/db/with-tenant";
import { getDailySales } from "@/features/hesabatlar/satis-queries";
import { parseDateRange } from "@/features/hesabatlar/shared";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const range = parseDateRange({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined, preset: sp.get("preset") ?? undefined });

  const daily = await withTenant(() => getDailySales({ range }));
  const lines = ["Tarix,Sifaris_sayi,Mebleg_AZN"];
  for (const r of daily) lines.push([csvEscape(r.date), csvEscape(r.count), csvEscape(r.amount)].join(","));
  const csv = "﻿" + lines.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="satis-gunlu-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
