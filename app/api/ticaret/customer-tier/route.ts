import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCustomerPriceTier } from "@/features/ticaret/customer-tier";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const musteri = req.nextUrl.searchParams.get("musteri");
  if (!musteri) {
    return NextResponse.json({ ok: false, error: "musteri param tələb olunur" }, { status: 400 });
  }
  try {
    const info = await getCustomerPriceTier(musteri);
    if (!info) return NextResponse.json({ ok: false, error: "Müştəri tapılmadı" }, { status: 404 });
    return NextResponse.json({ ok: true, ...info });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Xəta" }, { status: 500 });
  }
}
