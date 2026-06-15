import { NextRequest } from "next/server";
import { withMobile } from "@/lib/mobile/session";
import { getLiteConfigForTenant } from "@/lib/lite/config";
import { getTenantDisabledModules } from "@/lib/auth/module-gate";

/**
 * GET — tenant-ın Lite/Pro fərdiləşdirməsi (mobil app oxuyur).
 * Mobil Lite/Pro mode-u CİHAZ-LOKALDIR (SecureStore); bu endpoint yalnız
 * per-tenant config-i (modul görünüşü `visible` + bloklar + dizayn) +
 * super-admin tərəfindən BAĞLANMIŞ modulların `modul_kod` siyahısını qaytarır.
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
    return { lite, disabledModules };
  });
}
