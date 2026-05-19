"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
  Star,
  AlertTriangle,
  ShoppingCart,
  TrendingUp,
  Wallet,
  Calendar,
  ExternalLink,
  Plus,
  Loader2,
  Receipt,
  Ban,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatMoney, formatDate } from "@/lib/utils";
import { getCustomerDrawer, type CustomerDrawerData } from "../drawer-actions";

type Props = {
  customerId: string;
  children: ReactNode;
};

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  yeni:        { label: "Yeni",        tone: "border-info/30 bg-info/10 text-info" },
  tesdiq:      { label: "Təsdiq",      tone: "border-warning/30 bg-warning/10 text-warning" },
  tamamlandi:  { label: "Tamamlandı",  tone: "border-success/30 bg-success/10 text-success" },
  legv:        { label: "Ləğv",        tone: "border-danger/30 bg-danger/10 text-danger" },
};

const ODENIS_LABEL: Record<string, string> = {
  negd:        "Nağd",
  kart:        "Kart",
  bank:        "Köçürmə",
  nisye:       "Nisyə",
  kredit:      "Kredit",
  kredit_qeyd: "Kredit",
  qarisiq:     "Qarışıq",
};

export function CustomerDrawer({ customerId, children }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CustomerDrawerData | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open && !data) {
      startTransition(async () => {
        const result = await getCustomerDrawer(customerId);
        setData(result);
      });
    }
  }, [open, data, customerId]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-lg">
        {pending || !data ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data.ok ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-danger">
            {data.error}
          </div>
        ) : (
          <DrawerBody data={data} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ data }: { data: Extract<CustomerDrawerData, { ok: true }> }) {
  const { kontragent: k, kpis, recent_sales, active_credits } = data;
  const initials = k.ad
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isVip = k.qiymet_tipi === "vip";
  const isRisk = k.risk_seviyye === "yuksek" || (active_credits.overdue_count > 0);
  const isBlacklist = k.qara_siyahi === true;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <SheetHeader className="border-b border-border/60 bg-card/30 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/15 text-base font-bold text-primary-light">
            {initials || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-lg leading-tight">{k.ad}</SheetTitle>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {k.nov === "techizatci" && (
                <Badge variant="outline" className="border-info/30 bg-info/10 text-info text-[10px]">Təchizatçı</Badge>
              )}
              {k.nov === "her_ikisi" && (
                <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning text-[10px]">Hər ikisi</Badge>
              )}
              {(k.nov === "musteri" || !k.nov) && (
                <Badge variant="outline" className="border-border text-[10px]">Müştəri</Badge>
              )}
              {isVip && (
                <Badge variant="outline" className="border-warning/40 bg-warning/15 text-warning text-[10px]">
                  <Star className="mr-0.5 h-2.5 w-2.5 fill-current" /> VIP
                </Badge>
              )}
              {isBlacklist && (
                <Badge variant="outline" className="border-danger/40 bg-danger/15 text-danger text-[10px]">
                  <Ban className="mr-0.5 h-2.5 w-2.5" /> Qara siyahı
                </Badge>
              )}
              {isRisk && !isBlacklist && (
                <Badge variant="outline" className="border-danger/30 bg-danger/10 text-danger text-[10px]">
                  <AlertTriangle className="mr-0.5 h-2.5 w-2.5" /> Risk
                </Badge>
              )}
              {!k.aktiv && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">Passiv</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Contact */}
        {(k.telefon || k.email || k.sheher) && (
          <div className="mt-3 grid grid-cols-1 gap-1.5 text-xs">
            {k.telefon && (
              <a href={`tel:${k.telefon}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate font-mono">{k.telefon}</span>
              </a>
            )}
            {k.email && (
              <a href={`mailto:${k.email}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{k.email}</span>
              </a>
            )}
            {k.sheher && (
              <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{k.sheher}</span>
              </div>
            )}
          </div>
        )}
      </SheetHeader>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 border-b border-border/60 p-3">
        <Kpi
          label="Cəmi alıb"
          value={formatMoney(kpis.sales_total)}
          sub={`${kpis.sales_count} sifariş`}
          icon={ShoppingCart}
          tone="success"
        />
        <Kpi
          label="Borc"
          value={formatMoney(kpis.borc)}
          sub={kpis.borc > 0 ? "ödənilməyib" : "borcsuz"}
          icon={Wallet}
          tone={kpis.borc > 0 ? "danger" : "neutral"}
        />
        <Kpi
          label="Orta çek"
          value={formatMoney(kpis.avg_check)}
          sub={kpis.last_sale_date ? `son: ${formatDate(kpis.last_sale_date, { day: "2-digit", month: "short" })}` : "—"}
          icon={TrendingUp}
          tone="neutral"
        />
      </div>

      {/* Active credits */}
      {active_credits.count > 0 && (
        <div className="border-b border-border/60 p-3">
          <Link
            href={`/ticaret/kredit?q=${encodeURIComponent(k.ad)}`}
            className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 transition hover:bg-warning/10"
          >
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-warning/15 text-warning">
                <Receipt className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold">
                  Aktiv kredit: {active_credits.count}
                  {active_credits.overdue_count > 0 && (
                    <span className="ml-1.5 text-danger">({active_credits.overdue_count} gecikmiş)</span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Qalıq borc: <span className="font-semibold text-foreground tabular-nums">{formatMoney(active_credits.total_borc)}</span>
                </div>
              </div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </div>
      )}

      {/* Recent sales */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Son satışlar</h3>
          <Link
            href={`/elaqe/musteriler/${k.id}`}
            className="inline-flex items-center gap-1 text-[11px] text-primary-light hover:underline"
          >
            Hamısı <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {recent_sales.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            Heç bir satış yoxdur
          </div>
        ) : (
          <ul className="space-y-1.5">
            {recent_sales.map((s) => {
              const qaliq = s.son_mebleg - s.odenilmis;
              const status = STATUS_LABEL[s.status] ?? { label: s.status, tone: "border-border" };
              return (
                <li key={s.id}>
                  <Link
                    href={`/ticaret/satis-yeni?edit=${s.id}`}
                    className="flex items-center gap-2 rounded-md border border-border/40 bg-card/50 p-2 transition hover:border-primary/30 hover:bg-card"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-semibold">{s.nomre}</span>
                        <Badge variant="outline" className={cn("text-[9px]", status.tone)}>
                          {status.label}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                        <Calendar className="h-2.5 w-2.5" />
                        {formatDate(s.tarix, { day: "2-digit", month: "short", year: "numeric" })}
                        <span>·</span>
                        <span>{s.satir_say} sətir</span>
                        <span>·</span>
                        <span>{ODENIS_LABEL[s.odenis_nov] ?? s.odenis_nov}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums">{formatMoney(s.son_mebleg)}</div>
                      {qaliq > 0 && (
                        <div className="text-[10px] tabular-nums text-danger">borc {formatMoney(qaliq)}</div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 border-t border-border/60 bg-card/30 p-3">
        <Button asChild size="sm" className="flex-1">
          <Link href={`/ticaret/satis-yeni?musteri=${k.id}`}>
            <Plus className="h-3.5 w-3.5" /> Yeni satış
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/elaqe/musteriler/${k.id}`}>
            Tam profil <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof ShoppingCart;
  tone: "success" | "danger" | "neutral";
}) {
  const valueCls =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 p-2">
      <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
        <Icon className="h-2.5 w-2.5" /> {label}
      </div>
      <div className={cn("mt-1 text-sm font-bold leading-tight tabular-nums", valueCls)}>{value}</div>
      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
