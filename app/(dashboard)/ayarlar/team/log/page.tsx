import type { Metadata } from "next";
import Link from "next/link";
import {
  History,
  Trash2,
  Sparkles,
  Lock,
  ShieldAlert,
  AlertTriangle,
  Hash,
  MessageCircle,
  Building2,
  Search,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SettingsTopNav } from "@/features/ayar/components/settings-top-nav";
import { getMessageLog, getMessageLogStats } from "@/features/team/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Team mesaj logu" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  search?: string;
  novu?: string;
  from?: string;
  to?: string;
}>;

const EVENTS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  created: { label: "Yaradıldı", icon: Sparkles, cls: "text-emerald-600 border-emerald-500/40" },
  deleted: { label: "Silindi", icon: Trash2, cls: "text-rose-500 border-rose-500/40" },
  self_destruct: { label: "Bir dəfəlik silindi", icon: AlertTriangle, cls: "text-amber-500 border-amber-500/40" },
  unlocked: { label: "Kilid açıldı", icon: Lock, cls: "text-primary border-primary/40" },
  unlock_failed: { label: "Şifrə yanlış", icon: ShieldAlert, cls: "text-rose-500 border-rose-500/40" },
};

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("az-AZ", { dateStyle: "short", timeStyle: "medium" }).format(d);
}

export default async function TeamMessageLogPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filter = {
    search: sp.search,
    novu: sp.novu,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to + "T23:59:59") : undefined,
  };
  const [logs, stats] = await Promise.all([getMessageLog(filter, 500), getMessageLogStats()]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <BackButton fallback="/ayarlar/team" label="Team ayarları" />

      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team mesaj logu</h1>
          <p className="text-sm text-muted-foreground">
            Bütün mesaj əməliyyatları izlənilir — silinmiş və bir dəfəlik mesajlar belə burada qalır
          </p>
        </div>
      </header>

      <SettingsTopNav />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Cəmi qeyd" value={stats.total} />
        <Stat label="Yaradılan" value={stats.created} tone="primary" />
        <Stat label="Silinmiş" value={stats.deleted} tone="rose" />
        <Stat label="Bir dəfəlik" value={stats.selfDestruct} tone="amber" />
        <Stat label="Kilid açıldı" value={stats.unlocked} />
      </div>

      <Card className="glass border-amber-500/30">
        <CardContent className="py-3">
          <div className="flex items-start gap-2 text-xs">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-muted-foreground">
              <strong className="text-foreground">Audit qeydi:</strong> bu səhifə yalnız sahibkar tərəfindən görünür.
              Mesaj silinsə də və ya bir dəfəlik oxunub yox olsa belə tam mətni burada qorunur.
              Şifrə yanlış girişlər, kilid açmalar — hamısı izlənir.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="py-2">
          <form className="flex flex-wrap items-end gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input name="search" defaultValue={sp.search ?? ""} placeholder="Mətn axtar..." className="h-9 pl-8" />
            </div>
            <select
              name="novu"
              defaultValue={sp.novu ?? ""}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Bütün hadisələr</option>
              <option value="created">Yaradıldı</option>
              <option value="deleted">Silindi</option>
              <option value="self_destruct">Bir dəfəlik silindi</option>
              <option value="unlocked">Kilid açıldı</option>
              <option value="unlock_failed">Şifrə yanlış</option>
            </select>
            <Input name="from" type="date" defaultValue={sp.from ?? ""} className="h-9 w-[140px]" />
            <Input name="to" type="date" defaultValue={sp.to ?? ""} className="h-9 w-[140px]" />
            <button
              type="submit"
              className="h-9 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              Süz
            </button>
            <Link
              href="/ayarlar/team/log"
              className="h-9 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/70"
            >
              Sıfırla
            </Link>
          </form>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Qeydlər ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">
              Heç bir mesaj logu tapılmadı
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/40 text-left">
                    <th className="px-3 py-2">Vaxt</th>
                    <th className="px-3 py-2">Hadisə</th>
                    <th className="px-3 py-2">Kanal</th>
                    <th className="px-3 py-2">Göndərən</th>
                    <th className="px-3 py-2">Əməliyyat edən</th>
                    <th className="px-3 py-2">Mətn</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => {
                    const ev = EVENTS[l.novu] ?? { label: l.novu, icon: History, cls: "" };
                    const Icon = ev.icon;
                    const KanalIcon =
                      l.kanal.novu === "direct" ? MessageCircle : l.kanal.novu === "filial" ? Building2 : Hash;
                    return (
                      <tr key={l.id} className="border-b border-border/20">
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(l.yaradildi)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={cn("gap-1 text-[10px]", ev.cls)}>
                            <Icon className="h-3 w-3" />
                            {ev.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className="inline-flex items-center gap-1">
                            <KanalIcon className="h-3 w-3 text-muted-foreground" />
                            {l.kanal.ad}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {l.gonderici?.ad_soyad ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {l.event_user?.ad_soyad ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="max-w-md px-3 py-2 text-xs">
                          <div className="line-clamp-2 whitespace-pre-wrap break-words">{l.mesaj_metni}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "primary" | "rose" | "amber";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "rose"
      ? "text-rose-500"
      : tone === "amber"
      ? "text-amber-500"
      : "text-foreground";
  return (
    <div className="glass rounded-xl border border-border/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
