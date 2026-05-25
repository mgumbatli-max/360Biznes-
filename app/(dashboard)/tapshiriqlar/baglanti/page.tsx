import type { Metadata } from "next";
import Link from "next/link";
import {
  Link2, Package, Users, Truck, ShoppingCart, RotateCcw, Wrench, Warehouse, Briefcase,
  Building2, Globe, Radar, ShieldCheck, FileText, Wallet, Tag, ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskSectionTabs } from "@/features/tapshiriqlar/components/section-tabs";
import { getModuleTaskCounts } from "@/features/tapshiriqlar/cross-module";
import { LINKABLE_MODULES } from "@/features/tapshiriqlar/cross-module-constants";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { formatDate, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tapşırıqlar — Modul bağlantı" };
export const dynamic = "force-dynamic";

const MODULE_META: Record<string, { icon: typeof Package; color: string }> = {
  mehsul:        { icon: Package,    color: "from-cyan-500 to-sky-500" },
  musteri:       { icon: Users,      color: "from-amber-500 to-orange-500" },
  tedarukcu:     { icon: Truck,      color: "from-yellow-500 to-amber-500" },
  satis_sifaris: { icon: ShoppingCart, color: "from-indigo-500 to-violet-500" },
  alis_sifaris:  { icon: Truck,      color: "from-orange-500 to-red-500" },
  qaytarma:      { icon: RotateCcw,  color: "from-rose-500 to-pink-500" },
  servis:        { icon: Wrench,     color: "from-rose-500 to-red-500" },
  anbar:         { icon: Warehouse,  color: "from-cyan-500 to-blue-500" },
  isci:          { icon: Briefcase,  color: "from-blue-500 to-indigo-500" },
  filial:        { icon: Building2,  color: "from-teal-500 to-emerald-500" },
  marketplace:   { icon: Globe,      color: "from-lime-500 to-green-500" },
  xeberdarliq:   { icon: Radar,      color: "from-amber-500 to-rose-500" },
  tesdiq:        { icon: ShieldCheck, color: "from-emerald-500 to-teal-500" },
  qaime:         { icon: FileText,   color: "from-violet-500 to-purple-500" },
  odenis:        { icon: Wallet,     color: "from-emerald-500 to-cyan-500" },
  diger:         { icon: Tag,        color: "from-slate-500 to-zinc-500" },
};

async function getRecentByModule(obyekt_nov: string, limit = 5) {
  return withTenant(async () => {
    const links = await prisma.tapshiriq_obyektleri.findMany({
      where: { obyekt_nov },
      orderBy: { yaradildi: "desc" },
      take: limit,
      include: {
        tapshiriqlar: {
          select: { id: true, basliq: true, status: true, prioritet: true, deadline: true },
        },
      },
    });
    return links.map((l) => ({
      task_id: l.tapshiriqlar.id,
      basliq: l.tapshiriqlar.basliq,
      status: l.tapshiriqlar.status ?? "yeni",
      prioritet: l.tapshiriqlar.prioritet ?? "normal",
      deadline: l.tapshiriqlar.deadline,
      obyekt_basliq: l.obyekt_basliq,
    }));
  });
}

const STATUS_DOT: Record<string, string> = {
  yeni: "bg-amber-500",
  icrada: "bg-sky-500",
  gozlemede: "bg-violet-500",
  tamamlandi: "bg-emerald-500",
  legv: "bg-muted-foreground/40",
};

export default async function ModulBaglantiPage() {
  const counts = await getModuleTaskCounts();

  // Fetch recent tasks for each module (top 5 each, parallel)
  const recents = await Promise.all(
    counts.map(async (c) => ({
      obyekt_nov: c.obyekt_nov,
      items: await getRecentByModule(c.obyekt_nov, 5),
    }))
  );
  const recentsMap = new Map(recents.map((r) => [r.obyekt_nov, r.items]));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-primary to-cyan-500">
          <Link2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modul bağlantı</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tapşırıqlar onlara bağlı obyektlər üzrə (məhsul, müştəri, satış…) qruplaşdırılıb.
          </p>
        </div>
      </header>

      <TaskSectionTabs current="baglanti" />

      {counts.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-16 text-center">
            <Link2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <h3 className="font-semibold">Bağlı tapşırıq yoxdur</h3>
            <p className="mt-1 max-w-md mx-auto text-sm text-muted-foreground">
              Modul səhifələrindən (məhsul, müştəri, satış, vəs.) tapşırıq yaratdıqda burada görünəcək.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {counts.map((c) => {
            const meta = MODULE_META[c.obyekt_nov] ?? MODULE_META.diger;
            const Icon = meta.icon;
            const label = (LINKABLE_MODULES as Record<string, string>)[c.obyekt_nov] ?? c.obyekt_nov;
            const items = recentsMap.get(c.obyekt_nov) ?? [];
            return (
              <Card key={c.obyekt_nov} className="glass relative overflow-hidden">
                <div className={cn("pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-15 blur-2xl", meta.color)} />
                <CardContent className="relative space-y-3 py-4">
                  <header className="flex items-center gap-2.5">
                    <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow-md", meta.color)}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold">{label}</h3>
                      <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
                        <span><strong className="text-foreground">{c.total}</strong> cəm</span>
                        <span>· <strong className="text-amber-500">{c.open}</strong> açıq</span>
                        {c.overdue > 0 && <span>· <strong className="text-rose-500">{c.overdue}</strong> gecikmiş</span>}
                      </div>
                    </div>
                  </header>

                  <ul className="space-y-1 border-t border-border/30 pt-2">
                    {items.length === 0 ? (
                      <li className="text-[11px] text-muted-foreground">—</li>
                    ) : (
                      items.map((t) => (
                        <li key={t.task_id}>
                          <Link href={`/tapshiriqlar/${t.task_id}`} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-secondary/30">
                            <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[t.status] ?? "bg-muted")} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{t.basliq}</div>
                              {t.obyekt_basliq && <div className="truncate text-[10px] text-muted-foreground">→ {t.obyekt_basliq}</div>}
                            </div>
                            {t.deadline && (
                              <Badge variant="outline" className="shrink-0 text-[9px]">
                                {formatDate(t.deadline, { day: "2-digit", month: "short" })}
                              </Badge>
                            )}
                          </Link>
                        </li>
                      ))
                    )}
                  </ul>

                  {c.total > items.length && (
                    <Link
                      href={`/tapshiriqlar?obyekt_nov=${c.obyekt_nov}`}
                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-primary hover:underline"
                    >
                      Hamısına bax ({c.total}) <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
