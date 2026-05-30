import type { Metadata } from "next";
import { Sparkles, MessageSquare, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CrmSubNav } from "@/components/crm-subnav";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { AiReplyConsole } from "@/features/crm/components/ai-reply-console";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { isMockMode } from "@/lib/ai/anthropic";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "AI Cavab" };

async function getAiLogs() {
  return withTenant(async () =>
    prisma.ai_sohbet_loq.findMany({
      orderBy: { yaradildi: "desc" },
      take: 30,
      include: { istifadeciler: { select: { ad_soyad: true } } },
    })
  );
}

async function getAiStats() {
  return withTenant(async () => {
    const [total, today, applied, sales] = await Promise.all([
      prisma.ai_sohbet_loq.count(),
      prisma.ai_sohbet_loq.count({
        where: { yaradildi: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
      }),
      prisma.ai_sohbet_loq.count({ where: { istifade_olundu: true } }),
      prisma.ai_sohbet_loq.count({ where: { satisa_cevrildi: true } }),
    ]);
    return {
      total,
      today,
      applied,
      sales,
      apply_rate: total > 0 ? (applied / total) * 100 : 0,
    };
  });
}

export default async function AiCavabPage() {
  const [logs, stats] = await Promise.all([getAiLogs(), getAiStats()]);
  const mock = isMockMode();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <CrmSubNav active="/crm/ai-cavab" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> AI Cavab Generator
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Müştəri sorğularına Claude AI ilə avtomatik cavab. {mock ? "Mock rejim aktivdir." : "Canlı."}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={MessageSquare} label="Cəm sual" value={String(stats.total)} subline={`${stats.today} bu gün`} />
        <KpiCard icon={ThumbsUp} label="İstifadə nisbəti" value={`${stats.apply_rate.toFixed(1)}%`} subline={`${stats.applied} təsdiqlənmiş`} tone="success" />
        <KpiCard icon={Sparkles} label="Satışa çevrildi" value={String(stats.sales)} subline="ROI cavablar" tone="success" />
        <KpiCard icon={Sparkles} label="Bu gün" value={String(stats.today)} subline="AI cavab" />
      </section>

      <Card className="glass">
        <CardContent className="py-5">
          <AiReplyConsole />
        </CardContent>
      </Card>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
          <Sparkles className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">AI cavab tarixçəsi boşdur</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Yuxarıdakı pəncərədən sual verib cavab generasiya edin.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Son cavablar</h2>
          {logs.map((l) => (
            <Card key={l.id.toString()} className="glass">
              <CardContent className="space-y-2 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    {l.yaradildi && formatDate(l.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {l.istifadeciler?.ad_soyad && ` · ${l.istifadeciler.ad_soyad}`}
                  </div>
                  <div className="flex items-center gap-1">
                    {l.model === "mock" && <Badge variant="outline" className="text-[10px]">mock</Badge>}
                    {l.istifade_olundu && <Badge variant="outline" className="border-success/30 text-success text-[10px]">istifadə</Badge>}
                    {l.satisa_cevrildi && <Badge style={{ background: "var(--brand-gradient)" }} className="border-0 text-[10px] text-white">satış</Badge>}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-muted-foreground">Sual:</div>
                  <div className="mt-0.5">{l.prompt}</div>
                </div>
                <div className="text-sm">
                  <div className="text-muted-foreground">Cavab:</div>
                  <div className="mt-0.5 whitespace-pre-wrap line-clamp-3">{l.cavab}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
