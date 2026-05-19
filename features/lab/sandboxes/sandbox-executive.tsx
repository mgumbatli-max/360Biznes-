"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileBarChart, RefreshCw, Sparkles } from "lucide-react";

const SUMMARIES = [
  {
    title: "Strateji vəziyyət — Aprel",
    body: "Bu ay satış 14,500 ₼ — keçən aydan 12% yüksək. Net mənfəət 3,200 ₼ (22% margin) — sağlam. Stok dövriyyəsi 32 gün — kateqoriya \"elektronika\"da 12 məhsul dormant. Cash runway 85 gün — risk azdır. Top müştəri konsentrasiyası 28% — qəbul edilə bilər.",
    actions: ["Dormant elektronika məhsullarına 15% endirim", "Top müştəriyə loyalty program təklif et", "Növbəti ay üçün stok sifarişi planla"],
  },
  {
    title: "Operativ analiz — Aprel",
    body: "Bu həftə 142 sifariş işləndi, orta çek 87 ₼. Qaytarma faizi 3.2% — norma daxilində. Ən aktiv saat 18:00-20:00 (gündəlik 32% satış). Ən zəif gün — bazar ertəsi. POS kassirlər ortalama 4.2 dəq/satış işləyirlər.",
    actions: ["Bazar ertəsi promo təklif", "18-20 saatları staff sayını artır", "POS prosesini optimallaşdır"],
  },
  {
    title: "Maliyyə xülasə — Aprel",
    body: "OPEX 8,500 ₼ — keçən aya nisbətən +5% (kira artımı). Borc qalığı: müştərilərdən 12,400 ₼ (8 nəfər), tədarükçülərə 4,200 ₼. 90+ gün borc 1,200 ₼ — hüquqi addım düşünülməlidir. AZ vergi: gələn ay üçün təxminən 850 ₼ ödəniş.",
    actions: ["90+ gün borc müştərisi ilə əlaqə", "Vergi ödənişi üçün rezerv ayır", "Kira yüksək olduğundan icarə müzakirə"],
  },
];

export function SandboxExecutive() {
  const [idx, setIdx] = useState(0);
  const summary = SUMMARIES[idx];

  const next = () => setIdx((idx + 1) % SUMMARIES.length);

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileBarChart className="h-4 w-4 text-primary" />
          AI Executive Summary
        </CardTitle>
        <button type="button" onClick={next} className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs hover:bg-secondary">
          <RefreshCw className="h-3 w-3" />
          Yeni xülasə
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-base font-bold">{summary.title}</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed">{summary.body}</p>
        </div>

        <div className="space-y-1.5">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tövsiyə edilən addımlar</h4>
          {summary.actions.map((a, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border border-border/40 bg-secondary/30 px-3 py-2 text-sm">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{i + 1}</span>
              <span>{a}</span>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground">
          * Production aktivasiyada real biznes datasından canlı analiz edilir (Anthropic Claude API).
        </p>
      </CardContent>
    </Card>
  );
}

export function useSummaries() { return SUMMARIES; }
