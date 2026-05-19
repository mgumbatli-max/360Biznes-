import type { Metadata } from "next";
import { Share2, MessageCircle, Globe2 } from "lucide-react";
import { MarketplaceSubNav } from "@/components/marketplace-subnav";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SocialConnectDialog } from "@/features/marketplace/components/social-connect-dialog";
import { SocialAccountCard } from "@/features/marketplace/components/social-account-card";
import { getSocialAccounts, getSocialStats, SOCIAL_CHANNELS } from "@/features/marketplace/social-queries";

export const metadata: Metadata = { title: "Sosial hesablar" };
export const dynamic = "force-dynamic";

export default async function SocialAccountsPage() {
  const [accounts, stats] = await Promise.all([
    getSocialAccounts(),
    getSocialStats(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <MarketplaceSubNav active="/marketplace/sosial" />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-pink-500 to-violet-500 shadow-lg shadow-pink-500/30">
            <Share2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sosial hesablar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Instagram, Facebook, TikTok, Telegram, WhatsApp və digər platformaları qoş.
            </p>
          </div>
        </div>
        <SocialConnectDialog />
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Share2} label="Cəm hesab" value={String(stats.hesab_sayi)} subline={`${stats.aktiv_hesab} aktiv`} />
        <KpiCard icon={MessageCircle} label="Postlar" value={String(stats.cem_post)} subline={`${stats.qaralama} qaralama`} />
        <KpiCard icon={Globe2} label="Planlaşdırılmış" value={String(stats.planlasdirilmis)} subline="vaxt gözləyir" tone={stats.planlasdirilmis > 0 ? "info" : "neutral"} />
        <KpiCard icon={MessageCircle} label="Son 30 günün postu" value={String(stats.gonderildi_30g)} subline="göndərilib" tone="success" />
      </section>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Share2}
          tone="primary"
          title="Hələ sosial hesab qoşulmayıb"
          description="Instagram, Facebook, TikTok, Telegram, WhatsApp və digər platformaları sistemə qoş — bir yerdən idarə et."
          help="Hər platforma üçün «Send URL» (göndərmə endpoint-i) lazımdır. Bu, sosial platformanın API-ə birbaşa POST göndərən universal webhook-relay-dir. Real production-da hər platforma üçün xüsusi API token + OAuth lazımdır — şəxsi backend / Make / Zapier kimi vasitələrlə də əldə oluna bilər."
          examples={[
            { icon: SOCIAL_CHANNELS[0] ? Share2 : Share2, title: "Instagram + Facebook", desc: "Meta Graph API ilə post avto-paylaşma" },
            { icon: MessageCircle, title: "Telegram bot",  desc: "Bot API ilə kanal/qrup-a yazır" },
            { icon: Globe2,        title: "Universal relay", desc: "Make / Zapier scenarisi vasitəsilə" },
          ]}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <SocialAccountCard key={a.id} account={a} />
          ))}
        </div>
      )}

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
        <strong className="font-semibold">💡 Necə test etmək olar?</strong> Hər hesabı qoşandan sonra «Test» düyməsinə basın — sistem
        Send URL-ə test sorğusu göndərir. URL boşdursa, sistem mock-mode-da işləyir (postlar saxlanır lakin real platformaya getmir).
        Production üçün hər platformanın token-ini Ayarlar &gt; Sosial integration-da qoyun.
      </div>
    </div>
  );
}
