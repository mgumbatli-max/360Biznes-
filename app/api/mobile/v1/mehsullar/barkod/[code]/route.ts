import { NextRequest } from "next/server";
import { withMobile } from "@/lib/mobile/session";
import { scanLookup } from "@/features/ticaret/qaytarma-tez-actions";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  return withMobile(req, async () => await scanLookup(decodeURIComponent(code)));
}
