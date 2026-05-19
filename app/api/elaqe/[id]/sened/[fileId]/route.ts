import { NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import {
  buildDocTag,
  parseContactDocuments,
  stripDocTags,
} from "@/features/elaqe/detail-queries";
import { revalidatePath } from "next/cache";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; fileId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, fileId } = await ctx.params;

  try {
    return await withTenant(async () => {
      const { sahibkarId, istifadeciId } = requireTenant();
      const k = await prisma.kontragentler.findUnique({
        where: { id },
        select: { id: true, qeyd: true },
      });
      if (!k) return NextResponse.json({ error: "Kontragent tapılmadı" }, { status: 404 });

      const docs = parseContactDocuments(k.qeyd);
      const target = docs.find((d) => d.id === fileId);
      if (!target) return NextResponse.json({ error: "Sənəd tapılmadı" }, { status: 404 });

      const remaining = docs.filter((d) => d.id !== fileId);
      const base = stripDocTags(k.qeyd);
      const newQeyd =
        [base, ...remaining.map(buildDocTag)].filter(Boolean).join("\n").trim() || null;

      await prisma.kontragentler.update({ where: { id }, data: { qeyd: newQeyd } });

      // Try delete file (best-effort, only inside public/uploads/elaqe/{id})
      try {
        if (target.url.startsWith(`/uploads/elaqe/${id}/`)) {
          const rel = target.url.replace(/^\//, "");
          const abs = path.join(process.cwd(), "public", rel);
          await unlink(abs).catch(() => {});
        }
      } catch {
        /* skip */
      }

      try {
        await prisma.audit_log.create({
          data: {
            sahibkar_id: sahibkarId,
            istifadeci_id: istifadeciId,
            emeliyyat: "sened_sil",
            resurs_nov: "kontragent",
            resurs_id: id,
            evvelki_data: { fileId, url: target.url, title: target.title } as unknown as object,
            status: "ugur",
          },
        });
      } catch {
        /* skip audit */
      }

      revalidatePath(`/elaqe/musteriler/${id}`);
      revalidatePath(`/elaqe/techizatcilar/${id}`);
      return NextResponse.json({ ok: true });
    });
  } catch (e) {
    console.error("[elaqe-sened-delete]", e);
    return NextResponse.json({ error: "Silmə xətası" }, { status: 500 });
  }
}
