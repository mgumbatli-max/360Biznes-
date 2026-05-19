import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateBankTemplate } from "@/features/bank/excel";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });

  const buffer = await generateBankTemplate();
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bank_uzlasdirma_sablon.xlsx"`,
    },
  });
}
