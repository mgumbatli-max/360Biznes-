import { NextRequest } from "next/server";
import { withMobile } from "@/lib/mobile/session";
import { getAvailableUsers } from "@/features/team/queries";

/** GET — söhbət başlatmaq üçün aktiv əməkdaşlar. */
export async function GET(req: NextRequest) {
  return withMobile(req, async () => {
    const users = await getAvailableUsers().catch(() => []);
    return {
      users: users.map((u) => ({ id: u.id, ad_soyad: u.ad_soyad, vezife: u.vezife ?? null })),
    };
  });
}
