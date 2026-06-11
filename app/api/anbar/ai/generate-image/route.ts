import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { saveUploadFile } from "@/lib/storage/upload";
import { chatCompletion } from "@/lib/ai/anthropic";

// Pollinations bəzən 30-40 saniyə çəkir — funksiya vaxtı kifayət olsun
export const maxDuration = 60;

/**
 * Məhsul üçün AI şəkil generasiyası.
 *
 * Strategiya:
 *  1) AZ məhsul adı → Claude ilə zəngin İngilis foto-promptu (flux/DALL-E
 *     Azərbaycan dilini zəif anlayır — "səhv şəkil" probleminin kök səbəbi).
 *  2) OPENAI_API_KEY varsa → DALL-E 3; yoxsa → Pollinations.ai (flux modeli).
 *  3) Nəticə HƏMİŞƏ saxlanılır (prod-da Vercel Blob, lokal dev-də public/uploads)
 *     — müvəqqəti URL/"24 saat" yolu YOXDUR; alınmasa aydın xəta qaytarılır.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const prompt = String(body?.prompt ?? "").trim().slice(0, 300);
  if (!prompt) return NextResponse.json({ error: "Prompt boşdur" }, { status: 400 });

  const enPrompt = await buildEnglishPrompt(prompt);

  // 1) OpenAI DALL-E 3 (key varsa)
  if (process.env.OPENAI_API_KEY) {
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

      if (res.ok) {
        const data = await res.json();
        const remoteUrl = data?.data?.[0]?.url as string | undefined;
        if (remoteUrl) {
          const imgRes = await fetch(remoteUrl, { signal: AbortSignal.timeout(30_000) });
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            const url = await saveUploadFile(buf, `mehsul/ai-${randomUUID()}.png`, "image/png");
            return NextResponse.json({ url, provider: "openai-dall-e-3", is_mock: false });
          }
        }
      } else {
        const err = await res.text().catch(() => "");
        console.error("[ai/generate-image] OpenAI error:", err);
      }
    } catch (e) {
      console.error("[ai/generate-image] OpenAI exception:", e);
    }
  }

  // 2) Pollinations.ai — pulsuz, key tələb etmir; flux modeli + İngilis prompt
  try {
    const q = encodeURIComponent(enPrompt);
    // seed random → "yenidən yarat" hər dəfə fərqli nəticə versin
    const seed = Math.floor(Math.random() * 1_000_000);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${q}?width=768&height=768&model=flux&nologo=true&seed=${seed}`;
    const imgRes = await fetch(pollinationsUrl, { signal: AbortSignal.timeout(50_000) });
    if (!imgRes.ok) {
      console.error("[ai/generate-image] Pollinations status:", imgRes.status);
      return NextResponse.json(
        { error: `AI şəkil servisi cavab vermədi (${imgRes.status}). Bir az sonra yenidən cəhd edin.` },
        { status: 502 },
      );
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length < 1024) {
      return NextResponse.json(
        { error: "AI boş/yararsız şəkil qaytardı — yenidən cəhd edin" },
        { status: 502 },
      );
    }
    const contentType = imgRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const url = await saveUploadFile(buf, `mehsul/ai-${randomUUID()}.${ext}`, contentType);
    return NextResponse.json({ url, provider: "pollinations-flux", is_mock: false });
  } catch (e) {
    console.error("[ai/generate-image] Pollinations exception:", e);
    return NextResponse.json(
      { error: "AI şəkil generasiyası uğursuz oldu (timeout və ya şəbəkə xətası) — yenidən cəhd edin" },
      { status: 502 },
    );
  }
}

/**
 * AZ məhsul adından İngilis e-commerce foto-promptu qur.
 * ANTHROPIC_API_KEY varsa Claude tərcümə + zənginləşdirmə edir;
 * yoxdursa şablon fallback (ad olduğu kimi qalır).
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
