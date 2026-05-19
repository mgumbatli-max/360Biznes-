import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFinanceAttachments } from "@/features/maliyye/extended-queries";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const items = await getFinanceAttachments(id);
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[maliyye-sened-list]", e);
    return NextResponse.json({ error: "Yüklənmədi" }, { status: 500 });
  }
}
