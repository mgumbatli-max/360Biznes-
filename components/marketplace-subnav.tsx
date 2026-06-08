import Link from "next/link";
import { ScrollActiveIntoView } from "@/components/scroll-active-into-view";
import {
  Store,
  Share2,
  Send,
  RefreshCw,
  Webhook,
  Activity,
  type LucideIcon,
} from "lucide-react";

type Tab = {
  href: string;
  label: string;
  Icon: LucideIcon;
  desc?: string;
};

const TABS: Tab[] = [
  { href: "/marketplace",             label: "Marketplace", Icon: Store,    desc: "Bolt, Wolt, Yango, Tap" },
  { href: "/marketplace/multi-sync",  label: "Multi-Sync",   Icon: RefreshCw, desc: "Unified stok + sifariş" },
  { href: "/marketplace/sosial",      label: "Sosial hesab", Icon: Share2,   desc: "Instagram, Facebook, TikTok" },
  { href: "/marketplace/avto-poster", label: "Avto-Poster",  Icon: Send,     desc: "Post composer + planlayıcı" },
  { href: "/marketplace/webhook-orders", label: "Webhook sifarişləri", Icon: Webhook, desc: "Platforma webhook ilə qəbul olunan sifarişlər" },
  { href: "/marketplace/sync-health",    label: "Sync sağlamlığı",    Icon: Activity, desc: "Inbound/Webhook/Outbound real-time monitorinq" },
];

export function MarketplaceSubNav({ active }: { active: string }) {
  return (
    <div className="mb-4 space-y-2" data-subnav>
      <div className="flex min-w-0 rounded-xl border border-border bg-secondary/40 p-1">
        <ScrollActiveIntoView className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto scrollbar-thin">
          {TABS.map((tab) => {
            const isOn =
              tab.href === active ||
              (tab.href !== "/marketplace" && active.startsWith(tab.href));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                data-active={isOn ? "true" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isOn
                    ? "bg-gradient-to-b from-background to-background/80 text-primary shadow-md shadow-primary/10 ring-1 ring-primary/15"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground hover:-translate-y-px active:translate-y-0"
                }`}
                title={tab.desc}
              >
                <tab.Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </ScrollActiveIntoView>
      </div>
    </div>
  );
}
