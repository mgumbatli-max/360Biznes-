import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { MarketPosHeader } from "@/features/ticaret/components/market-pos-header";

export const metadata = {
  title: "Marketdən satış",
};

export default async function MarketPosStandaloneLayout({
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
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-900 pt-safe pb-safe">
          <MarketPosHeader
            user={{
              ad_soyad: session.user.ad_soyad,
              sahibkar_ad: session.user.sahibkar_ad,
            }}
          />
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </PermissionsProvider>
    </AuthSessionProvider>
  );
}
