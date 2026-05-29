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

  // Fallback: Pollinations.ai — pulsuz AI generasiya, key tələb etmir.
  // CRİTİK: Pollinations URL-i 24 saatdan sonra etibarsız ola bilər (CDN cache TTL),
  // ona görə şəkili lokal saxlayırıq ki, URL həmişə işləsin.
  try {
    const q = encodeURIComponent(`product photo: ${prompt}, white background, professional, centered`);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${q}?width=600&height=600&nologo=true`;
    const imgRes = await fetch(pollinationsUrl, {
      // Pollinations bəzən 30+ saniyə çəkir — Vercel timeout-undan az verirük
      signal: AbortSignal.timeout(45_000),
    });
    if (!imgRes.ok) {
      return NextResponse.json(
        {
          error: `Pollinations xətası: ${imgRes.status}`,
          url: pollinationsUrl,
          provider: "pollinations-direct",
          is_mock: true,
          notice: "Şəkil yüklənə bilmədi, müvəqqəti URL qaytarıldı (24 saat sonra ölə bilər).",
        },
        { status: 200 },
      );
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json({ error: "Boş şəkil cavabı" }, { status: 502 });
    }
    const uploadsDir = path.join(process.cwd(), ...(["public", "uploads", "mehsul"] as string[]));
    await mkdir(uploadsDir, { recursive: true });
    const filename = `ai-${randomUUID()}.jpg`;
    await writeFile(path.join(uploadsDir, filename), buf);
    return NextResponse.json({
      url: `/uploads/mehsul/${filename}`,
      provider: "pollinations-saved",
      is_mock: false,
      notice: "Pollinations.ai pulsuz AI ilə şəkil yaradıldı və lokal saxlandı. Daha yüksək keyfiyyət üçün OPENAI_API_KEY əlavə edin (DALL-E 3).",
    });
  } catch (e) {
    console.error("[ai/generate-image] Pollinations exception:", e);
    return NextResponse.json(
      { error: "AI şəkil generasiyası uğursuz oldu (timeout və ya şəbəkə xətası)" },
      { status: 502 },
    );
  }
}
