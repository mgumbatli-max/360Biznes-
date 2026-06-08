import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { getSenedTree, saveSenedTree } from "@/features/sahibkar/senedler/queries";
import type { SenedFayl } from "@/features/sahibkar/senedler/types";

const ALLOWED = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/zip",
]);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.rol_ad !== "sahibkar") return NextResponse.json({ error: "Yalnız sahibkar" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  const folderId = form.get("folder_id") ? String(form.get("folder_id")) : null;
  const qeyd = String(form.get("qeyd") ?? "").slice(0, 500);
  const tagsRaw = String(form.get("tags") ?? "");

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Fayl seçilməyib" }, { status: 400 });
  }
  const type = (file as File).type || "";
  if (!ALLOWED.has(type)) {
    return NextResponse.json({ error: "Bu fayl növü dəstəklənmir" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fayl 20 MB-dan böyükdür" }, { status: 400 });
  }

  try {
    const originalName = ((file as File).name || "fayl").slice(0, 200);
    const ext = path.extname(originalName) || ".bin";
    const fileId = randomUUID();
    const newName = `${fileId}${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "sahibkar-senedler");
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, newName);
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, bytes);
    const url = `/uploads/sahibkar-senedler/${newName}`;

    const tree = await getSenedTree();
    const item: SenedFayl = {
      id: fileId,
      folder_id: folderId,
      name: originalName,
      tip: "file",
      url,
      olcu_byte: file.size,
      mime: type,
      qeyd,
      tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10),
      yaradildi: new Date().toISOString(),
    };
    tree.files.push(item);
    await saveSenedTree(tree);

    revalidatePath("/sahibkar/senedler");
    return NextResponse.json({ ok: true, id: fileId });
  } catch (e) {
    console.error("[sahibkar-sened upload]", e);
    return NextResponse.json({ error: "Yüklənmədi" }, { status: 500 });
  }
}
