import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar, User, ChevronRight, Radar, ArrowUpRight,
  MessageCircle, Sparkles,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAlertDetail } from "@/features/alerts/queries";
import { AlertCard } from "@/features/alerts/components/alert-card";
import { SeverityBadge, StatusBadge } from "@/features/alerts/components/severity-badge";
import { formatDate, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Xəbərdarlıq detalı" };
export const dynamic = "force-dynamic";

export default async function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const alert = await getAlertDetail(id);
  if (!alert) notFound();

  // Convert to the shape AlertCard expects
  const card = {
    id: alert.id,
    basliq: alert.basliq,
    tesvir: alert.tesvir,
    seviyye: alert.seviyye,
    status: alert.status,
    kateqoriya_kod: alert.kateqoriya_kod,
    kateqoriya_ad: alert.alert_categories.ad,
    kateqoriya_emoji: alert.alert_categories.emoji,
    kateqoriya_reng: alert.alert_categories.reng,
    risk_bali: alert.risk_bali,
    obyekt_nov: alert.obyekt_nov,
    obyekt_basliq: alert.obyekt_basliq,
    assigned_to_ad: alert.istifadeciler_alerts_assigned_toToistifadeciler?.ad_soyad ?? null,
    first_seen_at: alert.first_seen_at,
    due_at: alert.due_at,
    snoozed_until: alert.snoozed_until,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/xeberdarliqlar" className="inline-flex items-center gap-1 hover:text-foreground">
          <Radar className="h-3 w-3" />
          Xəbərdarlıqlar
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>#{alert.id.slice(0, 8)}</span>
      </nav>

      {/* Main alert card with actions */}
      <AlertCard alert={card} />

      {/* AI tövsiyə */}
      {alert.ai_tovsiye && (
        <Card className="glass border-purple-500/30 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-purple-500" />
              AI tövsiyə
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{alert.ai_tovsiye}</p>
          </CardContent>
        </Card>
      )}

      {/* Meta grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="glass">
          <CardContent className="space-y-2 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Risk</div>
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge value={alert.seviyye} />
              <StatusBadge value={alert.status} />
              <Badge variant="outline">{alert.alert_categories.ad}</Badge>
              {alert.risk_bali != null && (
                <Badge variant="secondary">Risk: {alert.risk_bali}</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              <Calendar className="mr-1 inline h-3 w-3" />
              {alert.first_seen_at && formatDate(alert.first_seen_at, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
            {alert.obyekt_basliq && (
              <div className="text-xs">
                <strong>Obyekt:</strong> {alert.obyekt_basliq}{" "}
                {alert.obyekt_nov && <code className="ml-1 rounded bg-secondary/60 px-1 font-mono text-[10px]">{alert.obyekt_nov}</code>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="space-y-2 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sahib / həll</div>
            {alert.istifadeciler_alerts_assigned_toToistifadeciler ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <strong>{alert.istifadeciler_alerts_assigned_toToistifadeciler.ad_soyad}</strong>
                </div>
                {alert.istifadeciler_alerts_assigned_toToistifadeciler.email && (
                  <div className="text-[11px] text-muted-foreground">{alert.istifadeciler_alerts_assigned_toToistifadeciler.email}</div>
                )}
                {alert.assigned_at && (
                  <div className="text-[11px] text-muted-foreground">
                    <Calendar className="mr-1 inline h-2.5 w-2.5" />
                    {formatDate(alert.assigned_at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Heç kimə təyin edilməyib</p>
            )}
            {alert.resolved_at && alert.istifadeciler_alerts_resolved_byToistifadeciler && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 text-xs">
                <strong>Həll etdi:</strong> {alert.istifadeciler_alerts_resolved_byToistifadeciler.ad_soyad}{" "}
                <span className="text-muted-foreground">
                  · {formatDate(alert.resolved_at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                {alert.resolution_note && <p className="mt-1 text-muted-foreground">{alert.resolution_note}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comments */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-primary" />
            Qeydlər ({alert.alert_comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alert.alert_comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Hələ qeyd yoxdur — yuxarıdakı &quot;Qeyd&quot; düyməsi ilə əlavə edin</p>
          ) : (
            <ul className="space-y-2">
              {alert.alert_comments.map((c) => (
                <li key={c.id} className="rounded-md border border-border/40 bg-secondary/20 px-3 py-2">
                  <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{c.istifadeciler?.ad_soyad ?? "—"}</span>
                    <span>{c.yaradildi && formatDate(c.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.metn}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Escalations */}
      {alert.alert_escalations.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpRight className="h-4 w-4 text-amber-500" />
              Eskalasiya tarixçəsi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {alert.alert_escalations.map((e) => (
                <li key={e.id} className={cn("rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs")}>
                  <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
                    <span>
                      <strong className="text-foreground">{e.istifadeciler_alert_escalations_escalated_byToistifadeciler?.ad_soyad ?? "—"}</strong>
                      {" → "}
                      {e.istifadeciler_alert_escalations_escalated_toToistifadeciler?.ad_soyad ?? "—"}
                    </span>
                    <span>{e.yaradildi && formatDate(e.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {e.sebeb && <p className="mt-1">{e.sebeb}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Back link */}
      <div>
        <BackButton fallback="/xeberdarliqlar" label="Bütün xəbərdarlıqlar" />
      </div>
    </div>
  );
}
