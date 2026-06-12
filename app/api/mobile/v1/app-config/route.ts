import { NextRequest } from "next/server";
import { withMobile } from "@/lib/mobile/session";
import { getLiteConfigForTenant } from "@/lib/lite/config";

/**
 * GET — tenant-ın Lite/Pro fərdiləşdirməsi (mobil app oxuyur).
 * Mobil Lite/Pro mode-u CİHAZ-LOKALDIR (SecureStore); bu endpoint yalnız
 * per-tenant config-i (modul görünüşü `visible` + bloklar + dizayn) qaytarır.
 */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    const lite = await getLiteConfigForTenant(ctx.sahibkarId);
    return { lite };
  });
}
