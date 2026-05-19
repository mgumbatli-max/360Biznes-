import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCrossSellSuggestions } from "@/features/ticaret/cross-sell-queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const mehsul = req.nextUrl.searchParams.get("mehsul");
  if (!mehsul) {
    return NextResponse.json({ ok: false, error: "mehsul param tələb olunur" }, { status: 400 });
  }

  const limit = Math.min(10, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 3));
  try {
    const items = await getCrossSellSuggestions(mehsul, limit);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Xəta" },
      { status: 500 }
    );
  }
}
