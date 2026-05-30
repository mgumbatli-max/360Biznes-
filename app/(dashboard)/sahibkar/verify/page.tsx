import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { UnifiedVerifyForm } from "@/features/sahibkar/components/unified-verify-form";
import { touchPinSession } from "@/lib/sahibkar/session";
import { getAttemptStatus } from "@/lib/sahibkar/rate-limit";

export const metadata: Metadata = { title: "Sahibkar — Giriş" };

export default async function PinVerifyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol_id !== 9) redirect("/dashboard");

  const cfg = await withTenant(async () => prisma.sahibkar_ayar.findFirst());
  if (!cfg?.sifre_hash) redirect("/sahibkar/setup");

  // Already verified?
  const active = await touchPinSession();
  if (active) redirect("/sahibkar");

  const status = await getAttemptStatus();
  return <UnifiedVerifyForm initialAttempts={status.count} limit={cfg.yanlis_limit ?? 5} />;
}
