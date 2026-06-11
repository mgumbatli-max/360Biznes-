import { NextRequest } from "next/server";
import { withMobile } from "@/lib/mobile/session";
import { prismaUnscoped } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    const u = await prismaUnscoped.istifadeciler.findFirst({
      where: { id: ctx.istifadeciId },
      select: { id: true, ad_soyad: true, email: true, vezife: true, roles: { select: { ad: true } } },
    });
    return { user: u, rol_ad: ctx.rolAd, icazeler: ctx.icazeler };
  });
}
