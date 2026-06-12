import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db/prisma";
import { signAccessToken } from "@/lib/mobile/jwt";
import { rotateRefreshToken } from "@/lib/mobile/refresh-store";

export async function POST(req: NextRequest) {
  const { refreshToken } = await req.json().catch(() => ({} as { refreshToken?: string }));
  if (!refreshToken) return NextResponse.json({ error: "refreshToken yoxdur" }, { status: 400 });
  const r = await rotateRefreshToken(refreshToken);
  if (!r) return NextResponse.json({ error: "Sessiya bitib, yenidən daxil olun" }, { status: 401 });
  const u = await prismaUnscoped.istifadeciler.findFirst({
    where: { id: r.istifadeciId, aktiv: true },
    select: { id: true, rol_id: true, sahibkar_id: true, roles: { select: { ad: true } } },
  });
  if (!u) return NextResponse.json({ error: "İstifadəçi aktiv deyil" }, { status: 401 });
  const accessToken = signAccessToken({ sahibkar_id: u.sahibkar_id, istifadeci_id: u.id, rol_id: u.rol_id ?? 3, rol_ad: u.roles?.ad ?? "" });
  return NextResponse.json({ accessToken, refreshToken: r.newRaw });
}
