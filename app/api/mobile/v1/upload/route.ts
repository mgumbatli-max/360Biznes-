import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { withMobile } from "@/lib/mobile/session";
import { saveUploadFile } from "@/lib/storage/upload";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  return withMobile(req, async () => {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return { error: "Fayl yoxdur" };
    const type = (file as File).type || "";
    if (!ALLOWED.has(type)) return { error: "Yalnız JPEG/PNG/WebP" };
    if (file.size > 4 * 1024 * 1024) return { error: "Fayl 4 MB-dan böyükdür" };
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const buf = Buffer.from(await file.arrayBuffer());
    const url = await saveUploadFile(buf, `mehsul/${randomUUID()}.${ext}`, type);
    return { url };
  });
}
