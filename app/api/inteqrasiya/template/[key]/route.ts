import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTemplate } from "@/features/inteqrasiya/templates";
import { generateTemplate } from "@/features/inteqrasiya/excel-generator";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });

  const { key } = await ctx.params;
  const template = getTemplate(key);
  if (!template) {
    return NextResponse.json({ error: "Şablon tapılmadı: " + key }, { status: 404 });
  }

  const buffer = await generateTemplate(template);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${template.filename}"`,
      "Cache-Control": "no-cache",
    },
  });
}
