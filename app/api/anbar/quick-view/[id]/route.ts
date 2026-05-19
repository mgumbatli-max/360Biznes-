import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { withTenant } from "@/lib/db/with-tenant";
import { getQuickView } from "@/features/anbar/quick-view-queries";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const data = await withTenant(() => getQuickView(id));
  return NextResponse.json(data);
}
