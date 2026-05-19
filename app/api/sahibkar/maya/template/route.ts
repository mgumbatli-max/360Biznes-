import { NextResponse } from "next/server";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { generateMayaTemplate } from "@/features/sahibkar/maya/excel-template";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireSahibkarSession();

  const buf = await generateMayaTemplate();
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="maya-sablonu.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
