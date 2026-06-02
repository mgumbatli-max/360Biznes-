import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle, BookOpen, Sparkles, Brain, TrendingUp, Users, Tag, Package, PenLine, Beaker, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TopicsBrowser } from "@/features/komekci/components/topics-browser";
import { ErpHelperChat } from "@/features/komekci/components/erp-helper-chat";
import { ChatClient } from "@/features/ai/components/chat-client";
import { getChatHistory, getMockStatus, getDailyInsights } from "@/features/ai/queries";
import type { ChatTurn } from "@/features/ai/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Köməkçi mərkəzi" };

const BIZNES_FEATURES = [
  { icon: TrendingUp, title: "AI satış məsləhəti", desc: "Maya, marja, tempə baxıb endirim/qiymət tövsiyəsi", q: "Bu ayın top 5 məhsulu haqqında satış məsləhəti və endirim strategiyası ver" },
  { icon: Users, title: "Müştəri seqmentləşdirmə", desc: "RFM analizi əsasında müştəri qrupları", q: "Müştərilərimi RFM (Recency, Frequency, Monetary) analizi ilə qruplaşdır" },
  { icon: Tag, title: "Qiymət təklifi", desc: "Maya əsasında optimal satış qiyməti", q: "Top satılan məhsullarımın maya/satış qiyməti haqqında məlumat ver" },
  { icon: PenLine, title: "Yazı kömək", desc: "Məhsul təsviri, kampaniya elanı üçün AI-redaktor", q: "Top satılan məhsullarımdan birinə cəlbedici 3-4 cümləlik təsvir yaz" },
];

const INSIGHT_TONE: Record<string, string> = {
  success: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  danger: "border-danger/30 bg-danger/5",
  info: "border-info/30 bg-info/5",
};

type SP = { tab?: string; q?: string };

export default async function KomekciPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = sp.tab === "biznes" ? "biznes" : "oyretme";
  const prefilledQuery = sp.q?.trim() ?? "";

  // Biznes tab üçün AI history + insights yüklə (yalnız aktiv tab-da)
  const [history, insights] = tab === "biznes"
    ? await Promise.all([getChatHistory(50, "employee"), getDailyInsights()])
    : [[], []];
  const isMockMode = tab === "biznes" ? getMockStatus() : false;

  const turns: ChatTurn[] = [];
  for (const h of history) {
    turns.push({ id: `u-${h.id}`, role: "user", content: h.prompt, yaradildi: h.yaradildi ?? undefined });
    turns.push({ id: `a-${h.id}`, role: "assistant", content: h.cavab, is_mock: h.is_mock, yaradildi: h.yaradildi ?? undefined });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-card to-sky-500/5 p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-violet-500 to-sky-500 opacity-10 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 shadow-lg shadow-violet-500/20">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Köməkçi mərkəzi</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Sistemi öyrənmək və biznes data əsasında AI tövsiyələri almaq — bir yerdə.
            </p>
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <div className="flex gap-1.5 rounded-xl border border-border bg-card/40 p-1">
        <TabLink href="/komekci" active={tab === "oyretme"} icon={BookOpen} label="Sistem öyrətmə" sub="«Necə istifadə edim?»" />
        <TabLink href="/komekci?tab=biznes" active={tab === "biznes"} icon={Brain} label="Biznes AI" sub="«Datadan tövsiyə»" />
      </div>

      {tab === "oyretme" ? (
        <>
          <ErpHelperChat />
          <Card className="border-sky-500/30 bg-sky-500/5">
            <CardContent className="flex items-start gap-2 py-3 text-[11px]">
              <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
              <div className="space-y-0.5 text-muted-foreground">
                <p><strong className="text-foreground">Hər mövzuda 3 hissə var:</strong></p>
                <ul className="list-disc space-y-0.5 pl-4">
                  <li><strong className="text-foreground">📖 Nədir?</strong> — funksiyanın izahı</li>
                  <li><strong className="text-foreground">🎯 Necə istifadə</strong> — addım-addım təlimat</li>
                  <li><strong className="text-foreground">⚠ Vacib qeydlər</strong> — diqqət edilməli olanlar</li>
                </ul>
              </div>
            </CardContent>
          </Card>
          <TopicsBrowser />
        </>
      ) : (
        <>
          {/* AI insights — günün */}
          {insights.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-light" />
                <h2 className="text-base font-semibold">Bu günün AI insight-ları</h2>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                {insights.map((ins, i) => (
                  <Card key={i} className={cn(INSIGHT_TONE[ins.seviyye] ?? "")}>
                    <CardContent className="space-y-1 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold">{ins.title}</h3>
                        <Badge variant="outline" className="text-[10px] capitalize">{ins.kind}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{ins.detail}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Hazır biznes sualları */}
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Hazır biznes sualları
            </h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {BIZNES_FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <Link
                    key={f.title}
                    href={`/komekci?tab=biznes&q=${encodeURIComponent(f.q)}`}
                    className="group block rounded-lg border border-border bg-card/40 p-3 transition hover:-translate-y-0.5 hover:border-primary/40"
                  >
                    <div className="flex items-start gap-2">
                      <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 text-white">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold">{f.title}</h3>
                        <p className="text-[10.5px] text-muted-foreground">{f.desc}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Chat */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary-light" />
              <h2 className="text-base font-semibold">Sərbəst sual-cavab {isMockMode && <Badge variant="outline" className="ml-1 text-[10px]">Mock</Badge>}</h2>
            </div>
            <ChatClient
              initial={turns}
              isMockMode={isMockMode}
              mode="employee"
              emptyHeading="AI Köməkçi — Biznes datası ilə"
              emptySubtext="Şəxsi performans, satış, tapşırıq, anbar və vəzifə inkişafı haqqında sual ver. Şirkətin ümumi gəlir/mənfəət/kassa məlumatları yalnız Sahibkar bölməsindədir."
              prefilledInput={prefilledQuery || undefined}
            />
          </section>
        </>
      )}
    </div>
  );
}

function TabLink({ href, active, icon: Icon, label, sub }: {
  href: string;
  active: boolean;
  icon: typeof HelpCircle;
  label: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 items-center gap-2 rounded-lg px-3 py-2 transition",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-bold leading-tight">{label}</div>
        <div className={cn("text-[10px] leading-tight", active ? "opacity-80" : "")}>{sub}</div>
      </div>
    </Link>
  );
}
