import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTemplate } from "@/features/inteqrasiya/templates";
import { parseExcel } from "@/features/inteqrasiya/excel-parser";
import { importByKey, isImporterAvailable } from "@/features/inteqrasiya/importer";
import { safeUserMessage } from "@/lib/error/user-message"; // QA-orta: raw error sızmasın

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });

  const { key } = await ctx.params;
  const template = getTemplate(key);
  if (!template) {
    return NextResponse.json({ error: "Şablon tapılmadı: " + key }, { status: 404 });
  }
  if (!isImporterAvailable(key)) {
    return NextResponse.json(
      {
        error: `«${template.title}» şablonu üçün avtomatik idxal hələ aktiv deyil. Hazırda dəstəklənənlər: məhsul, müştəri, təchizatçı, hesab, əməkdaş, CRM.`,
      },
      { status: 501 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("fayl");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Fayl seçilməyib" }, { status: 400 });
  }

  const fileName =
    "name" in file && typeof (file as { name?: string }).name === "string"
      ? (file as { name: string }).name
      : "import.xlsx";

  const buffer = await file.arrayBuffer();
  let parsed;
  try {
    parsed = await parseExcel(buffer, template);
  } catch (e) {
    console.error("[inteqrasiya parse]", e);
    // QA-orta: raw error mətni client-ə sızmasın
    return NextResponse.json({ error: safeUserMessage(e, "Excel faylı oxuna bilmədi") }, { status: 400 });
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "Faylda məlumat yoxdur" }, { status: 400 });
  }

  try {
    const result = await importByKey(key, parsed.rows, fileName);
    return NextResponse.json({
      ok: true,
      partiyaId: result.partiyaId,
      cemi: result.cemi,
      yarat: result.yarat,
      yenile: result.yenile,
      xeta: result.xeta,
      log: result.log,
      parse: {
        totalRows: parsed.totalRows,
        validRows: parsed.validRows,
        errorRows: parsed.errorRows,
      },
    });
  } catch (e) {
    console.error("[inteqrasiya import]", e);
    // QA-orta: Prisma/DB xəta mətni istifadəçiyə sızmasın
    return NextResponse.json({ error: safeUserMessage(e, "Fayl emal edilə bilmədi") }, { status: 500 });
  }
}
