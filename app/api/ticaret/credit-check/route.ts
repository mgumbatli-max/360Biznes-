import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkCustomerCreditLimit } from "@/features/ticaret/customer-tier";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const musteri = req.nextUrl.searchParams.get("musteri");
  const meblegStr = req.nextUrl.searchParams.get("mebleg");
  if (!musteri || !meblegStr) {
    return NextResponse.json(
      { ok: false, error: "musteri və mebleg param tələb olunur" },
      { status: 400 }
    );
  }
  const mebleg = Number(meblegStr);
  if (!Number.isFinite(mebleg) || mebleg < 0) {
    return NextResponse.json({ ok: false, error: "mebleg yanlışdır" }, { status: 400 });
  }
  try {
    const r = await checkCustomerCreditLimit(musteri, mebleg);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Xəta" }, { status: 500 });
  }
}
