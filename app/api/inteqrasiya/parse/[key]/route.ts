import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTemplate } from "@/features/inteqrasiya/templates";
import { parseExcel } from "@/features/inteqrasiya/excel-parser";
import { isImporterAvailable } from "@/features/inteqrasiya/importer";
import { safeUserMessage } from "@/lib/error/user-message"; // QA-orta: raw error sızmasın

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });

  const { key } = await ctx.params;
  const template = getTemplate(key);
  if (!template) {
    return NextResponse.json({ error: "Şablon tapılmadı: " + key }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("fayl");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Fayl seçilməyib" }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Fayl 20 MB-dan böyükdür" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  let result;
  try {
    result = await parseExcel(buffer, template);
  } catch (e) {
    console.error("[inteqrasiya parse]", e);
    // QA-orta: raw error mətni client-ə sızmasın
    return NextResponse.json({ error: safeUserMessage(e, "Excel faylı oxuna bilmədi") }, { status: 400 });
  }

  return NextResponse.json({
    ...result,
    importerAvailable: isImporterAvailable(key),
    templateKey: key,
    templateTitle: template.title,
    fileName: "name" in file && typeof (file as { name?: string }).name === "string" ? (file as { name: string }).name : "import.xlsx",
  });
}
