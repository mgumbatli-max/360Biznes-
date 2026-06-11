import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { saveUploadFile } from "@/lib/storage/upload";
import { chatCompletion } from "@/lib/ai/anthropic";

export const maxDuration = 60;

/** AI şəkil servisi yalnız OPENAI_API_KEY varsa aktivdir (DALL-E 3). */
function aiImageEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/** UI bu flag-a görə "AI ilə şəkil" düyməsini göstərir/gizlədir. */
export async function GET() {
  return NextResponse.json({ enabled: aiImageEnabled() });
}

/**
 * Məhsul üçün AI şəkil generasiyası — DALL-E 3 (yeganə dayanıqlı provayder).
 *
 * Qeyd: əvvəlki pulsuz Pollinations.ai servisi pullu olub (hər sorğuya 402
 * "pay to bypass" qaytarır) — ona görə tamamilə çıxarıldı. OPENAI_API_KEY
 * yoxdursa funksiya deaktivdir (UI düyməni gizlədir), 402/qaranlıq xəta yox.
 * Nəticə həmişə Vercel Blob-a saxlanılır (lokal dev-də public/uploads).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!aiImageEnabled()) {
    return NextResponse.json(
      {
        error:
          "AI ilə şəkil yaratma konfiqurasiya olunmayıb. Şəkili əl ilə yükləyə və ya URL daxil edə bilərsiniz. (Admin: OPENAI_API_KEY əlavə edin.)",
        disabled: true,
      },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const prompt = String(body?.prompt ?? "").trim().slice(0, 300);
  if (!prompt) return NextResponse.json({ error: "Prompt boşdur" }, { status: 400 });

  const enPrompt = await buildEnglishPrompt(prompt);

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: enPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url",
      }),
      signal: AbortSignal.timeout(50_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[ai/generate-image] OpenAI error:", res.status, err);
      const msg =
        res.status === 401
          ? "AI şəkil açarı qəbul olunmadı — admin ilə əlaqə saxlayın"
          : res.status === 429
            ? "AI şəkil servisi limiti aşıldı, bir az sonra cəhd edin"
            : "AI şəkil generasiyası alınmadı, yenidən cəhd edin";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const data = await res.json();
    const remoteUrl = data?.data?.[0]?.url as string | undefined;
    if (!remoteUrl) {
      return NextResponse.json({ error: "AI şəkil qaytarmadı" }, { status: 502 });
    }
    const imgRes = await fetch(remoteUrl, { signal: AbortSignal.timeout(30_000) });
    if (!imgRes.ok) {
      return NextResponse.json({ error: "AI şəkli endirmək mümkün olmadı" }, { status: 502 });
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const url = await saveUploadFile(buf, `mehsul/ai-${randomUUID()}.png`, "image/png");
    return NextResponse.json({ url, provider: "openai-dall-e-3", is_mock: false });
  } catch (e) {
    console.error("[ai/generate-image] exception:", e);
    return NextResponse.json(
      { error: "AI şəkil generasiyası uğursuz oldu (timeout və ya şəbəkə) — yenidən cəhd edin" },
      { status: 502 },
    );
  }
}

/**
 * AZ məhsul adından İngilis e-commerce foto-promptu qur (DALL-E AZ-ı zəif
 * anlayır → "səhv şəkil"). ANTHROPIC_API_KEY varsa Claude zənginləşdirir.
 */
async function buildEnglishPrompt(adAz: string): Promise<string> {
  const fallback = `professional e-commerce product photo of "${adAz}", isolated on clean white background, soft studio lighting, sharp focus, centered, photorealistic, no text, no watermark, no people`;
  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  try {
    const r = await chatCompletion(
      [
        {
          role: "user",
          content: `Azerbaijani product name: "${adAz}".\nWrite ONE English image-generation prompt for a professional e-commerce product photo of exactly this product. Identify what the product actually is and describe it accurately. Requirements to include: isolated on clean white background, soft studio lighting, centered, photorealistic, no text, no watermark, no people. Max 45 words. Reply with ONLY the prompt.`,
        },
      ],
      {
        system: "You translate product names and write concise English image-generation prompts. Output only the prompt text, nothing else.",
        max_tokens: 200,
      },
    );
    const t = r.text.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/\s+/g, " ");
    if (!r.is_mock && t.length > 15 && t.length < 600) return t;
  } catch (e) {
    console.error("[ai/generate-image] prompt-build fallback:", e);
  }
  return fallback;
}
