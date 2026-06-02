import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";

/**
 * İstifadəçinin rol icazələri cache-ini dərhal yeniləmək üçün end-point.
 * Yeni icazə əlavə edildikdə (məs. SQL migration) istifadəçi bunu çağırıb
 * 5 dəqiqə gözləməyə bilər.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.rol_id) {
    return NextResponse.json({ ok: false, error: "Giriş tələb olunur" }, { status: 401 });
  }
  revalidateTag(`role-perms:${session.user.rol_id}`, "max");
  return NextResponse.json({ ok: true, rolId: session.user.rol_id });
}

// GET də dəstəklənir — link kimi açıla bilər
export const GET = POST;
