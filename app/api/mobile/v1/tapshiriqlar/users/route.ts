import { NextRequest } from "next/server";
import { withMobile } from "@/lib/mobile/session";
import { getUsersForAssignment } from "@/features/tapshiriqlar/queries";

/** GET — tapşırıq təyin etmək üçün aktiv istifadəçilər (icraçı seçimi). */
export async function GET(req: NextRequest) {
  return withMobile(req, async () => {
    const users = await getUsersForAssignment().catch(() => []);
    return { users };
  });
}
