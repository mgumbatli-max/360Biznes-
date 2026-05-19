import { TrendingUp, TrendingDown, Sparkles, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSalesForecast } from "@/features/ticaret/forecast-queries";
import { formatMoney } from "@/lib/utils";

const ETIBAR_META: Record<"yuksek" | "orta" | "asagi", { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  yuksek: { label: "Yüksək", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", icon: CheckCircle2 },
  orta:   { label: "Orta",   cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", icon: Clock },
  asagi:  { label: "Aşağı",  cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30", icon: AlertTriangle },
};

export async function SalesForecastWidget() {
  const f = await getSalesForecast();
  const etibar = ETIBAR_META[f.etibarlilik];
  const Icon = etibar.icon;
  const trendUp = f.trend_faiz > 0;
  const TrendIcon = trendUp ? TrendingUp : TrendingDown;
  const proqnozMinusCari = f.cari_ay_proqnoz - f.cari_ay_indiye_qeder;

  // Progress bar — ayda neçə faizi keçilib
  const ayProgress = (f.cari_ay_gun_keçib / (f.cari_ay_gun_keçib + f.cari_ay_qalan_gun)) * 100;
  const proqnozVsKecen = f.kecen_ay_cemi > 0
    ? ((f.cari_ay_proqnoz - f.kecen_ay_cemi) / f.kecen_ay_cemi) * 100
    : 0;

  return (
    <Card className="glass border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-card to-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-violet-600" />
          Satış proqnozu — Ay sonu
          <Badge variant="outline" className={`ml-auto text-[10px] ${etibar.cls}`}>
            <Icon className="mr-1 h-2.5 w-2.5" />
            {etibar.label} etibar
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hero — proqnoz rəqəmi */}
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-3xl font-bold tabular-nums text-violet-700 dark:text-violet-300">
              {formatMoney(f.cari_ay_proqnoz)}
            </div>
            <div className="text-[10.5px] text-muted-foreground">
              Cari: {formatMoney(f.cari_ay_indiye_qeder)} · əlavə proqnoz: {formatMoney(proqnozMinusCari)}
            </div>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-1 text-sm font-bold ${trendUp ? "text-emerald-600" : "text-rose-600"}`}>
              <TrendIcon className="h-3 w-3" />
              {trendUp ? "+" : ""}{f.trend_faiz.toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground">vs keçən ay (eyni gün)</div>
          </div>
        </div>

        {/* Ay progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
            <span>Ayın {f.cari_ay_gun_keçib}-ci günü</span>
            <span>{f.cari_ay_qalan_gun} gün qalıb</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary/60">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-primary"
              style={{ width: `${ayProgress}%` }}
            />
          </div>
        </div>

        {/* Müqayisə kartları */}
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <Mini label="Bu ay günlük orta" value={formatMoney(f.gunluk_orta)} />
          <Mini label="Son 7 gün orta" value={formatMoney(f.son_7_gun_orta)} highlight />
          <Mini label="Keçən ay cəmi" value={formatMoney(f.kecen_ay_cemi)} />
        </div>

        {/* Mesaj + ötən il müqayisəsi */}
        <div className="space-y-1 rounded-md bg-secondary/30 px-3 py-2 text-[10.5px]">
          <p>{f.mesaj}</p>
          {f.ilki_eyni_ay > 0 && (
            <p className="text-muted-foreground">
              Ötən il eyni ay: <strong className="text-foreground">{formatMoney(f.ilki_eyni_ay)}</strong>{" "}
              · proqnoz <strong className={f.cari_ay_proqnoz >= f.ilki_eyni_ay ? "text-emerald-600" : "text-rose-600"}>
                {f.cari_ay_proqnoz >= f.ilki_eyni_ay ? "+" : ""}{(((f.cari_ay_proqnoz - f.ilki_eyni_ay) / f.ilki_eyni_ay) * 100).toFixed(0)}%
              </strong>
            </p>
          )}
          {f.kecen_ay_cemi > 0 && (
            <p className="text-muted-foreground">
              Keçən ayın yekun: <strong className="text-foreground">{formatMoney(f.kecen_ay_cemi)}</strong> ·
              proqnoz vs keçən ay: <strong className={proqnozVsKecen >= 0 ? "text-emerald-600" : "text-rose-600"}>
                {proqnozVsKecen >= 0 ? "+" : ""}{proqnozVsKecen.toFixed(0)}%
              </strong>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border px-2 py-1.5 ${highlight ? "border-violet-500/30 bg-violet-500/5" : "border-border/40 bg-card/40"}`}>
      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums ${highlight ? "text-violet-700 dark:text-violet-300" : ""}`}>
        {value}
      </div>
    </div>
  );
}
