import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import {
  getCostAnalysis,
  getMayaProductBreakdown,
  getMayaKateqoriyaBreakdown,
  getMayaTrend6Months,
} from "@/features/sahibkar/queries";
import { formatMoney } from "@/lib/utils";
import { CostCalculatorUploader } from "@/features/sahibkar/maya/components/cost-calculator-uploader";
import {
  ProductMarginBreakdown,
  KateqoriyaBreakdown,
  MayaTrendChart,
} from "@/features/sahibkar/maya/components/product-margin-breakdown";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";
import { Wallet } from "lucide-react";

export const metadata: Metadata = { title: "Maya analizi" };

export default async function MayaPage() {
  await requireSahibkarSession();
  const [a, productBreakdown, kateqoriya, trend] = await Promise.all([
    getCostAnalysis(),
    getMayaProductBreakdown(5).catch(() => ({ top: [], bottom: [] })),
    getMayaKateqoriyaBreakdown().catch(() => []),
    getMayaTrend6Months().catch(() => []),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Maya analizi</h1>
        <p className="mt-1 text-sm text-muted-foreground">İdxal maya hesablama (Excel) + bu ayın xərc/mənfəət strukturu, məhsul və kateqoriya marja breakdown-ı.</p>
      </header>

      <SectionExplainer
        icon={Wallet}
        title="Maya analizi nə üçündür?"
        tone="emerald"
        description="İki şey: (1) yeni gələn idxal partiyasının real mayasını Excel ilə hesablayırsan (kurs, daşınma, gömrük, toplama, defekt ehtiyatı paylanır); (2) bu ay artıq satılmış mallar üzrə marja və mənfəət strukturuna baxırsan — hansı kateqoriya gəlirli, hansı zərərli, hansı məhsul lider, hansı geri qalır."
        bullets={[
          { label: "İdxal", text: "şablon endir → doldur → yüklə" },
          { label: "Marja", text: "məhsul və kateqoriya üzrə" },
          { label: "Trend", text: "son 6 ay COGS/mənfəət" },
        ]}
      />

      <CostCalculatorUploader />

      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bu ay: Gəlir → Xərclər → Mənfəət</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Ümumi gəlir" value={formatMoney(a.revenue)} tone="success" />
          <Row label="Verilmiş endirim" value={formatMoney(a.discount_given)} tone="muted" />
          <Bar label="COGS (satılan malların mayası)" value={a.cogs} pct={a.cogs_pct} total={a.revenue} tone="danger" />
          <Bar label="Əməliyyat xərcləri (OPEX)" value={a.opex} pct={a.opex_pct} total={a.revenue} tone="warning" />
          <Bar label="İşçi maaş (aylıq fiksə)" value={a.payroll_monthly} pct={a.payroll_pct} total={a.revenue} tone="info" />
          <div className="h-px bg-border/60" />
          <Row label="Brüt mənfəət (gəlir − COGS)" value={formatMoney(a.gross_profit)} tone={a.gross_profit >= 0 ? "success" : "danger"} bold />
          <Row label="Net mənfəət (− OPEX − maaş)" value={formatMoney(a.net_profit)} tone={a.net_profit >= 0 ? "success" : "danger"} bold big />
        </CardContent>
      </Card>

      <ProductMarginBreakdown top={productBreakdown.top} bottom={productBreakdown.bottom} />
      <KateqoriyaBreakdown items={kateqoriya} />
      <MayaTrendChart items={trend} />
    </div>
  );
}

type Tone = "success" | "danger" | "warning" | "info" | "muted";
const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  info: "text-info",
  muted: "text-muted-foreground",
};
const TONE_BG: Record<Tone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  muted: "bg-muted",
};

function Row({ label, value, tone = "muted", bold, big }: { label: string; value: string; tone?: Tone; bold?: boolean; big?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={bold ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular-nums ${big ? "text-lg font-bold" : bold ? "font-semibold" : ""} ${TONE_TEXT[tone]}`}>{value}</span>
    </div>
  );
}

function Bar({ label, value, pct, tone }: { label: string; value: number; pct: number; total: number; tone: Tone }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] text-muted-foreground">{pct.toFixed(1)}%</span>
          <span className={`tabular-nums font-semibold ${TONE_TEXT[tone]}`}>{formatMoney(value)}</span>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full ${TONE_BG[tone]}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
