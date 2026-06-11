import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { saveUploadFile } from "@/lib/storage/upload";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import {
  buildDocTag,
  parseContactDocuments,
  stripDocTags,
  type ContactDocument,
} from "@/features/elaqe/detail-queries";
import { revalidatePath } from "next/cache";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_KAT = new Set(["muqavile", "id", "vekalet", "diger"]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const form = await req.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").slice(0, 200).trim();
  const kateqoriyaRaw = String(form.get("kateqoriya") ?? "diger");
  const kateqoriya = ALLOWED_KAT.has(kateqoriyaRaw) ? kateqoriyaRaw : "diger";
  const tarix = String(form.get("tarix") ?? "").slice(0, 30);
  const bitme = String(form.get("bitme") ?? "").slice(0, 30);

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

      const k = await prisma.kontragentler.findUnique({
        where: { id },
        select: { id: true, qeyd: true },
      });
      if (!k) return NextResponse.json({ error: "Kontragent tapılmadı" }, { status: 404 });

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
      const url = await saveUploadFile(buf, `elaqe/${id}/${filename}`, type);
      const fileId = randomUUID();
      const doc: ContactDocument = {
        id: fileId,
        url,
        title: title || (file as File).name || filename,
        kateqoriya,
        tarix: tarix || null,
        bitme: bitme || null,
        nov: type,
        size: file.size,
      };

      const existing = parseContactDocuments(k.qeyd);
      existing.push(doc);
      const base = stripDocTags(k.qeyd);
      const newQeyd = [base, ...existing.map(buildDocTag)].filter(Boolean).join("\n").trim() || null;

      await prisma.kontragentler.update({
        where: { id },
        data: { qeyd: newQeyd },
      });

      // Audit log (best-effort)
      try {
        await prisma.audit_log.create({
          data: {
            sahibkar_id: sahibkarId,
            istifadeci_id: istifadeciId,
            emeliyyat: "sened_yukle",
            resurs_nov: "kontragent",
            resurs_id: id,
            yeni_data: { fileId, url, title: doc.title, kateqoriya, size: file.size } as unknown as object,
            status: "ugur",
          },
        });
      } catch {
        /* skip audit */
      }

      revalidatePath(`/elaqe/musteriler/${id}`);
      revalidatePath(`/elaqe/techizatcilar/${id}`);
      return NextResponse.json({
        ok: true,
        document: doc,
      });
    });
  } catch (e) {
    console.error("[elaqe-sened-upload]", e);
    return NextResponse.json({ error: "Yükləmə xətası" }, { status: 500 });
  }
}
