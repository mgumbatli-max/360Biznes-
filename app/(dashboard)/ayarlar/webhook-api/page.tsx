import type { Metadata } from "next";
import Link from "next/link";
import { Plug, Webhook, ArrowRight, Activity, AlertCircle } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsTopNav } from "@/features/ayar/components/settings-top-nav";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { ApiKeysPanel, type ApiKeyRow } from "@/features/ayarlar/components/api-keys-panel";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Webhook və API" };
export const dynamic = "force-dynamic";

async function getData() {
  return withTenant(async () => {
    const [keys, webhooks, apiCalls24h, webhookCalls24h] = await Promise.all([
      prisma.api_keys.findMany({
        orderBy: [{ aktiv: "desc" }, { yaradildi: "desc" }],
        select: {
          id: true,
          ad: true,
          key_prefix: true,
          scopes: true,
          aktiv: true,
          rate_limit_qm: true,
          istifade_sayi: true,
          son_istifade: true,
          son_ip: true,
          bitme: true,
          yaradildi: true,
        },
      }),
      prisma.webhook_endpoints.findMany({
        orderBy: [{ aktiv: "desc" }, { yaradildi: "desc" }],
        select: {
          id: true,
          ad: true,
          url: true,
          aktiv: true,
          events: true,
          cagiris_sayi: true,
          ugurlu_sayi: true,
          son_ugur: true,
          son_u_ursuz: true,
          son_xeta: true,
        },
      }),
      prisma.api_call_log
        .count({ where: { yaradildi: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
        .catch(() => 0),
      prisma.webhook_delivery
        .count({ where: { yaradildi: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
        .catch(() => 0),
    ]);

    const apiKeyRows: ApiKeyRow[] = keys.map((k) => ({
      id: k.id,
      ad: k.ad,
      key_prefix: k.key_prefix,
      scopes: k.scopes,
      aktiv: k.aktiv,
      rate_limit_qm: k.rate_limit_qm,
      istifade_sayi: k.istifade_sayi,
      son_istifade: k.son_istifade,
      son_ip: k.son_ip,
      bitme: k.bitme,
      yaradildi: k.yaradildi,
    }));

    return { apiKeyRows, webhooks, apiCalls24h, webhookCalls24h };
  });
}

export default async function Page() {
  const { apiKeyRows, webhooks, apiCalls24h, webhookCalls24h } = await getData();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <BackButton fallback="/ayarlar" label="Tənzimləmələr" />

      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/15 text-sky-600">
          <Plug className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tənzimləmələr</div>
          <h1 className="text-2xl font-bold tracking-tight">Webhook və API</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            3rd-party tətbiqlər üçün API açarları və event-driven webhook endpoint-lər.
          </p>
        </div>
      </header>

      <SettingsTopNav />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Aktiv açar" value={apiKeyRows.filter((k) => k.aktiv).length} icon={Plug} tone="primary" />
        <Stat label="API çağırış (24s)" value={apiCalls24h} icon={Activity} />
        <Stat label="Aktiv webhook" value={webhooks.filter((w) => w.aktiv).length} icon={Webhook} tone="info" />
        <Stat label="Webhook (24s)" value={webhookCalls24h} icon={Activity} />
      </div>

      <ApiKeysPanel items={apiKeyRows} />

      <Card className="glass">
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Webhook className="h-4 w-4 text-sky-500" /> Webhook endpoint-lər ({webhooks.length})
              </div>
              <div className="text-xs text-muted-foreground">
                Event-driven kənar URL-lərə real-time bildiriş
              </div>
            </div>
            <Link
              href="/webhook"
              className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
            >
              Webhook idarəsi <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {webhooks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <Webhook className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <div className="mt-2 text-sm text-muted-foreground">Heç bir webhook yoxdur</div>
              <Link
                href="/webhook"
                className="mt-3 inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-secondary"
              >
                İlk webhook yarat
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {webhooks.map((w) => (
                <div key={w.id} className="flex items-center gap-3 rounded-md border border-border/30 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{w.ad}</span>
                      {w.aktiv ? (
                        <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-600">aktiv</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">passiv</Badge>
                      )}
                      {w.events.length > 0 && (
                        <Badge variant="outline" className="text-[10px]">{w.events.length} event</Badge>
                      )}
                    </div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">{w.url}</div>
                    {w.son_xeta && (
                      <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-rose-500">
                        <AlertCircle className="h-3 w-3" /> {w.son_xeta.slice(0, 80)}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    <div className="font-mono tabular-nums">
                      {w.ugurlu_sayi}/{w.cagiris_sayi}
                    </div>
                    <div className="text-[10px]">uğurlu/cəm</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="space-y-2 py-4">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Sənədlər</div>
          <Link href="/api/v1/marketplace/products" className="block text-sm text-violet-600 hover:underline">
            GET /api/v1/marketplace/products — məhsulları çək
          </Link>
          <p className="text-xs text-muted-foreground">
            Authorization header: <code className="rounded bg-secondary px-1 font-mono text-[11px]">Bearer bk_...</code>
          </p>
          <Link href="/webhook" className="block text-sm text-violet-600 hover:underline">
            Webhook event kataloqu →
          </Link>
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
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "info";
}) {
  return (
    <Card className="glass">
      <CardContent className="py-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3 w-3" /> {label}
        </div>
        <div className={`mt-0.5 text-2xl font-bold tabular-nums ${
          tone === "primary" ? "text-violet-600" :
          tone === "info" ? "text-sky-600" :
          "text-foreground"
        }`}>
          {formatNumber(value)}
        </div>
      </CardContent>
    </Card>
  );
}
