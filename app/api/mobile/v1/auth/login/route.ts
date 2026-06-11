import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "@/lib/auth/credentials-core";
import { signAccessToken } from "@/lib/mobile/jwt";
import { issueRefreshToken } from "@/lib/mobile/refresh-store";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;
  const res = await authorizeUser({ email: body?.email, password: body?.password }, { ip, ua });
  if (!res.ok) return NextResponse.json({ error: "Email və ya şifrə yanlışdır" }, { status: 401 });
  const u = res.user;
  const accessToken = signAccessToken({ sahibkar_id: u.sahibkar_id, istifadeci_id: u.id, rol_id: u.rol_id, rol_ad: u.rol_ad });
  const refreshToken = await issueRefreshToken(u.sahibkar_id, u.id, (body?.cihaz as string) ?? ua);
  return NextResponse.json({ accessToken, refreshToken, user: u });
}
