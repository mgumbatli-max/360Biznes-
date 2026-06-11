import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { saveUploadFile } from "@/lib/storage/upload";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB (Vercel request body limiti ~4.5 MB)

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Fayl seçilməyib" }, { status: 400 });
  }

  const type = (file as File).type || "";
  if (!ALLOWED.has(type)) {
    return NextResponse.json({ error: "Yalnız JPEG, PNG, WebP, GIF qəbul edilir" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fayl 4 MB-dan böyükdür" }, { status: 400 });
  }

  const ext = type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : type === "image/webp" ? "webp" : "gif";
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    // QA: prod-da Vercel Blob (lokal FS serverless-də yazıla bilmir), dev-də public/uploads
    const url = await saveUploadFile(buf, `mehsul/${randomUUID()}.${ext}`, type);
    return NextResponse.json({ url, size: file.size, type });
  } catch (e) {
    console.error("[anbar/upload-image]", e);
    return NextResponse.json({ error: "Yükləmə xətası — yenidən cəhd edin" }, { status: 500 });
  }
}
