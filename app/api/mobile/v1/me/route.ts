import { NextRequest } from "next/server";
import { withMobile } from "@/lib/mobile/session";
import { prismaUnscoped } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    // QA-mobil: sahibkar_ad/sahibkar_id əlavə — restart-da profil/salamlama boş qalmasın (auth-store /me-dən
    // user-i hidratlaşdırır). Login cavabı ilə eyni forma.
    const [u, sah] = await Promise.all([
      prismaUnscoped.istifadeciler.findFirst({
        where: { id: ctx.istifadeciId },
        select: { id: true, ad_soyad: true, email: true, vezife: true, roles: { select: { ad: true } } },
      }),
      prismaUnscoped.sahibkarlar.findUnique({ where: { id: ctx.sahibkarId }, select: { ad: true } }).catch(() => null),
    ]);
    return {
      user: u ? { ...u, sahibkar_id: ctx.sahibkarId, sahibkar_ad: sah?.ad ?? null } : null,
      rol_ad: ctx.rolAd,
      icazeler: ctx.icazeler,
    };
  });
}
