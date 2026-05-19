import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getServisFullDetail } from "@/features/servis/queries";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const data = await getServisFullDetail(id);
    if (!data) return NextResponse.json({ error: "Tapılmadı" }, { status: 404 });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("[servis-detail]", e);
    return NextResponse.json({ error: "Xəta" }, { status: 500 });
  }
}
