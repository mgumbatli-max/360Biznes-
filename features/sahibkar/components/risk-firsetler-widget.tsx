import Link from "next/link";
import {
  Cake, UserX, AlertTriangle, Package, ShieldCheck, ArrowRight, Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getUpcomingBirthdays } from "@/features/elaqe/birthday-queries";
import { getInaktivMusteriler } from "@/features/elaqe/inaktiv-queries";

type Insight = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  label: string;
  count: number;
  desc: string;
  href: string;
  priority: "kritik" | "yuxsek" | "orta" | "asagi";
};

async function loadInsights(): Promise<Insight[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff60 = new Date(today);
    cutoff60.setDate(cutoff60.getDate() - 60);

    const [bdays, inaktivAll, highDebt, lowStock, pendingTesdiq] = await Promise.all([
      getUpcomingBirthdays(0).catch(() => []),  // yalnız bu gün
      getInaktivMusteriler(60).catch(() => []),
      prisma.kontragentler.count({
        where: { sahibkar_id: sahibkarId, aktiv: true, borc: { gte: 1000 } },
      }),
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*)::bigint AS c
          FROM stok s
          JOIN mehsullar m ON m.id = s.mehsul_id
         WHERE s.sahibkar_id = ${sahibkarId}::uuid
           AND m.kritik_stok IS NOT NULL
           AND m.kritik_stok > 0
           AND COALESCE(s.miqdar, 0) <= m.kritik_stok
      `.catch(() => [{ c: BigInt(0) }]),
      prisma.tesdiq_telep.count({ where: { sahibkar_id: sahibkarId, status: "gozleyir" } }).catch(() => 0),
    ]);

    const vipItirilen = inaktivAll.filter((r) => r.rfm_seviyye === "vip").length;
    const allInaktiv = inaktivAll.length;

    const insights: Insight[] = [];
    if (bdays.length > 0) {
      insights.push({
        key: "dogum",
        icon: Cake,
        iconColor: "text-pink-500",
        label: "Bu gün doğum günü",
        count: bdays.length,
        desc: bdays.map((b) => b.ad).slice(0, 3).join(", ") + (bdays.length > 3 ? "..." : ""),
        href: "/elaqe/dogum-gunu",
        priority: bdays.length > 2 ? "yuxsek" : "orta",
      });
    }
    if (vipItirilen > 0) {
      insights.push({
        key: "vip_itiren",
        icon: UserX,
        iconColor: "text-amber-500",
        label: "VIP müştəri itirilməkdə",
        count: vipItirilen,
        desc: "60 günə qədər almayıb — təcili qaytar mesajı",
        href: "/elaqe/inaktiv?min=60",
        priority: "kritik",
      });
    }
    if (allInaktiv > vipItirilen) {
      insights.push({
        key: "inaktiv",
        icon: UserX,
        iconColor: "text-rose-500",
        label: "İnaktiv müştəri",
        count: allInaktiv,
        desc: "60+ gün almayanlar — re-engagement",
        href: "/elaqe/inaktiv",
        priority: "orta",
      });
    }
    if (Number(highDebt) > 0) {
      insights.push({
        key: "borc",
        icon: AlertTriangle,
        iconColor: "text-rose-500",
        label: "Yüksək borc müştəri",
        count: Number(highDebt),
        desc: "1000+ ₼ borc — xatırlatma göndər",
        href: "/elaqe/borclar",
        priority: "yuxsek",
      });
    }
    const lowStockCount = Number(lowStock[0]?.c ?? 0);
    if (lowStockCount > 0) {
      insights.push({
        key: "stok",
        icon: Package,
        iconColor: "text-amber-500",
        label: "Kritik stok",
        count: lowStockCount,
        desc: "Stok kritik səviyyədə — sifariş ver",
        href: "/anbar/mehsullar?stock=low",
        priority: lowStockCount > 10 ? "yuxsek" : "orta",
      });
    }
    if (pendingTesdiq > 0) {
      insights.push({
        key: "tesdiq",
        icon: ShieldCheck,
        iconColor: "text-violet-500",
        label: "Təsdiq gözləyir",
        count: pendingTesdiq,
        desc: "Sənin baxışını gözləyən sorğular",
        href: "/tesdiq",
        priority: pendingTesdiq > 5 ? "yuxsek" : "orta",
      });
    }

    // Prioritetə görə sırala
    const priority = { kritik: 0, yuxsek: 1, orta: 2, asagi: 3 };
    insights.sort((a, b) => priority[a.priority] - priority[b.priority]);
    return insights;
  });
}

const PRIORITY_CLS: Record<Insight["priority"], string> = {
  kritik: "border-rose-500/40 bg-rose-500/10",
  yuxsek: "border-amber-500/40 bg-amber-500/10",
  orta: "border-border bg-card/40",
  asagi: "border-border/40 bg-secondary/20",
};

const PRIORITY_LABEL: Record<Insight["priority"], string> = {
  kritik: "Kritik",
  yuxsek: "Yüksək",
  orta: "Orta",
  asagi: "Aşağı",
};

/**
 * Sahibkar üçün "Risk və Fürsətlər" mərkəzi widget.
 * Bütün modullardan ən vacib məlumatları toplayır, prioritetlərə görə göstərir.
 */
export async function RiskFirsetlerWidget() {
  const insights = await loadInsights();

  return (
    <Card className="glass border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Risk və Fürsətlər
          <Badge variant="outline" className="ml-auto text-[10px]">
            {insights.length} aktiv
          </Badge>
        </CardTitle>
        <p className="text-[10.5px] text-muted-foreground">
          Diqqət lazım olan işlər — prioritetə görə sıralanıb
        </p>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {insights.length === 0 ? (
          <div className="py-6 text-center">
            <Sparkles className="mx-auto mb-2 h-8 w-8 text-emerald-500/40" />
            <p className="text-xs font-semibold">Hər şey qaydasındadır 🎉</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Heç bir təcili məsələ yoxdur
            </p>
          </div>
        ) : (
          insights.map((i) => {
            const Icon = i.icon;
            return (
              <Link
                key={i.key}
                href={i.href}
                className={`group flex items-center gap-3 rounded-md border px-3 py-2 transition hover:border-primary/40 hover:bg-secondary/30 ${PRIORITY_CLS[i.priority]}`}
              >
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card ${i.iconColor}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-bold">{i.label}</span>
                    <span className="text-base font-bold tabular-nums">{i.count}</span>
                    <Badge variant="outline" className={`text-[9px] ${i.priority === "kritik" ? "border-rose-500/40 text-rose-600" : i.priority === "yuxsek" ? "border-amber-500/40 text-amber-600" : ""}`}>
                      {PRIORITY_LABEL[i.priority]}
                    </Badge>
                  </div>
                  <p className="truncate text-[10.5px] text-muted-foreground">{i.desc}</p>
                </div>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
