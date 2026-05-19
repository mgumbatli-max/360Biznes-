import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { EmbedDetector } from "@/components/layout/embed-detector";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { getRecentAlerts } from "@/features/alerts/get-recent-alerts";
import { getMyActiveReminders, getMyWorkSummary } from "@/features/tapshiriqlar/queries";
import { getNezaretSidebarTotal } from "@/features/nezaret-merkezi/counts";
import { getSahibkarSidebarVisible } from "@/lib/sahibkar/visibility";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { QuickActionsFab } from "@/components/layout/quick-actions-fab";
import { StealthBanner } from "@/components/layout/stealth-banner";
import { runDailyBriefing } from "@/lib/daily-briefing/run";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const icazeler = await getRequestPermissions();
  // Gündə bir dəfə avto-brifinq (no-op əgər artıq bu gün edilibsə)
  await runDailyBriefing().catch(() => {});
  const alertsData = await getRecentAlerts(10).catch(() => ({ items: [], unreadCount: 0 }));
  const reminderCount = await getMyActiveReminders().catch(() => 0);
  const nezaretBadge = await getNezaretSidebarTotal().catch(() => ({ count: 0, tone: "emerald" as const }));
  const myWork = await getMyWorkSummary().catch(() => ({
    myTasks: [],
    todayReminders: [],
    pendingApprovals: [],
    canSeeApprovals: false,
    totals: { tasks: 0, reminders: 0, approvals: 0 },
  }));
  const sidebarBadges: Record<string, { count: number; tone?: "rose" | "emerald" | "amber" }> = {};
  if (reminderCount > 0) sidebarBadges["/tapshiriqlar"] = { count: reminderCount, tone: "rose" };
  if (nezaretBadge.count > 0) {
    sidebarBadges["/nezaret-merkezi"] = { count: nezaretBadge.count, tone: nezaretBadge.tone };
  }
  const alertItems = alertsData.items.map((a) => ({
    id: a.id,
    basliq: a.basliq,
    seviyye: a.seviyye,
    kateqoriya_ad: a.kateqoriya_ad,
    kateqoriya_emoji: a.kateqoriya_emoji,
    first_seen_at: a.first_seen_at ? a.first_seen_at.toISOString() : null,
  }));

  return (
    <AuthSessionProvider>
      <PermissionsProvider icazeler={icazeler}>
        <EmbedDetector />
        <div className="flex min-h-screen bg-background" data-app-shell>
          <div data-sidebar-container>
            <Sidebar user={session.user} badges={Object.keys(sidebarBadges).length > 0 ? sidebarBadges : undefined} sahibkarVisible={await getSahibkarSidebarVisible(session.user.rol_id)} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <StealthBanner />
            <div data-topbar-container>
              <Topbar
                user={session.user}
                alerts={alertItems}
                unreadCount={alertsData.unreadCount}
                myWork={myWork}
              />
            </div>
            <main className="flex-1 overflow-x-hidden p-4 md:p-6 animate-fade-in">{children}</main>
            <KeyboardShortcuts />
          </div>
          <QuickActionsFab />
        </div>
      </PermissionsProvider>
    </AuthSessionProvider>
  );
}
