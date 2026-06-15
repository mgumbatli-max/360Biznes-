import React from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop } from "react-native-svg";
import {
  TrendingUp, TrendingDown, ArrowRight, ChevronRight, Wallet, Percent, Users, Coins,
  ListTodo, Clock, AlertTriangle, PackageX, ShoppingBasket, Package, Trophy, Activity,
} from "lucide-react-native";
import { C } from "../../theme";
import { formatMoney, formatNumber } from "../../lib/format";
import type {
  CeoKpis, MonthlyComparison, TodayCashFlow, MyPendingWork, DailyInsight,
  CriticalAlertRow, LowStockRow, TopProductRow, TopSellerRow, TopCustomerRow,
  TopPlatformRow, TopDebtorRow, DailySalesPoint, SalesVsExpensePoint,
} from "./types";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
type Go = (route: string) => void;

const NUM = { fontVariant: ["tabular-nums" as const] };

// ── Rənglər (web → RN hex) ──────────────────────────────────────────────────
const GREEN = "#10b981";
const SPARK = "#22c55e";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const ROSE = "#f43f5e";
const INFO = "#3b82f6";
const INDIGO = "#6366f1";
const PINK = "#ec4899";
const AMBER700 = "#b45309";

const SHADOW = { shadowColor: "#141820", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 };
const cardBase = { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, ...SHADOW } as const;

function withA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function deltaPct(cur: number, prev: number): { val: number; up: boolean } {
  if (!prev) return { val: cur > 0 ? 100 : 0, up: cur >= 0 };
  const v = ((cur - prev) / Math.abs(prev)) * 100;
  return { val: Math.abs(v), up: v >= 0 };
}
const AZ_MON_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
function azShortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${AZ_MON_SHORT[d.getMonth()]}`;
}

// ── SVG primitivləri ─────────────────────────────────────────────────────────
export function Sparkline({ id, data, color, width = 130, height = 34, fill = true }: { id: string; data: number[]; color: string; width?: number; height?: number; fill?: boolean }) {
  const pts = data && data.length > 1 ? data.map((v) => Number(v) || 0) : [0, 0];
  const max = Math.max(...pts);
  const min = Math.min(...pts, 0);
  const range = max - min || 1;
  const n = pts.length;
  const dx = width / (n - 1);
  const xy = pts.map((v, i) => [i * dx, height - 2 - ((v - min) / range) * (height - 4)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width.toFixed(1)},${height} L0,${height} Z`;
  const last = xy[xy.length - 1];
  return (
    <Svg width={width} height={height}>
      {fill ? (
        <>
          <Defs>
            <SvgGrad id={`spk-${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.3} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </SvgGrad>
          </Defs>
          <Path d={area} fill={`url(#spk-${id})`} />
        </>
      ) : null}
      <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </Svg>
  );
}

function ProgressRing({ ratio, color, label, size = 64 }: { ratio: number; color: string; label: string; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2 - 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, ratio));
  const off = circ * (1 - clamped);
  const cx = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={cx} cy={cx} r={r} stroke={color} strokeOpacity={0.12} strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx} cy={cx} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`} strokeDashoffset={off}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      </Svg>
      <Text style={{ fontSize: 12, fontWeight: "800", color }}>{label}</Text>
    </View>
  );
}

// Ümumi başlıq sətri (ikon qutu + başlıq + link)
function CardHead({ Icon, iconColor, iconBg, title, titleSize = 16, link, onLink }: { Icon: LucideIcon; iconColor: string; iconBg: string; title: string; titleSize?: number; link?: string; onLink?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
        <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
          <Icon size={15} color={iconColor} strokeWidth={2.2} />
        </View>
        <Text style={{ color: C.ink, fontSize: titleSize, fontWeight: "700", flexShrink: 1 }} numberOfLines={1}>{title}</Text>
      </View>
      {link && onLink ? (
        <Pressable onPress={onLink} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Text style={{ color: C.brand, fontSize: 11, fontWeight: "600" }}>{link}</Text>
          <ChevronRight size={13} color={C.brand} />
        </Pressable>
      ) : null}
    </View>
  );
}

function TrendPill({ up, val }: { up: boolean; val: number }) {
  const col = up ? GREEN : RED;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: withA(col, 0.15), borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Icon size={12} color={col} strokeWidth={2.4} />
      <Text style={{ color: col, fontSize: 11, fontWeight: "600", ...NUM }}>{val.toFixed(0)}%</Text>
    </View>
  );
}

// ── 1) AI Insight banner ──────────────────────────────────────────────────────
const INSIGHT_TONE: Record<DailyInsight["tone"], string> = { success: GREEN, warning: AMBER, danger: ROSE, info: C.brand };
export function InsightBanner({ insight }: { insight: DailyInsight }) {
  const col = INSIGHT_TONE[insight.tone] ?? C.brand;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: withA(col, 0.3), backgroundColor: withA(col, 0.1) }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: withA(col, 0.2), alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 20 }}>{insight.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.sub, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.4 }}>Günün analitikası</Text>
        <Text style={{ color: C.ink, fontSize: 14, fontWeight: "500", marginTop: 2 }}>{insight.text}</Text>
      </View>
    </View>
  );
}

// ── 2) Gəlir hero ──────────────────────────────────────────────────────────────
export function RevenueHero({ monthly, sales30, go }: { monthly: MonthlyComparison; sales30: DailySalesPoint[] | null; go: Go }) {
  const cur = monthly.current.revenue;
  const prev = monthly.previous.revenue;
  const d = deltaPct(cur, prev);
  const spark = (sales30 ?? []).map((p) => p.amount);
  return (
    <Pressable onPress={() => go("/maliyye")} style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1, ...cardBase, padding: 18 })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: withA(GREEN, 0.15), alignItems: "center", justifyContent: "center" }}>
          <TrendingUp size={14} color={GREEN} strokeWidth={2.3} />
        </View>
        <Text style={{ color: C.sub, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.4, flex: 1 }}>Bu ayın gəliri</Text>
        <TrendPill up={d.up} val={d.val} />
      </View>
      <Text style={{ color: GREEN, fontSize: 32, fontWeight: "800", marginTop: 10, ...NUM }} numberOfLines={1}>{formatMoney(cur)}</Text>
      <Text style={{ color: C.sub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
        Keçən ay: <Text style={{ color: C.ink, fontWeight: "700" }}>{formatMoney(prev)}</Text>
      </Text>
      {spark.length > 1 ? (
        <View style={{ marginTop: 12 }}>
          <Sparkline id="rev" data={spark} color={SPARK} width={300} height={56} />
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 }}>
        <Text style={{ color: C.brand, fontSize: 11, fontWeight: "600" }}>Hesabatlara keç</Text>
        <ArrowRight size={13} color={C.brand} />
      </View>
    </Pressable>
  );
}

// ── 3) Bu gün kartı ──────────────────────────────────────────────────────────
function MiniStat({ label, value, color, bg, onPress }: { label: string; value: string; color: string; bg: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, flex: 1, backgroundColor: bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 })}>
      <Text style={{ color: C.sub, fontSize: 10, fontWeight: "600", textTransform: "uppercase" }} numberOfLines={1}>{label}</Text>
      <Text style={{ color, fontSize: 16, fontWeight: "800", marginTop: 2, ...NUM }} numberOfLines={1}>{value}</Text>
    </Pressable>
  );
}
export function TodayCard({ ceo, cashflow, go }: { ceo: CeoKpis; cashflow: TodayCashFlow | null; go: Go }) {
  const net = cashflow?.net ?? 0;
  return (
    <View style={{ ...cardBase, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: C.sub, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.4 }}>Bu gün</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN }} />
          <Text style={{ color: C.sub, fontSize: 10 }}>Real-time</Text>
        </View>
      </View>
      <Pressable onPress={() => go("/(tabs)/satis")} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, flexDirection: "row", alignItems: "center" })}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.sub, fontSize: 10.5, fontWeight: "600", textTransform: "uppercase" }}>Satış</Text>
          <Text style={{ color: C.ink, fontSize: 24, fontWeight: "800", ...NUM }} numberOfLines={1}>{formatMoney(ceo.todaySalesAmount)}</Text>
          <Text style={{ color: C.sub, fontSize: 11 }}>{ceo.todaySalesCount} sifariş</Text>
        </View>
        <ArrowRight size={14} color={C.sub} />
      </Pressable>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <View style={{ width: "47.5%" }}>
          <MiniStat label="Net axın" value={(net >= 0 ? "+" : "") + formatMoney(net)} color={net >= 0 ? GREEN : RED} bg={C.surface2} onPress={() => go("/maliyye")} />
        </View>
        <View style={{ width: "47.5%" }}>
          <MiniStat label="Açıq tapşırıq" value={formatNumber(ceo.openTasks)} color={ceo.openTasks > 0 ? AMBER : C.ink} bg={ceo.openTasks > 0 ? withA(AMBER, 0.1) : C.surface2} onPress={() => go("/tapshiriq")} />
        </View>
        <View style={{ width: "47.5%" }}>
          <MiniStat label="Aşağı stok" value={formatNumber(ceo.lowStockCount)} color={ceo.lowStockCount > 0 ? RED : C.ink} bg={ceo.lowStockCount > 0 ? withA(RED, 0.1) : C.surface2} onPress={() => go("/mehsullar")} />
        </View>
        <View style={{ width: "47.5%" }}>
          <MiniStat label="Müştəri" value={formatNumber(ceo.activeCustomers)} color={C.ink} bg={C.surface2} onPress={() => go("/musteri")} />
        </View>
      </View>
    </View>
  );
}

// ── 4) 3 KPI kartı ──────────────────────────────────────────────────────────
type KpiTone = "neutral" | "success" | "warning" | "danger" | "info";
const KPI_FG: Record<KpiTone, string> = { neutral: C.ink, success: GREEN, warning: AMBER, danger: RED, info: INFO };
const KPI_ICONBG: Record<KpiTone, string> = {
  neutral: C.surface2, success: withA(GREEN, 0.15), warning: withA(AMBER, 0.15), danger: withA(RED, 0.15), info: withA(INFO, 0.15),
};
const KPI_ICONFG: Record<KpiTone, string> = { neutral: C.sub, success: GREEN, warning: AMBER, danger: RED, info: INFO };
function KpiCard({ Icon, label, value, sub, tone, trend, spark, sparkId, onPress }: { Icon: LucideIcon; label: string; value: string; sub: string; tone: KpiTone; trend?: { up: boolean; val: number }; spark: number[]; sparkId: string; onPress: () => void }) {
  const sparkColor = tone === "neutral" ? C.brand : KPI_FG[tone];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1, ...cardBase, padding: 14 })}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <View style={{ width: 22, height: 22, borderRadius: 8, backgroundColor: KPI_ICONBG[tone], alignItems: "center", justifyContent: "center" }}>
            <Icon size={13} color={KPI_ICONFG[tone]} strokeWidth={2.2} />
          </View>
          <Text style={{ color: C.sub, fontSize: 10.5, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 }} numberOfLines={1}>{label}</Text>
        </View>
        {trend ? <TrendPill up={trend.up} val={trend.val} /> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: KPI_FG[tone], fontSize: 22, fontWeight: "800", ...NUM }} numberOfLines={1}>{value}</Text>
          <Text style={{ color: C.sub, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{sub}</Text>
        </View>
        {spark.length > 1 ? <Sparkline id={sparkId} data={spark} color={sparkColor} width={96} height={30} /> : null}
      </View>
    </Pressable>
  );
}
export function KpiCards({ monthly, ceo, salesVsExp, sales30, go }: { monthly: MonthlyComparison; ceo: CeoKpis; salesVsExp: SalesVsExpensePoint[] | null; sales30: DailySalesPoint[] | null; go: Go }) {
  const sv = salesVsExp ?? [];
  const expSpark = sv.map((d) => d.xerc);
  const prfSpark = sv.map((d) => d.satis - d.xerc);
  const cntSpark = (sales30 ?? []).map((d) => d.count);
  return (
    <View style={{ gap: 10 }}>
      <KpiCard
        Icon={Wallet} label="Xərc (bu ay)" value={formatMoney(monthly.current.expense)}
        sub={`Keçən: ${formatMoney(monthly.previous.expense)}`} tone="warning"
        trend={deltaPct(monthly.current.expense, monthly.previous.expense)} spark={expSpark} sparkId="exp"
        onPress={() => go("/maliyye")}
      />
      <KpiCard
        Icon={Percent} label="Mənfəət (bu ay)" value={formatMoney(monthly.current.profit)}
        sub={`${ceo.netProfitPct.toFixed(1)}% marja · keçən: ${formatMoney(monthly.previous.profit)}`}
        tone={ceo.netProfitPct >= 0 ? "success" : "danger"}
        trend={deltaPct(monthly.current.profit, monthly.previous.profit)} spark={prfSpark} sparkId="prf"
        onPress={() => go("/maliyye")}
      />
      <KpiCard
        Icon={Users} label="Yeni müştəri" value={formatNumber(monthly.current.newCustomers)}
        sub={`Keçən: ${formatNumber(monthly.previous.newCustomers)} · aktiv: ${formatNumber(ceo.activeCustomers)}`}
        tone="neutral" trend={deltaPct(monthly.current.newCustomers, monthly.previous.newCustomers)} spark={cntSpark} sparkId="cus"
        onPress={() => go("/musteri")}
      />
    </View>
  );
}

// ── 5) Pul axını ──────────────────────────────────────────────────────────────
function FlowCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 12, borderWidth: 1, borderColor: withA(color, 0.2), backgroundColor: withA(color, 0.05) }}>
      <Text style={{ color, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }} numberOfLines={1}>{label}</Text>
      <Text style={{ color, fontSize: 17, fontWeight: "800", marginTop: 4, ...NUM }} numberOfLines={1}>{value}</Text>
    </View>
  );
}
function FlowBar({ label, pct, from, to }: { label: string; pct: number; from: string; to: string }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: C.sub, fontSize: 10 }}>{label}</Text>
        <Text style={{ color: C.sub, fontSize: 10, ...NUM }}>{pct.toFixed(0)}%</Text>
      </View>
      <View style={{ height: 6, borderRadius: 999, backgroundColor: withA(from, 0.1), overflow: "hidden" }}>
        <View style={{ height: 6, borderRadius: 999, width: `${Math.max(2, Math.min(100, pct))}%`, backgroundColor: to }} />
      </View>
    </View>
  );
}
export function CashflowCard({ cashflow, go }: { cashflow: TodayCashFlow; go: Go }) {
  const { daxil, xaric, net, emeliyyat_say } = cashflow;
  const max = Math.max(daxil, xaric, 1);
  return (
    <View style={{ ...cardBase, padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Coins size={16} color={PINK} strokeWidth={2.2} />
          <Text style={{ color: C.ink, fontSize: 16, fontWeight: "700" }}>Bu gün pul axını</Text>
        </View>
        <Pressable onPress={() => go("/maliyye")} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Text style={{ color: C.brand, fontSize: 11, fontWeight: "600" }}>Detal</Text>
          <ArrowRight size={12} color={C.brand} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <FlowCell label="Mədaxil" value={formatMoney(daxil)} color={GREEN} />
        <FlowCell label="Məxaric" value={formatMoney(xaric)} color={ROSE} />
        <FlowCell label="Net" value={(net >= 0 ? "+" : "") + formatMoney(net)} color={net >= 0 ? C.brand : ROSE} />
      </View>
      <View style={{ gap: 8, marginTop: 14 }}>
        <FlowBar label="Mədaxil" pct={(daxil / max) * 100} from={GREEN} to={GREEN} />
        <FlowBar label="Məxaric" pct={(xaric / max) * 100} from={ROSE} to={ROSE} />
      </View>
      <Text style={{ color: C.sub, fontSize: 10.5, marginTop: 10, textAlign: "right" }}>{emeliyyat_say} əməliyyat bu gün</Text>
    </View>
  );
}

// ── 6) Mənim işim ──────────────────────────────────────────────────────────────
const PRIO_DOT: Record<string, string> = { tecili: RED, yuksek: AMBER };
export function MyWorkCard({ work, go }: { work: MyPendingWork; go: Go }) {
  const open = work.my_open_tasks;
  const overdue = work.my_overdue;
  const onTime = Math.max(0, open - overdue);
  const ratio = open > 0 ? onTime / open : 1;
  const pct = Math.round(ratio * 100);
  const tone = open === 0 || pct >= 90 ? { c: GREEN, t: "Möhtəşəm" } : pct >= 60 ? { c: AMBER, t: "Diqqətli ol" } : { c: RED, t: "Düz toxun!" };
  const now = Date.now();
  return (
    <View style={{ ...cardBase, padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ListTodo size={16} color={C.brand} strokeWidth={2.2} />
          <Text style={{ color: C.ink, fontSize: 16, fontWeight: "700" }}>Mənim işim</Text>
        </View>
        <Pressable onPress={() => go("/tapshiriq")} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Text style={{ color: C.brand, fontSize: 11, fontWeight: "600" }}>Hamısı</Text>
          <ArrowRight size={12} color={C.brand} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <ProgressRing ratio={ratio} color={tone.c} label={`${pct}%`} />
        <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
          <View style={{ flex: 1, borderRadius: 8, padding: 6, alignItems: "center", backgroundColor: withA(C.brand, 0.1) }}>
            <Text style={{ color: C.brand, fontSize: 18, fontWeight: "800", ...NUM }}>{open}</Text>
            <Text style={{ color: C.sub, fontSize: 10 }}>açıq</Text>
          </View>
          <View style={{ flex: 1, borderRadius: 8, padding: 6, alignItems: "center", backgroundColor: withA(AMBER, 0.1) }}>
            <Text style={{ color: AMBER, fontSize: 18, fontWeight: "800", ...NUM }}>{work.my_today_reminders}</Text>
            <Text style={{ color: C.sub, fontSize: 10 }}>xatırlatma</Text>
          </View>
          <View style={{ flex: 1, borderRadius: 8, padding: 6, alignItems: "center", backgroundColor: withA(overdue > 0 ? RED : GREEN, 0.1) }}>
            <Text style={{ color: overdue > 0 ? RED : GREEN, fontSize: 18, fontWeight: "800", ...NUM }}>{overdue}</Text>
            <Text style={{ color: C.sub, fontSize: 10 }}>gecikmiş</Text>
          </View>
        </View>
      </View>
      {work.next_tasks.length === 0 ? (
        <Text style={{ color: C.sub, fontSize: 12, textAlign: "center", paddingVertical: 12 }}>Tapşırıq yoxdur — möhtəşəm! 🎉</Text>
      ) : (
        <View style={{ borderTopWidth: 1, borderTopColor: C.line, marginTop: 12, paddingTop: 8, gap: 2 }}>
          {work.next_tasks.slice(0, 4).map((t) => {
            const od = !!t.deadline && new Date(t.deadline).getTime() < now;
            const dot = PRIO_DOT[t.prioritet ?? ""] ?? "#94a3b8";
            return (
              <Pressable key={t.id} onPress={() => go(`/tapshiriq/${t.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 6, gap: 8 })}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
                  <Text style={{ color: od ? RED : C.ink, fontSize: 12, fontWeight: "500", flex: 1 }} numberOfLines={1}>{t.basliq}</Text>
                </View>
                {t.deadline ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Clock size={10} color={od ? RED : C.sub} />
                    <Text style={{ color: od ? RED : C.sub, fontSize: 10, fontWeight: od ? "700" : "400" }}>{azShortDate(t.deadline)}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── 7) Kritik xəbərdarlıq ──────────────────────────────────────────────────────
export function AlertsCard({ alerts, go }: { alerts: CriticalAlertRow[]; go: Go }) {
  return (
    <View style={{ ...cardBase, padding: 14, borderColor: withA(RED, 0.3) }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} color={RED} strokeWidth={2.2} />
          <Text style={{ color: C.ink, fontSize: 16, fontWeight: "700" }}>Diqqət lazımdır</Text>
          <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: withA(RED, 0.15), alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
            <Text style={{ color: RED, fontSize: 10, fontWeight: "800" }}>{alerts.length > 9 ? "9+" : alerts.length}</Text>
          </View>
        </View>
        <Pressable onPress={() => go("/bildiris")} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Text style={{ color: C.brand, fontSize: 11, fontWeight: "600" }}>Hamısı</Text>
          <ChevronRight size={12} color={C.brand} />
        </Pressable>
      </View>
      <View style={{ gap: 6 }}>
        {alerts.slice(0, 5).map((a) => {
          const col = a.seviyye === "kritik" ? ROSE : AMBER;
          return (
            <View key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>{a.basliq}</Text>
                <Text style={{ color: C.sub, fontSize: 11 }} numberOfLines={1}>{a.kateqoriya_ad}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── 8) Aşağı stok ──────────────────────────────────────────────────────────────
export function LowStockCard({ items, go }: { items: LowStockRow[]; go: Go }) {
  return (
    <View style={{ ...cardBase, padding: 14 }}>
      <CardHead Icon={PackageX} iconColor={AMBER} iconBg={withA(AMBER, 0.15)} title="Aşağı stok" link="Hamısı" onLink={() => go("/mehsullar")} />
      {items.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 16 }}>
          <View style={{ width: 48, height: 48, borderRadius: 18, backgroundColor: withA(GREEN, 0.1), alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <PackageX size={20} color={GREEN} />
          </View>
          <Text style={{ color: C.ink, fontSize: 13, fontWeight: "600" }}>Az stok yoxdur</Text>
          <Text style={{ color: C.sub, fontSize: 11, marginTop: 2 }}>Bütün məhsullar kritik səviyyədən yuxarıdır</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {items.map((it) => {
            const ratio = it.kritik_stok > 0 ? it.miqdar / it.kritik_stok : 0;
            const critical = it.miqdar <= 0 || ratio <= 0.3;
            const col = critical ? ROSE : AMBER;
            const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
            return (
              <Pressable key={it.mehsul_id} onPress={() => go("/mehsullar")} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: withA(col, 0.3), backgroundColor: withA(col, 0.05) })}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col }} />
                    <Text style={{ color: C.ink, fontSize: 14, fontWeight: "500", flex: 1 }} numberOfLines={1}>{it.ad}</Text>
                  </View>
                  <Text style={{ color: col, fontSize: 16, fontWeight: "800", ...NUM }}>{it.miqdar}</Text>
                  <Text style={{ color: C.sub, fontSize: 11, ...NUM }}> / {it.kritik_stok}</Text>
                </View>
                <Text style={{ color: C.sub, fontSize: 11, marginTop: 2, marginLeft: 16 }} numberOfLines={1}>
                  {it.kod ? `${it.kod} · ` : ""}{it.anbar_ad} · {it.miqdar <= 0 ? "bitib" : `${pct}%`}
                </Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => go("/mehsullar")} style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, marginTop: 2, backgroundColor: withA(C.brand, 0.1), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
            <ShoppingBasket size={13} color={C.brand} />
            <Text style={{ color: C.brand, fontSize: 11, fontWeight: "700" }}>Alış sifarişi</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── 9) Top 5 ──────────────────────────────────────────────────────────────────
type TopItem = { name: string; sub: string; value: string; onPress?: () => void };
function TopList({ Icon, color, title, items, emptyText }: { Icon: LucideIcon; color: string; title: string; items: TopItem[]; emptyText: string }) {
  return (
    <View style={{ ...cardBase, padding: 14 }}>
      <CardHead Icon={Icon} iconColor={color} iconBg={withA(color, 0.15)} title={title} titleSize={14} />
      {items.length === 0 ? (
        <Text style={{ color: C.sub, fontSize: 12, paddingVertical: 8 }}>{emptyText}</Text>
      ) : (
        <View style={{ gap: 4 }}>
          {items.map((it, i) => {
            const rankBg = i === 0 ? withA(AMBER, 0.2) : i === 1 ? "rgba(0,0,0,0.08)" : i === 2 ? withA(AMBER700, 0.15) : C.surface2;
            const rankFg = i === 0 ? AMBER : i === 2 ? AMBER700 : C.sub;
            return (
              <Pressable key={i} onPress={it.onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 })}>
                <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: rankBg, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: rankFg, fontSize: 11, fontWeight: "800", ...NUM }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink, fontSize: 12.5, fontWeight: "600" }} numberOfLines={1}>{it.name}</Text>
                  <Text style={{ color: C.sub, fontSize: 10.5 }} numberOfLines={1}>{it.sub}</Text>
                </View>
                <Text style={{ color: C.ink, fontSize: 12.5, fontWeight: "800", ...NUM }} numberOfLines={1}>{it.value}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
export function Top5({ products, sellers, customers, platforms, go }: { products: TopProductRow[] | null; sellers: TopSellerRow[] | null; customers: TopCustomerRow[] | null; platforms: TopPlatformRow[] | null; go: Go }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ color: C.ink, fontSize: 14, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>Top 5 — bu ay</Text>
        <Text style={{ color: C.sub, fontSize: 10.5 }}>(cari ay üzrə)</Text>
      </View>
      <TopList Icon={Package} color={INFO} title="Top məhsul" emptyText="Hələ satılan məhsul yoxdur"
        items={(products ?? []).map((p) => ({ name: p.ad, sub: `${p.miqdar} ədəd`, value: formatMoney(p.mebleg), onPress: () => go("/mehsullar") }))} />
      <TopList Icon={Trophy} color={AMBER} title="Top satıcı" emptyText="Bu ay satıcı statistikası yoxdur"
        items={(sellers ?? []).map((s) => ({ name: s.ad_soyad || "—", sub: `${s.sifaris_say} sifariş`, value: formatMoney(s.cemi), onPress: () => go("/team") }))} />
      <TopList Icon={Users} color={C.brand} title="Top alıcı" emptyText="Hələ alıcı yoxdur"
        items={(customers ?? []).map((c) => ({ name: c.ad, sub: `${c.sifaris_say} alış${c.telefon ? ` · ${c.telefon}` : ""}`, value: formatMoney(c.cemi), onPress: () => go(`/musteri/${c.id}`) }))} />
      <TopList Icon={Activity} color={GREEN} title="Top platforma" emptyText="Hələ satış kanalı yoxdur"
        items={(platforms ?? []).map((p) => ({ name: p.platform, sub: `${p.sifaris_say} sifariş`, value: formatMoney(p.cemi), onPress: () => go("/(tabs)/satis") }))} />
    </View>
  );
}

// ── 10) Top borclular ──────────────────────────────────────────────────────────
export function TopDebtorsCard({ debtors, go }: { debtors: TopDebtorRow[]; go: Go }) {
  const total = debtors.reduce((s, d) => s + d.borc, 0);
  return (
    <View style={{ ...cardBase, padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: withA(AMBER, 0.15), alignItems: "center", justifyContent: "center" }}>
            <Wallet size={16} color={AMBER700} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.ink, fontSize: 14, fontWeight: "600" }}>Top borclu müştərilər</Text>
            <Text style={{ color: C.sub, fontSize: 10.5 }} numberOfLines={1}>{debtors.length > 0 ? `Cəmi açıq borc: ${formatMoney(total)}` : "Aktiv borc yoxdur"}</Text>
          </View>
        </View>
        <Pressable onPress={() => go("/maliyye")} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Text style={{ color: C.brand, fontSize: 11, fontWeight: "600" }}>Hamısı</Text>
          <ChevronRight size={12} color={C.brand} />
        </Pressable>
      </View>
      {debtors.length === 0 ? (
        <View style={{ borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: C.line, paddingVertical: 18, alignItems: "center" }}>
          <Text style={{ color: C.sub, fontSize: 12 }}>🎉 Açıq müştəri borcu yoxdur</Text>
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          {debtors.map((d) => {
            const col = d.gecikme_gun >= 90 ? ROSE : d.gecikme_gun >= 30 ? AMBER : null;
            return (
              <Pressable key={d.id} onPress={() => go(`/musteri/${d.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: col ? withA(col, 0.4) : C.line, backgroundColor: col ? withA(col, 0.1) : C.surface2 })}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>{d.ad}</Text>
                  <Text style={{ color: C.sub, fontSize: 10 }} numberOfLines={1}>
                    {d.acig_say} açıq sənəd{d.gecikme_gun > 0 ? ` · ${d.gecikme_gun} gün gecikmə` : ""}{d.telefon ? ` · ${d.telefon}` : ""}
                  </Text>
                </View>
                <Text style={{ color: AMBER700, fontSize: 13, fontWeight: "800", ...NUM }}>{formatMoney(d.borc)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
