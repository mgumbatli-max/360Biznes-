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
    `Onlayn mağaza üçün məhsul kartı təsviri yaz (3-5 cümlə, Azərbaycan dilində).`,
    `Məhsul adı: ${ad}`,
    marka && `Marka: ${marka}`,
    kateqoriya && `Kateqoriya: ${kateqoriya}`,
    `Qaydalar:`,
    `- ƏN VACİB: yalnız məhsul adından/markasından AÇIQ-AYDIN bilinən faktları yaz. Ad-da olmayan material, ölçü, rəng, texniki parametr, model nömrəsi UYDURMA.`,
    `- Əmin olmadığın spesifikasiya əvəzinə istifadə sahəsi və ümumi müştəri faydasından yaz.`,
    `- Satışa kömək edən, təbii, peşəkar ton — reklam şişirtməsi yox.`,
    `- HTML, kod, list işarəsi, emoji qoyma — saf mətn.`,
    `Yalnız təsvir mətnini qaytar, başqa heç nə (giriş cümləsi, izah yazma).`,
  ].filter(Boolean).join("\n");

  try {
    const result = await chatCompletion(
      [{ role: "user", content: prompt }],
      {
        // Default köməkçi system promptu yox — bu tapşırığa fokuslu
        system:
          "Sən e-ticarət məhsul təsvirləri yazan peşəkar kopiraytersən. Azərbaycan dilində, qrammatik düzgün, qısa və dəqiq yazırsan. Heç vaxt məhsul haqqında bilmədiyin faktı uydurmursan.",
        max_tokens: 600,
      }
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
