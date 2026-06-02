import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Package,
  Users,
  Image as ImageIcon,
  Tag,
  Coins,
  Clock,
  ArrowRight,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsTopNav } from "@/features/ayar/components/settings-top-nav";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Data sağlamlığı" };
export const dynamic = "force-dynamic";

type Check = {
  key: string;
  label: string;
  description: string;
  count: number;
  total: number;
  link?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "danger" | "warning" | "info" | "success";
};

async function runHealthChecks(): Promise<Check[]> {
  return withTenant(async () => {
    const [
      totalProducts,
      missingBarcode,
      missingImage,
      zeroPrice,
      zeroCost,
      totalContacts,
      duplicatePhone,
      contactsNoEmailOrPhone,
      deadStock60d,
      sales90dWithoutKassa,
    ] = await Promise.all([
      prisma.mehsullar.count({ where: { aktiv: true } }),
      prisma.mehsullar.count({ where: { aktiv: true, OR: [{ barkod: null }, { barkod: "" }] } }),
      prisma.mehsullar.count({ where: { aktiv: true, OR: [{ sekil_url: null }, { sekil_url: "" }] } }),
      prisma.mehsullar.count({ where: { aktiv: true, satis_qiymeti: { lte: 0 } } }),
      prisma.mehsullar.count({ where: { aktiv: true, alish_qiymeti: { lte: 0 } } }),
      prisma.kontragentler.count({ where: { aktiv: true } }),
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM (
          SELECT telefon FROM kontragentler
          WHERE aktiv = TRUE AND telefon IS NOT NULL AND telefon != ''
          GROUP BY telefon
          HAVING COUNT(*) > 1
        ) t
      `.then((r) => r[0]?.count ?? 0).catch(() => 0),
      prisma.kontragentler.count({
        where: { aktiv: true, AND: [{ OR: [{ telefon: null }, { telefon: "" }] }, { OR: [{ email: null }, { email: "" }] }] },
      }),
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM mehsullar m
        WHERE m.aktiv = TRUE
          AND NOT EXISTS (
            SELECT 1 FROM satis_sifaris_satirlari sls
            JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
            WHERE sls.mehsul_id = m.id
              AND ss.tarix >= CURRENT_DATE - INTERVAL '60 days'
              AND ss.status != 'legv'
          )
          AND COALESCE((SELECT SUM(s.miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) > 0
      `.then((r) => r[0]?.count ?? 0).catch(() => 0),
      prisma.satis_sifarisleri.count({
        where: {
          tarix: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
          kassa_id: null,
          odenis_nov: { not: "nisye" },
          status: { not: "legv" },
        },
      }).catch(() => 0),
    ]);

    return [
      { key: "no_barcode", label: "Barkodsuz məhsullar", description: "POS-da skanetmə üçün barkod tələb olunur", count: missingBarcode, total: totalProducts, link: "/anbar/mehsullar?filter=no_barcode", icon: Tag, tone: missingBarcode > 0 ? "warning" : "success" },
      { key: "no_image", label: "Şəkilsiz məhsullar", description: "POS və marketplace üçün şəkil vacibdir", count: missingImage, total: totalProducts, link: "/anbar/mehsullar?filter=no_image", icon: ImageIcon, tone: missingImage > 0 ? "info" : "success" },
      { key: "zero_price", label: "Qiyməti 0 olan məhsullar", description: "Bunlar satıla bilməz — qiymət tələb olunur", count: zeroPrice, total: totalProducts, link: "/anbar/mehsullar?filter=zero_price", icon: Coins, tone: zeroPrice > 0 ? "danger" : "success" },
      { key: "zero_cost", label: "Mayası 0 olan məhsullar", description: "Mənfəət düzgün hesablana bilmir", count: zeroCost, total: totalProducts, link: "/anbar/mehsullar?filter=zero_cost", icon: Coins, tone: zeroCost > 0 ? "warning" : "success" },
      { key: "dead_stock", label: "60+ gün satılmayan", description: "Ölü stok riski — endirim və ya çıxarış", count: deadStock60d, total: totalProducts, link: "/hesabatlar/satilmayan", icon: Clock, tone: deadStock60d > 5 ? "warning" : "info" },
      { key: "dup_phone", label: "Dublikat telefon nömrəsi", description: "Eyni telefon ilə bir neçə müştəri qeydi", count: duplicatePhone, total: totalContacts, link: "/elaqe?duplicate=phone", icon: Users, tone: duplicatePhone > 0 ? "warning" : "success" },
      { key: "no_contact", label: "Əlaqəsiz kontragent", description: "Nə telefon, nə email — əlaqə qurmaq mümkün deyil", count: contactsNoEmailOrPhone, total: totalContacts, link: "/elaqe?filter=no_contact", icon: Users, tone: contactsNoEmailOrPhone > 0 ? "info" : "success" },
      { key: "sale_no_kassa", label: "Kassa olmayan satışlar (90 gün)", description: "Pul axını hesablamasından kənar qala bilər", count: sales90dWithoutKassa, total: 0, link: "/ticaret/satislar?filter=no_kassa", icon: Package, tone: sales90dWithoutKassa > 0 ? "warning" : "success" },
    ];
  });
}

export default async function Page() {
  const checks = await runHealthChecks();
  const problems = checks.filter((c) => c.count > 0);
  const totalProblems = problems.reduce((s, c) => s + c.count, 0);
  const score = checks.length > 0 ? Math.round((checks.filter((c) => c.tone === "success").length / checks.length) * 100) : 100;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackButton fallback="/ayarlar" label="Tənzimləmələr" />

      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tənzimləmələr</div>
          <h1 className="text-2xl font-bold tracking-tight">Data sağlamlığı</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mövcud datanızın keyfiyyəti — dublikat, natamam, anomaliyalı qeydlər.
          </p>
        </div>
      </header>

      <SettingsTopNav />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className={cn("glass", score >= 90 ? "border-emerald-500/40" : score >= 70 ? "border-amber-500/40" : "border-rose-500/40")}>
          <CardContent className="py-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Sağlamlıq skoru</div>
            <div className={cn("mt-1 text-3xl font-bold tabular-nums", score >= 90 ? "text-emerald-600" : score >= 70 ? "text-amber-600" : "text-rose-600")}>
              {score}%
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {score >= 90 ? "Əla — datanız təmizdir" : score >= 70 ? "Yaxşı — bir neçə düzəliş gərəkdir" : "Diqqət — kritik problemlər var"}
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="py-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Problemli yoxlama</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{problems.length}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {checks.length} yoxlamadan
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="py-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Cəmi problem qeydi</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{totalProblems.toLocaleString("az-AZ")}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              düzəldilməli qeyd
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardContent className="divide-y divide-border/30 p-0">
          {checks.map((c) => (
            <CheckRow key={c.key} check={c} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CheckRow({ check }: { check: Check }) {
  const Icon = check.icon;
  const ratio = check.total > 0 ? (check.count / check.total) * 100 : 0;
  const content = (
    <div className="flex items-center gap-3 px-4 py-3 transition hover:bg-secondary/30">
      <div className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
        check.tone === "success" && "bg-emerald-500/10 text-emerald-600",
        check.tone === "warning" && "bg-amber-500/10 text-amber-600",
        check.tone === "info" && "bg-sky-500/10 text-sky-600",
        check.tone === "danger" && "bg-rose-500/10 text-rose-600",
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{check.label}</span>
          {check.tone === "success" ? (
            <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-600">təmiz</Badge>
          ) : (
            <Badge variant="outline" className={cn(
              "text-[10px]",
              check.tone === "warning" && "border-amber-500/40 text-amber-600",
              check.tone === "info" && "border-sky-500/40 text-sky-600",
              check.tone === "danger" && "border-rose-500/40 text-rose-600",
            )}>
              {check.count.toLocaleString("az-AZ")} qeyd
              {check.total > 0 && ` (${ratio.toFixed(1)}%)`}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{check.description}</div>
      </div>
      {check.tone !== "success" && check.link && (
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
  if (check.tone === "success" || !check.link) return content;
  return <Link href={check.link}>{content}</Link>;
}
