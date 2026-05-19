import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";

/**
 * Generate a product image from text prompt.
 *
 * Strategy:
 *  1) If OPENAI_API_KEY set → DALL-E 3 generates image, downloads, saves locally.
 *  2) Otherwise → Pollinations.ai (free, no key, real AI generation) as fallback.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const prompt = String(body?.prompt ?? "").trim();
  if (!prompt) return NextResponse.json({ error: "Prompt boşdur" }, { status: 400 });

  // Try OpenAI DALL-E
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
          prompt: `Product photo for online store: ${prompt}. Clean white background, professional product photography, no text or watermarks, centered.`,
          n: 1,
          size: "1024x1024",
          quality: "standard",
          response_format: "url",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const remoteUrl = data?.data?.[0]?.url as string | undefined;
        if (remoteUrl) {
          // Download and save locally so URL stays stable
          const imgRes = await fetch(remoteUrl);
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            const uploadsDir = path.join(process.cwd(), ...(["public", "uploads", "mehsul"] as string[]));
            await mkdir(uploadsDir, { recursive: true });
            const filename = `ai-${randomUUID()}.png`;
            await writeFile(path.join(uploadsDir, filename), buf);
            return NextResponse.json({
              url: `/uploads/mehsul/${filename}`,
              provider: "openai-dall-e-3",
              is_mock: false,
            });
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

  // Fallback: Pollinations.ai — pulsuz AI generasiya, key tələb etmir
  // URL formatı CDN-də cache olunur, hər prompt üçün eyni şəkli qaytarır
  const q = encodeURIComponent(`product photo: ${prompt}, white background, professional, centered`);
  const fallback = `https://image.pollinations.ai/prompt/${q}?width=600&height=600&nologo=true`;
  return NextResponse.json({
    url: fallback,
    provider: "pollinations-fallback",
    is_mock: true,
    notice: "Pollinations.ai pulsuz AI ilə şəkil generasiya etdi. Daha yüksək keyfiyyət üçün OPENAI_API_KEY əlavə edin (DALL-E 3).",
  });
}
