import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { markAllRead } from "@/features/alerts/actions";

export async function POST() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const r = await markAllRead();
  return NextResponse.json(r);
}
