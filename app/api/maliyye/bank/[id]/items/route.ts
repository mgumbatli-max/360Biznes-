import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const items = await withTenant(async () =>
      prisma.bank_cixarisi_satirlari.findMany({
        where: { cixarisi_id: id },
        orderBy: [{ tarix: "asc" }],
        take: 500,
        select: {
          id: true,
          tarix: true,
          mebleg: true,
          nov: true,
          tesvir: true,
          ref_kod: true,
          qarsi_hesab: true,
          eslesh_status: true,
        },
      }).catch(() => [] as never[]),
    );
    return NextResponse.json({
      items: items.map((r) => ({
        id: String(r.id),
        tarix: r.tarix,
        meblegh: Number(r.mebleg ?? 0) * (r.nov === "xaric" || r.nov === "debet" ? -1 : 1),
        qarsi_teref: r.qarsi_hesab ?? null,
        qeyd: r.tesvir ?? r.ref_kod ?? null,
        status: r.eslesh_status ?? null,
      })),
    });
  } catch (e) {
    console.error("[bank items api]", e);
    return NextResponse.json({ error: "Xəta" }, { status: 500 });
  }
}
