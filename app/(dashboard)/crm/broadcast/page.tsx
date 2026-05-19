import type { Metadata } from "next";
import { Megaphone, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CrmSubNav } from "@/components/crm-subnav";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { BroadcastDialog } from "@/features/crm/components/broadcast-dialog";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { formatDate } from "@/lib/utils";
import { getTemplates } from "@/features/crm/queries";

export const metadata: Metadata = { title: "Broadcast" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  gozlemede: { label: "Gözləmədə", cls: "bg-warning/15 text-warning border-warning/30" },
  gonderilir: { label: "Göndərilir", cls: "bg-info/15 text-info border-info/30" },
  tamamlandi: { label: "Tamamlandı", cls: "bg-success/15 text-success border-success/30" },
  xeta: { label: "Xəta", cls: "bg-danger/15 text-danger border-danger/30" },
  legv: { label: "Ləğv", cls: "bg-muted text-muted-foreground border-border" },
};

async function getCampaigns() {
  return withTenant(async () =>
    prisma.broadcast_kampaniyalari.findMany({
      orderBy: { yaradildi: "desc" },
      take: 50,
    })
  );
}

async function getStats() {
  return withTenant(async () => {
    const [total, tamamlanan, totalSent, totalSuccess] = await Promise.all([
      prisma.broadcast_kampaniyalari.count(),
      prisma.broadcast_kampaniyalari.count({ where: { status: "tamamlandi" } }),
      prisma.broadcast_kampaniyalari.aggregate({ _sum: { gonderilen_say: true } }),
      prisma.broadcast_kampaniyalari.aggregate({ _sum: { ugurlu_say: true, xeta_say: true } }),
    ]);
    const sent = Number(totalSent._sum.gonderilen_say ?? 0);
    const ok = Number(totalSuccess._sum.ugurlu_say ?? 0);
    const err = Number(totalSuccess._sum.xeta_say ?? 0);
    return { total, tamamlanan, sent, ok, err, success_rate: sent > 0 ? (ok / sent) * 100 : 0 };
  });
}

export default async function BroadcastPage() {
  const [rows, stats, templates] = await Promise.all([getCampaigns(), getStats(), getTemplates()]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <CrmSubNav active="/crm/broadcast" />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> Broadcast kampaniyalar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Kütləvi WhatsApp / SMS / Email göndəriş.</p>
        </div>
        <BroadcastDialog templates={templates} />
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Megaphone} label="Cəm kampaniya" value={String(stats.total)} subline={`${stats.tamamlanan} tamamlanıb`} />
        <KpiCard icon={Send} label="Cəm göndərilib" value={String(stats.sent)} subline="Bütün vaxt" />
        <KpiCard icon={CheckCircle2} label="Uğurlu" value={`${stats.success_rate.toFixed(1)}%`} subline={`${stats.ok} çatdı`} tone="success" />
        <KpiCard icon={AlertTriangle} label="Xəta" value={String(stats.err)} subline="Çatdırılmadı" tone={stats.err > 0 ? "warning" : "neutral"} />
      </section>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Megaphone className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Kampaniya yoxdur</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Yuxarıdakı &quot;Yeni broadcast&quot; düyməsi ilə başlayın.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => {
            const s = STATUS[c.status ?? "gozlemede"] ?? STATUS.gozlemede;
            return (
              <Card key={c.id} className="glass">
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{c.ad}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.matn}</p>
                    </div>
                    <Badge variant="outline" className={s.cls + " text-[10px]"}>{s.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-2 text-xs">
                    {c.kanallar.map((k) => (
                      <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>
                    ))}
                    <span className="text-muted-foreground">Hədəf: {c.hedef}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-2 text-xs">
                    <Stat label="Göndərildi" value={c.gonderilen_say ?? 0} />
                    <Stat label="Çatdı" value={c.ugurlu_say ?? 0} tone="success" />
                    <Stat label="Xəta" value={c.xeta_say ?? 0} tone={(c.xeta_say ?? 0) > 0 ? "danger" : "neutral"} />
                  </div>
                  <div className="text-[10.5px] text-muted-foreground">
                    {c.yaradildi && formatDate(c.yaradildi)}
                    {c.zamanlama && ` · Planlı: ${formatDate(c.zamanlama)}`}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "success" | "danger" | "neutral" }) {
  const cls = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "";
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`tabular-nums font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
