import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccountBalance } from "@/features/maliyye/extended-queries";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const hesabId = url.searchParams.get("hesab_id") ?? "";
  if (!hesabId) return NextResponse.json({ error: "hesab_id tələb olunur" }, { status: 400 });

  try {
    const bal = await getAccountBalance(hesabId);
    if (!bal) return NextResponse.json({ error: "Hesab tapılmadı" }, { status: 404 });
    return NextResponse.json(bal);
  } catch (e) {
    console.error("[maliyye-balance]", e);
    return NextResponse.json({ error: "Balans alınmadı" }, { status: 500 });
  }
}
