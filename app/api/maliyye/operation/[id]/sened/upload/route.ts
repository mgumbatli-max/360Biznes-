import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { saveUploadFile } from "@/lib/storage/upload";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { revalidatePath } from "next/cache";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const form = await req.formData();
  const file = form.get("file");
  const ad = String(form.get("ad") ?? "").slice(0, 200);

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Fayl seçilməyib" }, { status: 400 });
  }
  const type = (file as File).type || "";
  if (!ALLOWED.has(type)) {
    return NextResponse.json(
      { error: "Yalnız JPEG, PNG, WebP və PDF qəbul olunur" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fayl 5 MB-dan böyükdür" }, { status: 400 });
  }

  try {
    return await withTenant(async () => {
      const { sahibkarId, istifadeciId } = requireTenant();

      // Verify operation belongs to tenant
      const op = await prisma.finance_operations.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!op) return NextResponse.json({ error: "Əməliyyat tapılmadı" }, { status: 404 });

      const ext =
        type === "image/jpeg"
          ? "jpg"
          : type === "image/png"
            ? "png"
            : type === "image/webp"
              ? "webp"
              : "pdf";
      const filename = `${randomUUID()}.${ext}`;
      const buf = Buffer.from(await file.arrayBuffer());
      // QA: prod-da Vercel Blob (lokal FS serverless-də yazıla bilmir), dev-də public/uploads
      const url = await saveUploadFile(buf, `maliyye/${id}/${filename}`, type);
      const att = await prisma.finance_attachments.create({
        data: {
          sahibkar_id: sahibkarId,
          operation_id: id,
          ad: ad || (file as File).name || filename,
          fayl_url: url,
          fayl_olcu: file.size,
          fayl_nov: type,
          yaradan_id: istifadeciId,
        },
      });

      revalidatePath(`/maliyye/emeliyyat`);
      revalidatePath(`/maliyye/emeliyyat/${id}`);
      return NextResponse.json({
        ok: true,
        id: att.id,
        url: att.fayl_url,
        nov: att.fayl_nov,
        olcu: att.fayl_olcu,
        ad: att.ad,
      });
    });
  } catch (e) {
    console.error("[maliyye-sened-upload]", e);
    return NextResponse.json({ error: "Yükləmə xətası" }, { status: 500 });
  }
}
