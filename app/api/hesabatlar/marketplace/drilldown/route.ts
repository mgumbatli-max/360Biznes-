import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { withTenant } from "@/lib/db/with-tenant";
import { getPlatformDrilldown } from "@/features/hesabatlar/marketplace-queries";
import { parseDateRange } from "@/features/hesabatlar/shared";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const platform = sp.get("platform") ?? "";
  if (!platform) return NextResponse.json({ error: "platform required" }, { status: 400 });

  const range = parseDateRange({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const data = await withTenant(async () => getPlatformDrilldown(range, platform));
  return NextResponse.json(data);
}
