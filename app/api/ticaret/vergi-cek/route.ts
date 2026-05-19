import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendVergiCekAction } from "@/features/pos/extras-actions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { satis_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.satis_id) {
    return NextResponse.json({ ok: false, error: "satis_id required" }, { status: 400 });
  }
  const res = await sendVergiCekAction(body.satis_id);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
