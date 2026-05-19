import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Platform-admin guard. Only role_id=1 (system admin) is permitted.
 * Use at the top of every /platform-admin/* server component.
 */
export async function requirePlatformAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol_id !== 1) redirect("/dashboard");
  return session.user;
}
