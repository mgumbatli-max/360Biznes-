import { NextRequest, NextResponse } from "next/server";
import { revokeRefreshToken } from "@/lib/mobile/refresh-store";

export async function POST(req: NextRequest) {
  const { refreshToken } = await req.json().catch(() => ({} as { refreshToken?: string }));
  if (refreshToken) await revokeRefreshToken(refreshToken);
  return NextResponse.json({ ok: true });
}
