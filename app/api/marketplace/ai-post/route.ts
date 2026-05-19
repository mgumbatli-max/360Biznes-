import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { chatCompletion } from "@/lib/ai/anthropic";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type Tone = "professional" | "friendly" | "playful" | "urgent";
type Platform = "instagram" | "facebook" | "tiktok" | "telegram" | "whatsapp" | "linkedin" | "x";

const TONE_GUIDE: Record<Tone, string> = {
  professional: "Rəsmi, biznes tonu — etibarlı görünmək üçün",
  friendly:     "Səmimi, müştəri-dostu, gülərüz",
  playful:      "Əyləncəli, emoji-dolu, gənc auditoriya",
  urgent:       "Tez al, məhduddur, FOMO təsiri",
};

const PLATFORM_LIMITS: Record<Platform, { maxChars: number; emojiHint: string }> = {
  instagram: { maxChars: 1200, emojiHint: "3-5 emoji, hashtag-lar sonda (5-10)" },
  facebook:  { maxChars: 600,  emojiHint: "1-3 emoji, hashtag minimal" },
  tiktok:    { maxChars: 300,  emojiHint: "Çox emoji, viral hashtag-lar" },
  telegram:  { maxChars: 1000, emojiHint: "Bold və italic istifadə et" },
  whatsapp:  { maxChars: 600,  emojiHint: "Direkt, müştəriyə xitabən" },
  linkedin:  { maxChars: 1200, emojiHint: "Biznes tonu, peşəkar, az emoji" },
  x:         { maxChars: 270,  emojiHint: "Çox qısa, hashtag-lar mətnin içində" },
};

/**
 * Avto-Poster üçün AI mətn generatoru.
 *
 * Input: məhsul ID və ya azad mövzu, tone, target platform-lar.
 * Output: sosial media üçün ən optimal sosial mətn (hashtag və emoji ilə).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const mehsulId = body?.mehsul_id ? String(body.mehsul_id) : null;
  const movzu = body?.movzu ? String(body.movzu).trim() : "";
  const tone: Tone = ["professional", "friendly", "playful", "urgent"].includes(body?.tone)
    ? body.tone
    : "friendly";
  const platforms: Platform[] = Array.isArray(body?.platforms)
    ? body.platforms.filter((p: string) =>
        ["instagram", "facebook", "tiktok", "telegram", "whatsapp", "linkedin", "x"].includes(p),
      )
    : ["instagram"];

  if (!mehsulId && !movzu) {
    return NextResponse.json({ error: "Məhsul ID və ya mövzu lazımdır" }, { status: 400 });
  }

  // Məhsul məlumatlarını yüklə
  let productContext = "";
  if (mehsulId) {
    try {
      const product = await withTenant(async () => {
        const { sahibkarId: _s } = requireTenant();
        void _s;
        return prisma.mehsullar.findFirst({
          where: { id: mehsulId },
          select: {
            ad: true,
            satis_qiymeti: true,
            endirimli_qiymet: true,
            aciqlamaq: true,
            qisaca_tesvir: true,
            valyuta: true,
            markalar: { select: { ad: true } },
            kateqoriyalar: { select: { ad: true } },
          },
        });
      });
      if (product) {
        productContext = [
          `Məhsul: ${product.ad}`,
          product.markalar?.ad && `Marka: ${product.markalar.ad}`,
          product.kateqoriyalar?.ad && `Kateqoriya: ${product.kateqoriyalar.ad}`,
          product.satis_qiymeti && `Qiymət: ${product.satis_qiymeti} ${product.valyuta ?? "AZN"}`,
          product.endirimli_qiymet &&
            `Endirim qiymət: ${product.endirimli_qiymet} ${product.valyuta ?? "AZN"} (endirim aktiv)`,
          product.qisaca_tesvir && `Qısa təsvir: ${product.qisaca_tesvir}`,
          product.aciqlamaq && `Tam təsvir: ${product.aciqlamaq.slice(0, 500)}`,
        ]
          .filter(Boolean)
          .join("\n");
      }
    } catch (e) {
      console.error("[ai-post] product load", e);
    }
  }

  // Platform üzrə təlimatları topla
  const platformGuide = platforms
    .map((p) => `${p.toUpperCase()}: ≤${PLATFORM_LIMITS[p].maxChars} simvol, ${PLATFORM_LIMITS[p].emojiHint}`)
    .join("\n");

  const prompt = [
    `Sən sosial media SMM mütəxəssisisən. Aşağıdakı məhsul / mövzu üçün sosial post yaz (Azərbaycan dilində).`,
    ``,
    productContext || `Mövzu: ${movzu}`,
    ``,
    `Stil: ${TONE_GUIDE[tone]}`,
    ``,
    `Platformalar (hamısı üçün bir mətn — ən qısa məhdudiyyətə uy):`,
    platformGuide,
    ``,
    `Qaydalar:`,
    `- Diqqəti qarmaq edən ilk cümlə (hook)`,
    `- Faydanı vurğula — niyə alsın?`,
    `- Call-to-action sonda (məs. "DM ilə yaz", "linkə bax", "tez al")`,
    `- Hashtag-lar mətnin sonunda 5-10 ədəd, AZ + EN qarışıq (#360biznes #az_mağaza vəs.)`,
    `- Markdown yox, sadə mətn + emoji`,
    `- Yalnız posta gedəcək saf mətni qaytar, başqa heç nə`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await chatCompletion([{ role: "user", content: prompt }], {
      max_tokens: 800,
      system: "Sən Azərbaycan biznesi üçün sosial media SMM mütəxəssisisən. Hər zaman AZ dilində, müştəri cəlb edən, satış stimullaşdıran mətnlər yazırsan.",
    });
    return NextResponse.json({
      text: result.text.trim(),
      model: result.model,
      is_mock: result.is_mock,
    });
  } catch (e) {
    console.error("[marketplace/ai-post]", e);
    return NextResponse.json({ error: "AI mətn alınmadı" }, { status: 500 });
  }
}
