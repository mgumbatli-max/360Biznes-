import type { Metadata } from "next";
import { MessageSquare, Mail, MessageCircle, Hash, Inbox as InboxIcon } from "lucide-react";
import { CrmSubNav } from "@/components/crm-subnav";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { InboxList } from "@/features/crm/components/inbox-list";
import { getChats, getInboxStats } from "@/features/crm/inbox-queries";

export const metadata: Metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ kanal?: string; q?: string; unread?: string }>;

export default async function InboxPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const [chats, stats] = await Promise.all([
    getChats({
      kanal: sp.kanal || null,
      q: sp.q || null,
      only_unread: sp.unread === "1",
    }),
    getInboxStats(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <CrmSubNav active="/crm/inbox" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <InboxIcon className="h-5 w-5" /> Inbox
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bütün kanallardan gələn mesajlar (WhatsApp, Telegram, Instagram, SMS, Email).
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={MessageSquare} label="Cəm söhbət" value={String(stats.total)} subline="Açıq və bağlı" />
        <KpiCard icon={Mail} label="Oxunmamış" value={String(stats.oxunmamis)} subline="Cavab gözləyir" tone={stats.oxunmamis > 0 ? "warning" : "neutral"} />
        <KpiCard icon={MessageCircle} label="Son 24 saat" value={String(stats.today)} subline="Yeni aktivlik" />
        <KpiCard icon={Hash} label="Aktiv kanallar" value={String(5)} subline="Multi-channel" />
      </section>

      <InboxList chats={chats} selectedId={null} />
    </div>
  );
}
