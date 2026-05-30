import Link from "next/link";
import { ScrollActiveIntoView } from "@/components/scroll-active-into-view";
import {
  LayoutDashboard,
  Users,
  Inbox,
  Megaphone,
  FileText,
  Sparkles,
  GitBranch,
  Layers,
  BarChart3,
  Home,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

type CrmTab = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

const CRM_TABS: CrmTab[] = [
  { href: "/crm",           label: "Dashboard",  Icon: LayoutDashboard },
  { href: "/crm/leadler",   label: "Leadlər",    Icon: Users },
  { href: "/crm/inbox",     label: "Inbox",      Icon: Inbox },
  { href: "/crm/funnel",    label: "Funnel",     Icon: GitBranch },
  { href: "/crm/segment",   label: "Seqment",    Icon: Layers },
  { href: "/crm/broadcast", label: "Broadcast",  Icon: Megaphone },
  { href: "/crm/sablonlar", label: "Şablonlar",  Icon: FileText },
  { href: "/crm/ai-cavab",  label: "AI cavab",   Icon: Sparkles },
  { href: "/crm/kpi",       label: "KPI",        Icon: BarChart3 },
];

export function CrmSubNav({ active }: { active: string }) {
  const current = CRM_TABS.find((t) => t.href === active);
  return (
    <div className="space-y-2.5 mb-4" data-subnav>
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/dashboard" className="inline-flex items-center hover:text-primary">
          <Home className="h-3 w-3" />
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/crm" className="hover:text-primary">CRM / Mesaj Mərkəzi</Link>
        {active !== "/crm" && current && (
          <>
            <ChevronRight className="h-3 w-3" />
            <span className="font-semibold text-foreground">{current.label}</span>
          </>
        )}
      </nav>
      <div className="flex rounded-xl border border-border bg-secondary/40 p-1">
        <ScrollActiveIntoView className="flex flex-1 gap-0.5 overflow-x-auto scrollbar-thin">
          {CRM_TABS.map((tab) => {
            const isOn = tab.href === active;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                data-active={isOn ? "true" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isOn
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
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
