import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/auth";
import { runWithTenant } from "@/lib/db/tenant-context";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { getAppMode } from "@/lib/app-mode";
import { getLiteConfig, getModuleEntry, hiddenLiteModules } from "@/lib/lite/config";
import type { LiteConfig } from "@/lib/lite/config";
import { LiteThemeScript, IcmalAttrScript } from "@/components/layout/lite-theme";
import { LiteThemeSync } from "@/components/layout/lite-theme-sync";
import { gateRoute } from "@/lib/auth/route-gate";
import {
  getTenantDisabledModules,
  isGateableModule,
  segmentToModuleKod,
  disabledModuleSegments,
} from "@/lib/auth/module-gate";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { LiteMenu } from "@/components/layout/lite-menu";
import { LiteMenuHydrator } from "@/components/layout/lite-menu-hydrator";
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
import { isSuperAdmin } from "@/lib/platform-admin/guard";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { QuickActionsFab } from "@/components/layout/quick-actions-fab";
import { StealthBanner } from "@/components/layout/stealth-banner";
import { NavigationTracker } from "@/components/layout/navigation-tracker";
import { RouteProgress } from "@/components/layout/route-progress";
import { IdleMount } from "@/components/layout/idle-mount";
import { runDailyBriefing } from "@/lib/daily-briefing/run";
import type { SessionUser } from "@/lib/auth/types";

type SidebarBadges = Record<string, { count: number; tone?: "rose" | "emerald" | "amber" }>;

async function SidebarShell({ user, hiddenModules }: { user: SessionUser; hiddenModules: string[] }) {
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
      hiddenModules={hiddenModules}
      isSuperAdmin={isSuperAdmin(user)}
    />
  );
}

async function TopbarShell({ user, hiddenModules }: { user: SessionUser; hiddenModules: string[] }) {
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
      hiddenModules={hiddenModules}
      isSuperAdmin={isSuperAdmin(user)}
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
  // Müvəqqəti DB/JWT problemi login olmuş istifadəçiyə xəta səhifəsi göstərməsin:
  // auth() pozularsa → login-ə yönəlt; icazələr yüklənməzsə → boş (owner/admin
  // gateRoute-da onsuz da bypass olunur, digər rollar /icaze-yox alır — crash yox).
  // appMode-u top-level Promise.all-da paralel çək — getLiteConfig() ilə serial
  // şəlalə əvəzinə. getLiteConfig() YALNIZ Lite rejimində çağırılır (çoxluq =
  // Pro: əlavə DB/cache round-trip-i tamamilə atılır).
  const [session, icazeler, appMode] = await Promise.all([
    auth().catch(() => null),
    getRequestPermissions().catch(() => [] as string[]),
    getAppMode().catch(() => "pro" as const),
  ]);
  if (!session?.user) redirect("/login");

  // Lite dizayn forması — yalnız Lite rejimində <html>-ə tətbiq olunur.
  // Pro-da getLiteConfig() çağırılmır; downstream üçün default config kifayət edir
  // (hiddenLiteModules(default) === [] — köhnə `liteCfg ? ... : []` ilə eyni nəticə;
  // liteDesign yalnız appMode==="lite" olduqda tətbiq olunur, default heç vaxt görünmür).
  const liteCfg: LiteConfig | null = appMode === "lite" ? await getLiteConfig() : null;
  const liteDesign = liteCfg?.design ?? null;
  // Lite-da gizlədilmiş modullar (Pro-da boş) — sidebar nav-dan çıxarılır.
  // `let`: aşağıda tenant-ın bağlı (entitlement) modulları da bura merge olunur.
  let hiddenModules = liteCfg ? hiddenLiteModules(liteCfg) : [];

  // PER-TENANT MODUL ENTITLEMENT — bağlı modulları BİR dəfə hesabla.
  // Super-admin (platform sahibi) bütün modullara bypass edir → heç vaxt bağlı.
  // FAIL-OPEN: sorğu pozularsa boş dəst (səhifə heç vaxt sınmasın — bu hot path-dir).
  const disabledModules = isSuperAdmin(session.user)
    ? new Set<string>()
    : await getTenantDisabledModules(session.user.sahibkar_id).catch(() => new Set<string>());
  // Nav-dan gizlət: bağlı `modul_kod`-ları route seqmentlərinə çevirib merge et
  // (sidebar/lite-menu/command-palette `hiddenModules`-u href seqmenti ilə tutur).
  if (disabledModules.size > 0) {
    hiddenModules = [...new Set([...hiddenModules, ...disabledModuleSegments(disabledModules)])];
  }

  // Modul icmalları (ayar + icazə) — subnav İcmal tabları üçün (hər iki rejim)
  const icmalModules = (
    await Promise.all(
      ["ticaret", "anbar", "maliyye", "elaqe"].map(async (m) =>
        (await getModuleEntry(m)).icmalOn ? m : null,
      ),
    )
  ).filter(Boolean) as string[];

  // Mərkəzi route gate — kassir /maliyye URL-ə yaza bilməsin və s.
  // Sahibkar/admin/owner rolları onsuz da bypass-ed olunur (gateRoute içində).
  try {
    const h = await headers();
    const pathname = h.get("x-pathname") ?? "";
    // Super-admin (rol_id=1 və ya email allowlist) bütün route-lara girir.
    if (pathname && !isSuperAdmin(session.user)) {
      const gate = gateRoute(pathname, session.user.rol_ad, icazeler);
      if (!gate.allowed) redirect("/icaze-yox");
    }
  } catch (e) {
    // headers() səhvi bizi başqa şəkildə bloklamasın — bu yalnız əlavə müdafiə qatıdır
    if (e && (e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
  }

  // PER-TENANT MODUL ENTITLEMENT — bağlı moduln route-una girişi blokla.
  // Cari path-in ilk seqmentini götür; gateable + tenant üçün bağlıdırsa /modul-yox.
  // Super-admin onsuz da yuxarıda boş `disabledModules` alır (bypass).
  if (disabledModules.size > 0) {
    try {
      const h = await headers();
      const pathname = h.get("x-pathname") ?? "";
      const seg = pathname.replace(/^\/+/, "").split("/")[0] ?? "";
      if (seg && isGateableModule(seg)) {
        const kod = segmentToModuleKod(seg);
        if (kod && disabledModules.has(kod)) redirect("/modul-yox");
      }
    } catch (e) {
      // FAIL-OPEN: yalnız redirect-i ötür, digər səhvlər səhifəni sındırmasın.
      if (e && (e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    }
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
        {/* Lite dizayn forması — SSR inline script, ilk paint-dən əvvəl (FOUC yox) */}
        <LiteThemeScript design={liteDesign} active={appMode === "lite"} />
        <IcmalAttrScript modules={icmalModules} />
        <LiteThemeSync design={liteDesign} active={appMode === "lite"} icmal={icmalModules} />
        <EmbedDetector />
        <NavigationTracker />
        <RouteProgress />
        <div className="flex min-h-screen bg-background" data-app-shell>
          <div data-sidebar-container>
            <Suspense fallback={<SidebarFallback />}>
              <SidebarShell user={session.user} hiddenModules={hiddenModules} />
            </Suspense>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <StealthBanner />
            <div data-topbar-container>
              <Suspense fallback={<TopbarFallback />}>
                <TopbarShell user={session.user} hiddenModules={hiddenModules} />
              </Suspense>
            </div>
            {/* overflow-x-CLIP (hidden DEYİL): `hidden` overflow-y-ni `auto`-ya
                çevirir → main scroll-konteyner olur və iOS-da body scroll-unu
                bloklayır (donma). `clip` üfüqi daşmanı kəsir, amma şaquli oxu
                `visible` saxlayır → səhifə body kimi rahat scroll olur. */}
            <main className="flex-1 overflow-x-clip p-4 pb-safe-20 md:p-6 md:pb-6 animate-fade-in">{children}</main>
          </div>
          <BottomNav />
          <LiteMenu isSuperAdmin={isSuperAdmin(session.user)} />
          <LiteMenuHydrator hiddenModules={hiddenModules} />
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
