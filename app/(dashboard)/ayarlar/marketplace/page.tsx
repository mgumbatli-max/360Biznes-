import type { Metadata } from "next";
import Link from "next/link";
import { Store, ArrowRight, Percent, ShoppingCart } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsTopNav } from "@/features/ayar/components/settings-top-nav";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export const metadata: Metadata = { title: "Marketplace inteqrasiyalar" };
export const dynamic = "force-dynamic";

async function getData() {
  return withTenant(async () => {
    const [accounts, commissions, orders24h] = await Promise.all([
      prisma.marketplace_hesablari.findMany({
        select: { id: true, platform: true, ad: true, status: true, son_sync: true },
        orderBy: { yaradildi: "desc" },
      }),
      prisma.marketplace_komisyon.findMany({
        select: { id: true, platform: true, faiz: true, kateqoriya_id: true },
      }).catch(() => []),
      prisma.marketplace_sifarisleri
        .count({ where: { yaradildi: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
        .catch(() => 0),
    ]);
    return { accounts, commissions, orders24h };
  });
}

const PLATFORMS = [
  { key: "wolt", label: "Wolt" },
  { key: "tap_az", label: "Tap.az" },
  { key: "birmarket", label: "Birmarket" },
  { key: "lalafo", label: "Lalafo" },
  { key: "umico", label: "Umico" },
  { key: "yango_deli", label: "Yango Deli" },
  { key: "bolt_food", label: "Bolt Food" },
  { key: "instagram", label: "Instagram Shop" },
];

export default async function Page() {
  const { accounts, commissions, orders24h } = await getData();
  const activeAccounts = accounts.filter((a) => a.status === "aktiv").length;
  const connectedPlatforms = new Set(accounts.map((a) => a.platform));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <BackButton fallback="/ayarlar" label="Tənzimləmələr" />

      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500/15 text-orange-600">
          <Store className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tənzimləmələr</div>
          <h1 className="text-2xl font-bold tracking-tight">Marketplace inteqrasiyalar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wolt, Tap.az, Birmarket, Umico və digər platformalarla qoşulma və komisyon idarəsi.
          </p>
        </div>
      </header>

      <SettingsTopNav />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Cəmi hesab" value={accounts.length} />
        <Stat label="Aktiv hesab" value={activeAccounts} tone="emerald" />
        <Stat label="Komisyon qaydası" value={commissions.length} tone="amber" />
        <Stat label="Sifariş (24s)" value={orders24h} icon={ShoppingCart} tone="sky" />
      </div>

      <Card className="glass">
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Mövcud qoşulmalar</div>
            <Link
              href="/marketplace"
              className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
            >
              Marketplace mərkəzi <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {accounts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <Store className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <div className="mt-2 text-sm text-muted-foreground">Hələ heç bir marketplace qoşulması yoxdur</div>
              <Link
                href="/marketplace/hesab/yeni"
                className="mt-3 inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-secondary"
              >
                İlk qoşulmanı əlavə et
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-md border border-border/30 px-3 py-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{a.ad}</span>
                      <Badge variant="outline" className="text-[10px]">{a.platform}</Badge>
                      {a.status === "aktiv" ? (
                        <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-600">aktiv</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">{a.status}</Badge>
                      )}
                    </div>
                    {a.son_sync && (
                      <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                        Son sync: {new Date(a.son_sync).toLocaleString("az-AZ", { dateStyle: "short", timeStyle: "short" })}
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/marketplace/hesab/${a.id}`}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-secondary"
                  >
                    Detal <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Percent className="h-4 w-4 text-amber-500" />
              Platforma komisyonu
            </div>
            <Link
              href="/ayarlar/mp-komisyon"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-secondary"
            >
              İdarə et <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="text-xs text-muted-foreground">
            Hər platforma və kateqoriya üçün komisyon faizini təyin et — net qazanc hesablanması düzgün olsun.
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="space-y-2 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Dəstəklənən platformalar
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {PLATFORMS.map((p) => {
              const connected = connectedPlatforms.has(p.key);
              return (
                <div
                  key={p.key}
                  className={`rounded-md border px-2 py-1.5 text-center text-xs ${
                    connected
                      ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-600"
                      : "border-border/40 text-muted-foreground"
                  }`}
                >
                  {p.label}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "emerald" | "amber" | "sky";
}) {
  return (
    <Card className="glass">
      <CardContent className="py-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {Icon && <Icon className="h-3 w-3" />}
          {label}
        </div>
        <div
          className={`mt-0.5 text-2xl font-bold tabular-nums ${
            tone === "emerald" ? "text-emerald-600" :
            tone === "amber" ? "text-amber-600" :
            tone === "sky" ? "text-sky-600" :
            "text-foreground"
          }`}
        >
          {value.toLocaleString("az-AZ")}
        </div>
      </CardContent>
    </Card>
  );
}
