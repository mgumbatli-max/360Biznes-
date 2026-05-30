import type { Metadata } from "next";
import Link from "next/link";
import {
  Plug, CheckCircle2, AlertTriangle, Activity, Zap, Send, ArrowRight,
  Lightbulb, ShieldCheck, RefreshCw, Code, Webhook, Info, ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { WebhookDialog } from "@/features/webhook/components/webhook-dialog";
import { WebhookRow } from "@/features/webhook/components/webhook-row";
import { getWebhooks, getWebhookStats, getRecentDeliveries } from "@/features/webhook/queries";
import { WEBHOOK_PRESETS, WEBHOOK_EVENTS } from "@/features/webhook/catalog";
import { formatDate, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Webhook — Avtomatik bildirişlər" };

type SearchParams = { event?: string; aktiv?: string };

export default async function WebhookPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const aktiv = sp.aktiv === "1" ? true : sp.aktiv === "0" ? false : undefined;

  const [rows, stats, deliveries] = await Promise.all([
    getWebhooks({ event: sp.event, aktiv }),
    getWebhookStats(),
    getRecentDeliveries(15),
  ]);

  const hasWebhooks = rows.length > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Hero with explanation */}
      <header className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-violet-500/5 p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-primary to-violet-500 opacity-10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet-500 shadow-lg shadow-primary/20">
              <Webhook className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Webhook Mərkəzi</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Sistemdə hadisə baş verəndə avtomatik kənar serverə bildiriş göndər — Slack, Telegram, Zapier və ya öz API-niz.
              </p>
            </div>
          </div>
          <WebhookDialog />
        </div>

        {/* What is webhook + how it works */}
        <div className="relative mt-4 rounded-xl border border-border/40 bg-background/40 p-4">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <h3 className="text-sm font-bold">Webhook nədir və niyə lazımdır?</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Webhook</strong> sistemin başqa proqramları &ldquo;çağıran telefon zəngi&rdquo;dir.
                ERP-də hadisə baş verəndə (məs. satış, qaytarma, stok bitməsi),
                <strong className="text-foreground"> avtomatik olaraq başqa servisə bildiriş gedir</strong>.
                İstifadəçi heç nə etməyə ehtiyac duymur — proses arxa planda baş verir.
              </p>
            </div>
          </div>

          {/* 3-step flow */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <FlowStep
              num={1}
              icon={Zap}
              title="Hadisə baş verir"
              desc="ERP-də satış, qaytarma, stok bitməsi və s. baş verir"
              color="from-amber-500 to-orange-500"
            />
            <FlowStep
              num={2}
              icon={Send}
              title="Sistem POST göndərir"
              desc="HTTPS POST sorğu sizin endpoint-ə avtomatik göndərilir (HMAC imzalı)"
              color="from-primary to-violet-500"
            />
            <FlowStep
              num={3}
              icon={CheckCircle2}
              title="Kənar sistem reaksiya verir"
              desc="Slack mesajı, Google Sheets sətri, CRM yeniləmə — hər nə istəsəniz"
              color="from-emerald-500 to-teal-500"
            />
          </div>
        </div>

        {/* Distinction from other systems */}
        <div className="relative mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Info className="h-3.5 w-3.5 shrink-0 text-sky-500" />
          <span className="text-muted-foreground">
            <strong className="text-foreground">Fərq</strong>: Daxili bildirişlər üçün
          </span>
          <Link href="/nezaret-merkezi" className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
            Nəzarət Mərkəzi
          </Link>
          <span className="text-muted-foreground">var. Webhook <strong className="text-foreground">kənar sistemlərlə</strong> əlaqə üçündür.</span>
        </div>
      </header>

      {/* Use case gallery — only show if empty (educational) */}
      {!hasWebhooks && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Populyar istifadə nümunələri
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {WEBHOOK_PRESETS.map((p) => {
              const Icon = p.icon;
              return (
                <Card key={p.id} className="glass relative overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/40">
                  <div className={cn("pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-15 blur-2xl", p.color)} />
                  <CardContent className="relative space-y-2 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow", p.color)}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold">{p.ad}</h3>
                        <p className="text-[10.5px] text-muted-foreground">{p.desc}</p>
                      </div>
                    </div>
                    {p.recommended_events.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {p.recommended_events.map((e) => (
                          <Badge key={e} variant="outline" className="text-[9px] font-mono">{e}</Badge>
                        ))}
                      </div>
                    )}
                    {p.setup_url && (
                      <Link
                        href={p.setup_url}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-primary hover:underline"
                      >
                        Necə qurulur
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Plug} label="Cəm endpoint" value={String(stats.total)} subline={`${stats.aktiv} aktiv`} />
        <KpiCard icon={CheckCircle2} label="Aktiv" value={String(stats.aktiv)} subline={`${stats.passiv} passiv`} tone="success" />
        <KpiCard icon={Activity} label="Son 24 saat" value={String(stats.last24)} subline="Trigger" />
        <KpiCard
          icon={AlertTriangle}
          label="Uğursuz (24s)"
          value={String(stats.fail24)}
          subline="HTTP ≥ 400"
          tone={stats.fail24 > 0 ? "danger" : "neutral"}
        />
      </section>

      {/* Filter */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 p-2">
        <input
          name="event"
          defaultValue={sp.event ?? ""}
          placeholder="Hadisə filtri (məs: sale.created)"
          className="h-9 flex-1 min-w-[180px] max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        />
        <select
          name="aktiv"
          defaultValue={sp.aktiv ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Hamısı</option>
          <option value="1">Yalnız aktiv</option>
          <option value="0">Yalnız passiv</option>
        </select>
        <button type="submit" className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium">Süz</button>
      </form>

      {/* Webhook list */}
      {!hasWebhooks ? (
        <Card className="glass">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10">
              <Plug className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold">Hələ webhook qurulmayıb</h3>
            <p className="mt-1 max-w-md mx-auto text-sm text-muted-foreground">
              Yuxarıda &ldquo;Yeni webhook&rdquo; düyməsi ilə başlayın. Slack, Discord, Telegram, Zapier kimi xidmətlər üçün hazır şablonlar var.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((w) => (
            <WebhookRow key={w.id} w={w} />
          ))}
        </div>
      )}

      {/* Recent deliveries log */}
      {deliveries.length > 0 && (
        <Card className="glass">
          <CardContent className="p-0">
            <header className="border-b border-border/60 px-4 py-3">
              <h3 className="text-sm font-semibold">Son göndərmə logları</h3>
              <p className="text-[10.5px] text-muted-foreground">HTTP cavab kodu, müddət və xəta səbəbi</p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Vaxt</th>
                    <th className="px-3 py-2.5">Endpoint</th>
                    <th className="px-3 py-2.5">Hadisə</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Müddət</th>
                    <th className="px-3 py-2.5">Xəta</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id.toString()} className="border-b border-border/30">
                      <td className="px-3 py-2 text-[10.5px] text-muted-foreground whitespace-nowrap">
                        {formatDate(d.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-2 text-xs">{d.webhook_endpoints?.ad ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-[10.5px]">{d.event}</td>
                      <td className="px-3 py-2">
                        {d.http_status ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              d.http_status >= 200 && d.http_status < 300
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                                : "border-rose-500/30 bg-rose-500/10 text-rose-500"
                            )}
                          >
                            {d.http_status}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-500">
                            ERR
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[10.5px]">
                        {d.muddet_ms !== null ? `${d.muddet_ms}ms` : "—"}
                      </td>
                      <td className="px-3 py-2 text-[10.5px] text-muted-foreground">
                        {d.xeta ? <span className="text-rose-500">{d.xeta}</span> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event catalog */}
      <Card className="glass">
        <CardContent className="p-0">
          <header className="border-b border-border/60 px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Activity className="h-4 w-4 text-primary" />
              Mövcud hadisələr ({WEBHOOK_EVENTS.length})
            </h3>
            <p className="text-[10.5px] text-muted-foreground">
              Webhook yaradanda bu hadisələrdən birini və ya bir neçəsini seçin
            </p>
          </header>
          <div className="grid grid-cols-1 divide-y divide-border/30 md:grid-cols-2 md:divide-x md:divide-y-0">
            {[0, 1].map((col) => (
              <div key={col} className="divide-y divide-border/30">
                {WEBHOOK_EVENTS.slice(col * 8, (col + 1) * 8).map((e) => {
                  const Icon = e.icon;
                  return (
                    <details key={e.kod} className="group px-4 py-2 hover:bg-secondary/20">
                      <summary className="flex cursor-pointer items-center gap-2">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <code className="font-mono text-[11px] font-semibold">{e.kod}</code>
                        <Badge variant="outline" className="text-[9px]">{e.modul}</Badge>
                        <span className="ml-auto text-[10px] text-muted-foreground group-open:hidden">aç ↓</span>
                      </summary>
                      <div className="mt-2 space-y-1.5 pl-5 text-[11px]">
                        <p className="text-muted-foreground">{e.tesvir}</p>
                        <p>
                          <strong className="text-foreground">Nə vaxt:</strong>{" "}
                          <span className="text-muted-foreground">{e.ne_vaxt}</span>
                        </p>
                        <details>
                          <summary className="cursor-pointer text-[10px] font-semibold text-primary">Payload nümunəsi</summary>
                          <pre className="mt-1 overflow-x-auto rounded-md bg-secondary/40 p-2 text-[10px] leading-tight">
                            {JSON.stringify(e.payload_misal, null, 2)}
                          </pre>
                        </details>
                      </div>
                    </details>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Documentation panel — signature + retry */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="glass">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-bold">İmza yoxlaması (HMAC-SHA256)</h3>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Hər POST sorğusunda <code className="rounded bg-secondary/60 px-1 font-mono text-[10px]">X-360Biznes-Signature</code> başlığı göndərilir.
              Bu sayədə qəbul edən tərəf əmin olur ki, mesaj həqiqətən bizdən gəlib.
            </p>
            <details>
              <summary className="cursor-pointer text-[11px] font-semibold text-primary">Node.js nümunəsi</summary>
              <pre className="mt-1 overflow-x-auto rounded-md bg-secondary/40 p-2 text-[10px] leading-tight">
{`import crypto from "node:crypto";

app.post("/webhook", (req, res) => {
  const sig = req.headers["x-360biznes-signature"];
  const expected = "sha256=" + crypto
    .createHmac("sha256", YOUR_SECRET)
    .update(JSON.stringify(req.body))
    .digest("hex");
  if (sig !== expected) return res.status(401).end();
  // ...prosess
});`}
              </pre>
            </details>
            <details>
              <summary className="cursor-pointer text-[11px] font-semibold text-primary">PHP nümunəsi</summary>
              <pre className="mt-1 overflow-x-auto rounded-md bg-secondary/40 p-2 text-[10px] leading-tight">
{`$body = file_get_contents("php://input");
$sig = $_SERVER["HTTP_X_360BIZNES_SIGNATURE"];
$expected = "sha256=" . hash_hmac("sha256", $body, YOUR_SECRET);
if (!hash_equals($expected, $sig)) {
  http_response_code(401); exit;
}`}
              </pre>
            </details>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold">Retry və xəta idarəsi</h3>
            </div>
            <ul className="space-y-1.5 text-[11px] text-muted-foreground">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                <span>HTTP <strong className="text-foreground">200-299</strong> = uğurlu (heç bir retry yoxdur)</span>
              </li>
              <li className="flex items-start gap-1.5">
                <RefreshCw className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                <span>HTTP <strong className="text-foreground">400-599</strong> = avto-retry: 3 dəfə (1 dəq, 5 dəq, 30 dəq)</span>
              </li>
              <li className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-rose-500" />
                <span>10 saniyə timeout (alıcı server cavab vermirsə)</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Code className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span>
                  Tövsiyə cavab: <code className="rounded bg-secondary/60 px-1 font-mono">200 OK</code> ilə{" "}
                  <code className="rounded bg-secondary/60 px-1 font-mono">{`{ "ok": true }`}</code>
                </span>
              </li>
            </ul>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[10.5px]">
              <strong className="text-amber-600 dark:text-amber-400">⚠ Vacib:</strong> Webhook qəbul edən tərəf <strong>tez cavab verməlidir</strong> (≤2 sn).
              Uzun proseslər queue-yə qoyulmalı, dərhal 200 qaytarılmalıdır.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom info */}
      <div className="rounded-lg border border-dashed border-border/40 bg-card/20 p-3 text-[10.5px] text-muted-foreground">
        <Info className="mr-1 inline h-3 w-3" />
        <strong className="text-foreground">Webhook başlıqları:</strong> hər çağırışda <code className="rounded bg-secondary/60 px-1 font-mono">X-360Biznes-Event</code>,{" "}
        <code className="rounded bg-secondary/60 px-1 font-mono">X-360Biznes-Endpoint</code>,{" "}
        <code className="rounded bg-secondary/60 px-1 font-mono">X-360Biznes-Signature</code> əlavə olunur.
        Test üçün hər endpoint kartında &ldquo;Test&rdquo; düyməsi var.
      </div>
    </div>
  );
}

function FlowStep({
  num, icon: Icon, title, desc, color,
}: {
  num: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <div className="relative rounded-lg border border-border bg-card/50 p-3">
      <div className="flex items-start gap-2">
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow", color)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{num}-ci addım</span>
          </div>
          <h4 className="text-sm font-bold">{title}</h4>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">{desc}</p>
        </div>
      </div>
      {num < 3 && (
        <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 md:block">
          <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}
