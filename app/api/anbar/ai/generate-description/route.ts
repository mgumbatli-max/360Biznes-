import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { chatCompletion } from "@/lib/ai/anthropic";

/**
 * Generate product description from name (and optional category/brand).
 * Uses Anthropic Claude (with mock fallback if no API key).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ad = String(body?.ad ?? "").trim();
  const kateqoriya = body?.kateqoriya ? String(body.kateqoriya).trim() : "";
  const marka = body?.marka ? String(body.marka).trim() : "";

  if (!ad) return NextResponse.json({ error: "Məhsul adı tələb olunur" }, { status: 400 });

  const prompt = [
    `Mən onlayn mağaza üçün məhsul kartı hazırlayıram. Aşağıdakı məhsul üçün qısa, satışa kömək edən təsvir yaz (3-5 cümlə, AZ dilində).`,
    `Məhsul: ${ad}`,
    marka && `Marka: ${marka}`,
    kateqoriya && `Kateqoriya: ${kateqoriya}`,
    `Tələblər:`,
    `- Faktiki xüsusiyyətlər (material, ölçü, istifadə sahəsi əgər ada aydındırsa)`,
    `- Müştəri faydası, niyə alsın`,
    `- Texniki şərt və ya parametr varsa qeyd et`,
    `- HTML, kod, list işarəsi qoyma — saf mətn`,
    `Yalnız təsvir mətnini qaytar, başqa heç nə.`,
  ].filter(Boolean).join("\n");

  try {
    const result = await chatCompletion(
      [{ role: "user", content: prompt }],
      { max_tokens: 600 }
    );
    return NextResponse.json({
      text: result.text.trim(),
      model: result.model,
      is_mock: result.is_mock,
    });
  } catch (e) {
    console.error("[ai/generate-description]", e);
    return NextResponse.json({ error: "Generasiya alınmadı" }, { status: 500 });
  }
}
