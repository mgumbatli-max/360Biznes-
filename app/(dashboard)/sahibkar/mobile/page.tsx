import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList, StickyNote, Building2, FileText, Camera, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerHubSnapshot } from "@/features/sahibkar/owner-queries";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Sahibkar (mobil)" };
export const dynamic = "force-dynamic";

export default async function MobileOwnerPage() {
  await requireSahibkarSession();
  const hub = await getOwnerHubSnapshot();

  return (
    <div className="mx-auto max-w-md space-y-4">
      <header className="space-y-1">
        <p className="text-xs text-muted-foreground">Bu gün biznesim</p>
        <h1 className="text-3xl font-bold tracking-tight">{formatMoney(hub.today_revenue)}</h1>
        <p className="text-xs text-muted-foreground">{hub.today_orders} sifariş · Ortalama {formatMoney(hub.avg_ticket)}</p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <BigStat label="Kassa" value={formatMoney(hub.today_cash)} />
        <BigStat label="Yeni müştəri" value={formatNumber(hub.today_new_customers)} />
        <BigStat label="Açıq tapşırıq" value={formatNumber(hub.open_tasks)} />
        <BigStat label="Aktiv işçi" value={formatNumber(hub.active_isci)} />
      </div>

      <div className="space-y-2">
        <MobileLink href="/sahibkar/tapshiriq" icon={ClipboardList} title="Tapşırıqlar" />
        <MobileLink href="/sahibkar/not" icon={StickyNote} title="Qeydlər" />
        <MobileLink href="/sahibkar/filiallar" icon={Building2} title="Filiallar" />
        <MobileLink href="/sahibkar/snapshot" icon={Camera} title="Snapshot" />
        <MobileLink href="/sahibkar/hesabat" icon={FileText} title="Hesabat" />
        <MobileLink href="/sahibkar/data-saglamligi" icon={Activity} title="Data sağlamlığı" />
      </div>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="glass">
      <CardContent className="space-y-1 py-4">
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function MobileLink({ href, icon: Icon, title }: { href: string; icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <Link href={href}>
      <Card className="glass transition active:scale-[0.98]">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-secondary">
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">{title}</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
