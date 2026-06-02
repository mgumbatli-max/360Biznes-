import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Key, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsTopNav } from "@/features/ayar/components/settings-top-nav";
import { isMockMode } from "@/lib/ai/anthropic";

export const metadata: Metadata = { title: "AI Sahibkar Məsləhətçisi" };

// İstifadəçinin .env-də ANTHROPIC_API_KEY qoymasını yoxlayır.
// Real API açarı olanda — full chat / insight aktiv olur.
// Açar yoxdursa — mock cavablar gəlir (sistemdə UI qırılmasın deyə).

export default function Page() {
  const mockMode = isMockMode();
  const model = process.env.AI_MODEL || "claude-haiku-4-5-20251001";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <BackButton fallback="/ayarlar" label="Tənzimləmələr" />

      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-500">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tənzimləmələr</div>
          <h1 className="text-2xl font-bold tracking-tight">AI Sahibkar Məsləhətçisi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Claude API ilə günlük analiz, sual-cavab, anomaliya aşkarlama.
          </p>
        </div>
      </header>

      <SettingsTopNav />

      {/* Vəziyyət kartı */}
      <Card className={mockMode ? "glass border-amber-500/40" : "glass border-emerald-500/40"}>
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className={mockMode ? "grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-600" : "grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600"}>
              {mockMode ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">
                  {mockMode ? "Mock-mode aktivdir" : "Real Claude AI aktivdir"}
                </h3>
                <Badge
                  variant="outline"
                  className={mockMode ? "border-amber-500/40 text-amber-600 text-[10px]" : "border-emerald-500/40 text-emerald-600 text-[10px]"}
                >
                  {mockMode ? "Mock" : "Live"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {mockMode
                  ? "Hazırda ANTHROPIC_API_KEY qoyulmayıb. AI cavablar şablon mətnlərlə gəlir — funksionallıq görünür amma real təhlil yoxdur."
                  : `Real API açar tapıldı. AI cavablar Claude modeli (${model}) ilə gəlir.`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Konfiqurasiya təlimatı */}
      <Card className="glass">
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Key className="h-4 w-4 text-violet-500" />
            ANTHROPIC_API_KEY qurulması
          </div>
          <ol className="space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-500/15 text-[11px] font-bold text-violet-600">1</span>
              <span>
                Anthropic Console-da hesab aç:{" "}
                <Link href="https://console.anthropic.com/" target="_blank" className="inline-flex items-center gap-1 text-violet-600 hover:underline">
                  console.anthropic.com <ExternalLink className="h-3 w-3" />
                </Link>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-500/15 text-[11px] font-bold text-violet-600">2</span>
              <span>
                <strong>Settings → API Keys → Create Key</strong> ilə yeni açar yarat
              </span>
            </li>
            <li className="flex gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-500/15 text-[11px] font-bold text-violet-600">3</span>
              <span>
                Açarı kopyala — server tərəfində <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">.env</code> faylına və ya Vercel deployment env-inə əlavə et:
              </span>
            </li>
          </ol>
          <pre className="overflow-x-auto rounded-lg border border-border bg-secondary/40 p-3 font-mono text-[11.5px]">
            <span className="text-muted-foreground"># .env (local)</span>
            {"\n"}ANTHROPIC_API_KEY=&quot;sk-ant-...&quot;
            {"\n"}AI_MODEL=&quot;claude-haiku-4-5-20251001&quot;  <span className="text-muted-foreground"># opsional</span>
          </pre>
          <p className="text-xs text-muted-foreground">
            Açar əlavə edildikdən sonra dev server-i restart et (<code className="rounded bg-secondary px-1 font-mono text-[10.5px]">npm run dev</code>).
            Vercel deployment-də env yenilədikdən sonra avtomatik yenidən deploy olunur.
          </p>
        </CardContent>
      </Card>

      {/* Model parametrləri */}
      <Card className="glass">
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Model və qiymət
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <Stat label="Aktiv model" value={model} />
            <Stat label="Default max tokens" value="600" />
            <Stat label="Sistem dili" value="Azərbaycan" />
          </div>
          <div className="rounded-lg border border-border/40 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">Tövsiyə:</strong> claude-haiku-4-5 — sürətli və ucuz (chat üçün ideal).
            Dərin analiz üçün <code className="rounded bg-secondary px-1 font-mono">claude-sonnet-4-6</code> seç.
            Açarsız mock cavablar pulsuzdur.
          </div>
        </CardContent>
      </Card>

      {/* Hara işləyir */}
      <Card className="glass">
        <CardContent className="space-y-2 py-4">
          <div className="text-sm font-semibold">AI hansı bölmələrdə işləyir?</div>
          <ul className="space-y-1.5 text-sm">
            <Feature href="/ai" label="AI Köməkçisi" desc="Sual-cavab chat: «Bu ay nə yaxşı gedir?», «Harada pul itiririk?»" />
            <Feature href="/hesabatlar/ai" label="Hesabat AI" desc="Hesabat səhifəsində avtomatik insight və izah" />
            <Feature href="/komekci" label="Köməkçi" desc="ERP istifadə suallarına AI cavab" />
            <Feature href="/crm/ai-cavab" label="CRM Auto-cavab" desc="Müştəri mesajlarına AI tövsiyə" />
            <Feature href="/tapshiriqlar/ai-analiz" label="Tapşırıq AI analizi" desc="Tapşırıq performansı və bottleneck" />
            <Feature href="/anbar/anomali" label="Anomaliya aşkarlama" desc="Qeyri-adi stok hərəkəti, satış, qiymət" />
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-xs">{value}</div>
    </div>
  );
}

function Feature({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <li className="flex items-start gap-2">
      <Link href={href} className="font-medium text-violet-600 hover:underline">
        {label}
      </Link>
      <span className="text-muted-foreground">— {desc}</span>
    </li>
  );
}
