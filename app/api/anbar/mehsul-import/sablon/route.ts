import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateProductTemplate } from "@/features/anbar/import/template";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const wb = await generateProductTemplate();
  const buf = await wb.xlsx.writeBuffer();

  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="360biznes-mehsul-sablon.xlsx"',
    },
  });
}
