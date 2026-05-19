import type { Metadata } from "next";
import Link from "next/link";
import {
  Sparkles,
  TrendingUp,
  Users,
  Tag,
  Package,
  PenLine,
  Beaker,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getChatHistory, getMockStatus, getDailyInsights } from "@/features/ai/queries";
import { ChatClient } from "@/features/ai/components/chat-client";
import type { ChatTurn } from "@/features/ai/types";

export const metadata: Metadata = { title: "AI Mərkəzi" };
export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: TrendingUp,
    title: "AI satış məsləhəti",
    desc: "Maya, marja, tempə baxıb endirim/qiymət tövsiyəsi.",
    href: "/ai/satis-meslehet",
    soon: true,
  },
  {
    icon: Users,
    title: "Müştəri seqmentləşdirmə",
    desc: "RFM analizi əsasında müştəri qrupları və ünvan strategiyası.",
    href: "/ai/segment",
    soon: true,
  },
  {
    icon: Tag,
    title: "Qiymət təklifi",
    desc: "Rəqib qiyməti və maya əsasında optimal satış qiyməti.",
    href: "/ai/qiymet",
    soon: true,
  },
  {
    icon: Package,
    title: "İnventar proqnozu",
    desc: "Növbəti 30 gün üçün satış proqnozu və alış tövsiyəsi.",
    href: "/anbar/satinalma",
  },
  {
    icon: PenLine,
    title: "Yazı kömək",
    desc: "Məhsul təsviri, kampaniya elanı, müştəri mesajı üçün AI-redaktor.",
    href: "/ai/yazi",
    soon: true,
  },
  {
    icon: Beaker,
    title: "Claude Lab",
    desc: "Sərbəst sual-cavab. Biznes data əsasında detallı təhlil.",
    href: "#chat",
  },
];

const INSIGHT_TONE: Record<string, string> = {
  success: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  danger: "border-danger/30 bg-danger/5",
  info: "border-info/30 bg-info/5",
};

export default async function AiPage() {
  const [history, insights] = await Promise.all([getChatHistory(50), getDailyInsights()]);
  const isMockMode = getMockStatus();

  const turns: ChatTurn[] = [];
  for (const h of history) {
    turns.push({ id: `u-${h.id}`, role: "user", content: h.prompt, yaradildi: h.yaradildi ?? undefined });
    turns.push({
      id: `a-${h.id}`,
      role: "assistant",
      content: h.cavab,
      is_mock: h.is_mock,
      yaradildi: h.yaradildi ?? undefined,
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <div className="flex items-center gap-2">
          <div
            className="grid h-9 w-9 place-items-center rounded-xl"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Mərkəzi</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Biznes data əsasında ağıllı analiz və tövsiyələr.{" "}
              {isMockMode ? "Mock rejim." : "Claude AI ilə canlı."}
            </p>
          </div>
        </div>
      </header>

      {insights.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-light" />
            <h2 className="text-base font-semibold">Bu günün AI insight-ları</h2>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {insights.map((ins, i) => (
              <Card key={i} className={`glass ${INSIGHT_TONE[ins.seviyye] ?? ""}`}>
                <CardContent className="space-y-1 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{ins.title}</h3>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {ins.kind}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{ins.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {FEATURES.map((f) => {
          const inner = (
            <Card
              className={`glass transition ${f.soon ? "opacity-70" : "hover:border-primary/40 hover:shadow"}`}
            >
              <CardContent className="space-y-2 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="grid h-9 w-9 place-items-center rounded-xl"
                    style={{ background: "var(--brand-gradient)" }}
                  >
                    <f.icon className="h-4 w-4 text-white" />
                  </div>
                  {f.soon && <Badge variant="outline" className="text-[10px]">tezliklə</Badge>}
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          );
          return f.soon ? (
            <div key={f.title} className="block">{inner}</div>
          ) : (
            <Link key={f.title} href={f.href} className="block">{inner}</Link>
          );
        })}
      </section>

      <section id="chat" className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary-light" />
          <h2 className="text-base font-semibold">Claude Lab — sual-cavab</h2>
        </div>
        <ChatClient initial={turns} isMockMode={isMockMode} />
      </section>
    </div>
  );
}
