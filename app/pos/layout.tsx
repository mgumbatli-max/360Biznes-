import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { PosHeader } from "@/features/pos/components/pos-header";
import { OfflineBanner } from "@/features/pos/components/offline-banner";

export const metadata = {
  title: "POS — İsti satış",
};

export default async function PosStandaloneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const icazeler = await getRequestPermissions();

  return (
    <AuthSessionProvider>
      <PermissionsProvider icazeler={icazeler}>
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
          <PosHeader user={{ ad_soyad: session.user.ad_soyad, sahibkar_ad: session.user.sahibkar_ad }} />
          <OfflineBanner />
          <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        </div>
      </PermissionsProvider>
    </AuthSessionProvider>
  );
}
