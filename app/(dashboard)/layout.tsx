import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/auth";
import { runWithTenant } from "@/lib/db/tenant-context";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { getAppMode } from "@/lib/app-mode";
import { gateRoute } from "@/lib/auth/route-gate";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";
import { PwaInstallPrompt } from "@/components/layout/pwa-install-prompt";
import { OfflineIndicator } from "@/components/layout/offline-indicator";
import { EmbedDetector } from "@/components/layout/embed-detector";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { getRecentAlerts } from "@/features/alerts/get-recent-alerts";
import { getMyNotifications } from "@/features/bildirisler/get-my-notifications";
import { getMyActiveReminders, getMyWorkSummary } from "@/features/tapshiriqlar/queries";
import { getNezaretSidebarTotal } from "@/features/nezaret-merkezi/counts";
import { getSahibkarSidebarVisible } from "@/lib/sahibkar/visibility";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { QuickActionsFab } from "@/components/layout/quick-actions-fab";
import { StealthBanner } from "@/components/layout/stealth-banner";
import { NavigationTracker } from "@/components/layout/navigation-tracker";
import { RouteProgress } from "@/components/layout/route-progress";
import { IdleMount } from "@/components/layout/idle-mount";
import { runDailyBriefing } from "@/lib/daily-briefing/run";
import type { SessionUser } from "@/lib/auth/types";

type SidebarBadges = Record<string, { count: number; tone?: "rose" | "emerald" | "amber" }>;

async function SidebarShell({ user }: { user: SessionUser }) {
  const [reminderCount, nezaretBadge, sahibkarVisible] = await Promise.all([
    getMyActiveReminders().catch(() => 0),
    getNezaretSidebarTotal().catch(() => ({ count: 0, tone: "emerald" as const })),
    getSahibkarSidebarVisible(user.rol_ad).catch(() => true),
  ]);
  const badges: SidebarBadges = {};
  if (reminderCount > 0) badges["/tapshiriqlar"] = { count: reminderCount, tone: "rose" };
  if (nezaretBadge.count > 0) {
    badges["/nezaret-merkezi"] = { count: nezaretBadge.count, tone: nezaretBadge.tone };
  }
  return (
    <Sidebar
      user={user}
      badges={Object.keys(badges).length > 0 ? badges : undefined}
      sahibkarVisible={sahibkarVisible}
    />
  );
}

async function TopbarShell({ user }: { user: SessionUser }) {
  const [alertsData, myNotifs, myWork, appMode] = await Promise.all([
    getRecentAlerts(7).catch(() => ({ items: [], unreadCount: 0 })),
    getMyNotifications(7).catch(() => ({ items: [], unreadCount: 0 })),
    getMyWorkSummary().catch(() => ({
      myTasks: [],
      todayReminders: [],
      pendingApprovals: [],
      canSeeApprovals: false,
      totals: { tasks: 0, reminders: 0, approvals: 0 },
    })),
    getAppMode().catch(() => "pro" as const),
  ]);
  const alertItems = alertsData.items.map((a) => ({
    id: a.id,
    basliq: a.basliq,
    seviyye: a.seviyye,
    kateqoriya_ad: a.kateqoriya_ad,
    kateqoriya_emoji: a.kateqoriya_emoji,
    // `first_seen_at` artıq ISO string-dir (cache-safe)
    first_seen_at: a.first_seen_at,
  }));
  // Şəxsi bildirişlər (tapşırıq, status dəyişiklikləri, xatırlatma)
  const personalItems = myNotifs.items.map((b) => ({
    id: b.id,
    basliq: b.basliq,
    seviyye: b.oxundu ? "info" : "xeber",
    kateqoriya_ad: "Şəxsi bildiriş",
    kateqoriya_emoji: null,
    // `yaradildi` artıq ISO string-dir (cache-safe)
    first_seen_at: b.yaradildi,
    is_personal: true,
    link: b.link,
    oxundu: b.oxundu,
    nov: b.nov,
  }));
  // Hər iki növü birləşdirir — şəxsi olanlar əvvəlcə (yeni və adresat-spesifik)
  const merged = [...personalItems, ...alertItems];
  const totalUnread = alertsData.unreadCount + myNotifs.unreadCount;
  return (
    <Topbar
      user={user}
      alerts={merged}
      unreadCount={totalUnread}
      myWork={myWork}
      appMode={appMode}
    />
  );
}

function SidebarFallback() {
  return <div className="hidden md:block w-[260px] border-r border-sidebar-border bg-sidebar" />;
}

function TopbarFallback() {
  return <div className="h-14 border-b border-border bg-background" />;
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [session, icazeler] = await Promise.all([auth(), getRequestPermissions()]);
  if (!session?.user) redirect("/login");

  // Mərkəzi route gate — kassir /maliyye URL-ə yaza bilməsin və s.
  // Sahibkar/admin/owner rolları onsuz da bypass-ed olunur (gateRoute içində).
  try {
    const h = await headers();
    const pathname = h.get("x-pathname") ?? "";
    if (pathname) {
      const gate = gateRoute(pathname, session.user.rol_ad, icazeler);
      if (!gate.allowed) redirect("/icaze-yox");
    }
  } catch (e) {
    // headers() səhvi bizi başqa şəkildə bloklamasın — bu yalnız əlavə müdafiə qatıdır
    if (e && (e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
  }

  // Gündə bir dəfə avto-brifinq — naviqasiyanı bloklamır, cavabdan sonra işləyir.
  // `after()` Server Component-də cookie-yə girə bilmir, ona görə tenant kontekstini
  // burada bağlayıb keçirik (auth() yenidən çağırılmır).
  const tenantCtx = {
    sahibkarId: session.user.sahibkar_id,
    istifadeciId: session.user.id,
    rolId: session.user.rol_id,
    rolAd: session.user.rol_ad,
    icazeler,
  };
  after(() =>
    runWithTenant(tenantCtx, () => runDailyBriefing()).catch(() => {})
  );

  return (
    <AuthSessionProvider>
      <PermissionsProvider icazeler={icazeler}>
        <EmbedDetector />
        <NavigationTracker />
        <RouteProgress />
        <div className="flex min-h-screen bg-background" data-app-shell>
          <div data-sidebar-container>
            <Suspense fallback={<SidebarFallback />}>
              <SidebarShell user={session.user} />
            </Suspense>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <StealthBanner />
            <div data-topbar-container>
              <Suspense fallback={<TopbarFallback />}>
                <TopbarShell user={session.user} />
              </Suspense>
            </div>
            {/* overflow-x-CLIP (hidden DEYİL): `hidden` overflow-y-ni `auto`-ya
                çevirir → main scroll-konteyner olur və iOS-da body scroll-unu
                bloklayır (donma). `clip` üfüqi daşmanı kəsir, amma şaquli oxu
                `visible` saxlayır → səhifə body kimi rahat scroll olur. */}
            <main className="flex-1 overflow-x-clip p-4 pb-safe-20 md:p-6 md:pb-6 animate-fade-in">{children}</main>
          </div>
          <BottomNav />
          {/* Critical olmayan widget-lər — interactive olduqdan sonra mount olur.
              Bu, ilk paint-i bloklayan client JS-i ~3-5 komponent həcmində azaldır. */}
          <IdleMount>
            <KeyboardShortcuts />
            <QuickActionsFab />
            <PullToRefresh />
            <PwaInstallPrompt />
            <OfflineIndicator />
          </IdleMount>
        </div>
      </PermissionsProvider>
    </AuthSessionProvider>
  );
}
