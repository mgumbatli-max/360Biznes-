import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

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
    return NextResponse.json({ error: "Fayl 5 MB-dan böyükdür" }, { status: 400 });
  }

  const ext = type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : type === "image/webp" ? "webp" : "gif";
  const filename = `${randomUUID()}.${ext}`;
  const uploadsDir = path.join(process.cwd(), ...(["public", "uploads", "mehsul"] as string[]));
  await mkdir(uploadsDir, { recursive: true });
  const filepath = path.join(uploadsDir, filename);

  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buf);

  return NextResponse.json({ url: `/uploads/mehsul/${filename}`, size: file.size, type });
}
