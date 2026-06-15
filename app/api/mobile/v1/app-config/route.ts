import { NextRequest } from "next/server";
import { withMobile } from "@/lib/mobile/session";
import { getLiteConfigForTenant } from "@/lib/lite/config";
import { getTenantDisabledModules } from "@/lib/auth/module-gate";
import { isSuperAdmin } from "@/lib/platform-admin/guard";
import { prismaUnscoped } from "@/lib/db/prisma";

/**
 * GET — tenant-ın Lite/Pro fərdiləşdirməsi (mobil app oxuyur).
 * Mobil Lite/Pro mode-u CİHAZ-LOKALDIR (SecureStore); bu endpoint yalnız
 * per-tenant config-i (modul görünüşü `visible` + bloklar + dizayn) +
 * super-admin tərəfindən BAĞLANMIŞ modulların `modul_kod` siyahısını +
 * cari istifadəçinin super-admin olub-olmadığını (Platform Admin plitəsi) qaytarır.
 */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    const lite = await getLiteConfigForTenant(ctx.sahibkarId);
    // FAIL-OPEN: gate sorğusu fail edərsə heç nə bağlama (boş dəst).
    let disabledModules: string[] = [];
    try {
      const disabled = await getTenantDisabledModules(ctx.sahibkarId);
      disabledModules = Array.from(disabled);
    } catch {
      disabledModules = [];
    }

    // Super-admin — web guard ilə EYNİ məntiq (email allowlist + sahibkar_id bağlaması).
    // ctx-də email yoxdur → bir kiçik sorğu ilə yüklənir. Fail-da false.
    let superAdmin = false;
    try {
      const me = await prismaUnscoped.istifadeciler.findFirst({
        where: { id: ctx.istifadeciId, sahibkar_id: ctx.sahibkarId },
        select: { email: true },
      });
      if (me?.email) {
        superAdmin = isSuperAdmin({ email: me.email, sahibkar_id: ctx.sahibkarId });
      }
    } catch {
      superAdmin = false;
    }

    return { lite, disabledModules, isSuperAdmin: superAdmin };
  });
}
