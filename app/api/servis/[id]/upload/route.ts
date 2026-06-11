import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { saveUploadFile } from "@/lib/storage/upload";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { revalidatePath } from "next/cache";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_KATEQ = new Set([
  "qebul",
  "diaqnostika",
  "temir",
  "hazir",
  "imza",
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const form = await req.formData();
  const file = form.get("file");
  const kateq = String(form.get("kateq") ?? "qebul").toLowerCase();
  const aciqlama = String(form.get("aciqlama") ?? "").slice(0, 500);

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Fayl seçilməyib" }, { status: 400 });
  }
  if (!ALLOWED_KATEQ.has(kateq)) {
    return NextResponse.json({ error: "Yanlış kateqoriya" }, { status: 400 });
  }

  const type = (file as File).type || "";
  if (!ALLOWED.has(type)) {
    return NextResponse.json({ error: "Yalnız JPEG, PNG və WebP qəbul olunur" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fayl 5 MB-dan böyükdür" }, { status: 400 });
  }

  try {
    return await withTenant(async () => {
      const { istifadeciId } = requireTenant();

      // Servis owner check (tenant guard avtomatik filter edir)
      const servis = await prisma.servis_qeydleri.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!servis) return NextResponse.json({ error: "Servis tapılmadı" }, { status: 404 });

      const ext = type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
      const filename = `${randomUUID()}.${ext}`;
      const buf = Buffer.from(await file.arrayBuffer());
      // QA: prod-da Vercel Blob (lokal FS serverless-də yazıla bilmir), dev-də public/uploads
      const url = await saveUploadFile(buf, `servis/${id}/${filename}`, type);

      const fayl = await prisma.servis_fayllari.create({
        data: {
          servis_id: id,
          fayl_adi: url,
          orijinal_adi: (file as File).name || filename,
          mime_tip: type,
          olcu_bayt: BigInt(file.size),
          nov: kateq,
          aciqlama: aciqlama || null,
          yukleyen_id: istifadeciId,
        },
      });

      revalidatePath(`/servis/${id}`);
      return NextResponse.json({
        ok: true,
        id: fayl.id,
        url: fayl.fayl_adi,
        nov: fayl.nov,
        olcu: file.size,
      });
    });
  } catch (e) {
    console.error("[servis-upload]", e);
    return NextResponse.json({ error: "Yükləmə xətası" }, { status: 500 });
  }
}
