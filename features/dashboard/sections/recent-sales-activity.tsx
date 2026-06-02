import Link from "next/link";
import {
  ArrowRight,
  ShoppingCart,
  CircleDollarSign,
  Bell,
  Wrench,
  Activity,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatMoney, formatRelativeTime, initialsFromName } from "@/lib/utils";
import { getRecentSales, getRecentActivity } from "@/features/dashboard/queries";

type ActivityStyle = { icon: LucideIcon; bg: string; fg: string };
const ACTIVITY_STYLE: Record<string, ActivityStyle> = {
  satis:     { icon: ShoppingCart,     bg: "bg-emerald-500/10", fg: "text-emerald-500" },
  kassa:     { icon: CircleDollarSign, bg: "bg-sky-500/10",     fg: "text-sky-500" },
  xeberdar:  { icon: Bell,             bg: "bg-amber-500/10",   fg: "text-amber-500" },
  servis:    { icon: Wrench,           bg: "bg-violet-500/10",  fg: "text-violet-500" },
  _default:  { icon: Activity,         bg: "bg-secondary",      fg: "text-muted-foreground" },
};

function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "tamamlandi": return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "yeni":       return "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400";
    case "icrada":     return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "legv":       return "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400";
    case "qaralama":   return "border-slate-400/40 bg-slate-500/10 text-slate-500 dark:text-slate-400";
    default:           return "border-border bg-secondary/40 text-muted-foreground";
  }
}

/** Avatar fallback rəng dəyişikliyi — ad-dan deterministic hash */
function avatarTint(seed: string | null | undefined): string {
  if (!seed) return "from-slate-500 to-slate-600";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const tints = [
    "from-emerald-500 to-teal-600",
    "from-sky-500 to-blue-600",
    "from-violet-500 to-purple-600",
    "from-pink-500 to-rose-600",
    "from-amber-500 to-orange-600",
    "from-cyan-500 to-blue-500",
    "from-fuchsia-500 to-purple-600",
  ];
  return tints[Math.abs(h) % tints.length];
}

export async function RecentSalesActivity() {
  const [recentSales, recentActivity] = await Promise.all([
    getRecentSales(5),
    getRecentActivity(15),
  ]);

  // Toplam satış məbləği — kart başlığında zəmin info üçün
  const cemiMebleg = recentSales.reduce((s, x) => s + Number(x.son_mebleg ?? 0), 0);

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="glass lg:col-span-2">
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Son 5 satış</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Cəmi:&nbsp;
              <span className="font-semibold tabular-nums text-foreground">{formatMoney(cemiMebleg)}</span>
            </p>
          </div>
          <Link href="/ticaret/satislar" className="inline-flex items-center gap-1 text-xs font-medium text-primary-light hover:underline">
            Hamısı <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Hələ satış yoxdur.</p>
              <Link href="/ticaret/satis-yeni" className="mt-1 text-[11px] font-medium text-primary-light hover:underline">
                İlk satışı yarat →
              </Link>
            </div>
          ) : (
            <ul className="-my-1.5 divide-y divide-border/40">
              {recentSales.map((s) => {
                const tint = avatarTint(s.musteri_ad);
                const initials = initialsFromName(s.musteri_ad);
                return (
                  <li key={s.id}>
                    <Link
                      href={`/ticaret/satislar/${s.id}`}
                      className="group flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-secondary/40"
                    >
                      <div className={cn("grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white shadow-sm", tint)}>
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{s.musteri_ad || "Naməlum müştəri"}</span>
                          <Badge variant="outline" className={cn("h-4 px-1.5 text-[9.5px]", statusBadgeClass(s.status))}>
                            {s.status || "—"}
                          </Badge>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="font-mono">{s.nomre}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="inline-flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {formatRelativeTime(s.tarix)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold tabular-nums text-foreground group-hover:text-primary-light">
                          {formatMoney(s.son_mebleg)}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Canlı hadisələr
          </CardTitle>
          <Link href="/audit-log" className="inline-flex items-center gap-1 text-xs font-medium text-primary-light hover:underline">
            Audit <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Hələ hadisə yoxdur.</div>
          ) : (
            <ul className="relative space-y-2.5">
              {/* Vertikal timeline xətti */}
              <span aria-hidden className="absolute left-[14px] top-1 bottom-1 w-px bg-border/60" />
              {recentActivity.map((e) => {
                const style = ACTIVITY_STYLE[e.tip] ?? ACTIVITY_STYLE._default;
                const Icon = style.icon;
                return (
                  <li key={e.id} className="relative flex items-start gap-2.5 text-xs">
                    <div className={cn("relative z-10 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full ring-2 ring-background", style.bg, style.fg)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="truncate text-foreground">{e.basliq}</div>
                      <div className="text-muted-foreground">
                        {formatRelativeTime(e.tarix)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
