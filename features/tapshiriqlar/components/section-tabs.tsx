import Link from "next/link";
import {
  ListTodo, Folder, Link2, BarChart3, Sparkles, Archive, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SectionTab = "list" | "sablonlar" | "layihe" | "baglanti" | "statistika" | "ai" | "arxiv";

const TABS: { id: SectionTab; label: string; href: string; icon: typeof ListTodo }[] = [
  { id: "list",        label: "Tapşırıqlar",  href: "/tapshiriqlar",            icon: ListTodo },
  { id: "sablonlar",   label: "Şablonlar",    href: "/tapshiriqlar/sablonlar",  icon: FileText },
  { id: "layihe",      label: "Layihələr",    href: "/tapshiriqlar/layihe",     icon: Folder },
  { id: "baglanti",    label: "Modul bağlantı", href: "/tapshiriqlar/baglanti", icon: Link2 },
  { id: "statistika",  label: "Statistika",   href: "/tapshiriqlar/statistika", icon: BarChart3 },
  { id: "ai",          label: "AI Analiz",    href: "/tapshiriqlar/ai-analiz",  icon: Sparkles },
  { id: "arxiv",       label: "Arxiv",        href: "/tapshiriqlar?scope=hamisi&status=tamamlandi", icon: Archive },
];

export function TaskSectionTabs({ current }: { current: SectionTab }) {
  return (
    <nav className="overflow-x-auto rounded-xl border border-border/40 bg-card/40 p-1">
      <div className="flex min-w-max items-center gap-0.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === current;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition",
                active ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
