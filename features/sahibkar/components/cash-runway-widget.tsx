import { TrendingUp, TrendingDown, Wallet, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCashRunway } from "@/features/sahibkar/cash-runway-queries";
import { formatMoney } from "@/lib/utils";

const SAGLAMLIQ_META: Record<"sagligli" | "diqqet" | "kritik", { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  sagligli: { label: "Sağlam", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 },
  diqqet: { label: "Diqqət",  cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300", icon: AlertTriangle },
  kritik:   { label: "Kritik",  cls: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300", icon: AlertTriangle },
};

function formatRunway(gun: number | null): { label: string; sub: string } {
  if (gun === null) return { label: "∞", sub: "müsbət axın" };
  if (gun > 365) return { label: "1+ il", sub: `${gun} gün` };
  if (gun > 30) {
    const ay = Math.floor(gun / 30);
    return { label: `${ay} ay`, sub: `${gun} gün` };
  }
  return { label: `${gun} gün`, sub: gun < 30 ? "təcili tədbir!" : "" };
}

/**
 * Cash Runway widget — CEO-nun ən vacib metriki.
 * Sahibkar açan kimi görür: biznes neçə gün dözə bilir.
 */
export async function CashRunwayWidget() {
  const r = await getCashRunway();
  const m = SAGLAMLIQ_META[r.saglamliq];
  const Icon = m.icon;
  const flow = formatRunway(r.runway_gun);
  const positive = r.ayliq_net_flow >= 0;
  const FlowIcon = positive ? TrendingUp : TrendingDown;

  return (
    <Card className={`glass overflow-hidden ${m.cls.split(" ").slice(0, 2).join(" ")}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-emerald-600" />
          Cash Runway — biznesin uzunluğu
          <Badge variant="outline" className={`ml-auto text-[10px] ${m.cls}`}>
            <Icon className="mr-1 h-2.5 w-2.5" />
            {m.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hero rəqəm */}
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-3xl font-bold tabular-nums">{flow.label}</div>
            <div className="text-[10.5px] text-muted-foreground">
              {flow.sub} · {r.saglamliq_mesaj}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Mövcud nağd</div>
            <div className="text-xl font-bold tabular-nums">{formatMoney(r.cemi_nagd)}</div>
            <div className="text-[9.5px] text-muted-foreground">
              kassa {formatMoney(r.kassa_balans)} + bank {formatMoney(r.hesab_balans)}
            </div>
          </div>
        </div>

        {/* Net pozisiya breakdown */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini label="Alıcı borc" sub="bizə gələcək" value={r.alici_borc} positive />
          <Mini label="Təchizatçı borc" sub="biz verəcək" value={-r.techizatci_borc} positive={false} />
          <Mini label="Net pozisiya" sub="nağd + alacaq − verəcək" value={r.net_pozisiya} bold />
          <Mini
            label="Aylıq net axın"
            sub="3 ay orta"
            value={r.ayliq_net_flow}
            icon={FlowIcon}
            positive={positive}
          />
        </div>

        {/* Açıqlama */}
        <div className="rounded-md bg-secondary/30 px-3 py-2 text-[10.5px] text-muted-foreground">
          <div className="mb-0.5 flex items-center gap-1 font-bold text-foreground">
            <Clock className="h-3 w-3" />
            Necə hesablanır?
          </div>
          <p>
            Aylıq orta gəlir <strong className="text-foreground">{formatMoney(r.ayliq_orta_gelir)}</strong> −
            xərc <strong className="text-foreground">{formatMoney(r.ayliq_orta_xerc)}</strong> =
            <strong className={`ml-1 ${positive ? "text-emerald-600" : "text-rose-600"}`}>
              {positive ? "+" : ""}{formatMoney(r.ayliq_net_flow)}/ay
            </strong>
          </p>
          <p className="mt-0.5">
            {positive
              ? "Biznes müsbət axında — heç vaxt nağd bitməyəcək (mövcud tempə)."
              : `Hər gün ${formatMoney(Math.abs(r.ayliq_net_flow) / 30)} itirilir → mövcud nağd ${flow.sub}-ə kifayət edir.`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({
  label,
  sub,
  value,
  positive,
  bold = false,
  icon: Icon,
}: {
  label: string;
  sub: string;
  value: number;
  positive?: boolean;
  bold?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const cls = positive === undefined
    ? "text-foreground"
    : positive
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  return (
    <div className="rounded-md border border-border/40 bg-card/40 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-2.5 w-2.5" />}
        {label}
      </div>
      <div className={`mt-0.5 ${bold ? "text-base font-bold" : "text-sm font-semibold"} tabular-nums ${cls}`}>
        {value < 0 ? "−" : ""}{formatMoney(Math.abs(value))}
      </div>
      <div className="text-[9px] text-muted-foreground">{sub}</div>
    </div>
  );
}
