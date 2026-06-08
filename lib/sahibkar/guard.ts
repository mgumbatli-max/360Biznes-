import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { touchPinSession } from "./session";

export type SahibkarSetupState = "no-user" | "wrong-role" | "needs-setup" | "needs-verify" | "ready";

/**
 * Server-side guard for sahibkar pages. Returns the readiness state.
 * - `needs-setup` → redirect to /sahibkar/setup
 * - `needs-verify` → redirect to /sahibkar/verify
 * - `ready` → proceed
 */
export async function getSahibkarState(): Promise<SahibkarSetupState> {
  const session = await auth();
  if (!session?.user) return "no-user";
  if (session.user.rol_ad !== "sahibkar") return "wrong-role";

  const hasPin = await withTenant(async () => {
    const cfg = await prisma.sahibkar_ayar.findFirst();
    return !!cfg?.sifre_hash;
  });
  if (!hasPin) return "needs-setup";

  const sess = await touchPinSession();
  if (!sess) return "needs-verify";

  return "ready";
}

/** Throws redirect if not ready. Use at the top of every gated sahibkar page. */
export async function requireSahibkarSession() {
  const state = await getSahibkarState();
  if (state === "no-user") redirect("/login");
  if (state === "wrong-role") redirect("/dashboard");
  if (state === "needs-setup") redirect("/sahibkar/setup");
  if (state === "needs-verify") redirect("/sahibkar/verify");
}
