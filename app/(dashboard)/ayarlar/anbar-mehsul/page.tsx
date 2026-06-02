import type { Metadata } from "next";
import Link from "next/link";
import { Package, Ruler, Tag, Printer, Sparkles, ArrowRight, FileText } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsTopNav } from "@/features/ayar/components/settings-top-nav";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export const metadata: Metadata = { title: "Anbar / Məhsul ayarları" };
export const dynamic = "force-dynamic";

async function getCounts() {
  return withTenant(async () => {
    const [mehsulTipleri, olcuVahidleri, barkodTipleri, etiketSablonu, customFields] = await Promise.all([
      prisma.mehsul_tipleri.findMany({ select: { id: true, ad: true, aktiv: true } }).catch(() => []),
      prisma.olcu_vahidleri.findMany({ select: { id: true, ad: true, qisa: true, aktiv: true } }).catch(() => []),
      prisma.barkod_tipleri.findMany({ select: { id: true, ad: true, kod: true } }).catch(() => []),
      prisma.etiket_sablonu.findMany({ select: { id: true, ad: true, en_mm: true, hund_mm: true } }).catch(() => []),
      prisma.mehsul_custom_field.findMany({ select: { id: true, ad: true, tip: true, aktiv: true } }).catch(() => []),
    ]);
    return { mehsulTipleri, olcuVahidleri, barkodTipleri, etiketSablonu, customFields };
  });
}

export default async function Page() {
  const { mehsulTipleri, olcuVahidleri, barkodTipleri, etiketSablonu, customFields } = await getCounts();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <BackButton fallback="/ayarlar" label="Tənzimləmələr" />

      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-600">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tənzimləmələr</div>
          <h1 className="text-2xl font-bold tracking-tight">Anbar / Məhsul ayarları</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Məhsul tipləri, ölçü vahidləri, barkod formatları və etiket çap şablonları.
          </p>
        </div>
      </header>

      <SettingsTopNav />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CatalogCard
          icon={Sparkles}
          tone="violet"
          title="Məhsul tipləri"
          desc="Fiziki, xidmət, təhlükəli mal və s. — hər tip üçün stok/zəmanət davranışı"
          count={mehsulTipleri.length}
          activeCount={mehsulTipleri.filter((t) => t.aktiv !== false).length}
          items={mehsulTipleri.map((t) => t.ad).slice(0, 5)}
          href="/anbar"
          editHref="/anbar"
        />
        <CatalogCard
          icon={Ruler}
          tone="sky"
          title="Ölçü vahidləri"
          desc="Ədəd, kq, qr, litr, m, m² və s. — məhsul üçün əsas vahid"
          count={olcuVahidleri.length}
          activeCount={olcuVahidleri.filter((u) => u.aktiv !== false).length}
          items={olcuVahidleri.map((u) => `${u.ad}${u.qisa ? ` (${u.qisa})` : ""}`).slice(0, 5)}
          href="/anbar"
          editHref="/anbar"
        />
        <CatalogCard
          icon={Tag}
          tone="emerald"
          title="Barkod tipləri"
          desc="EAN-13, Code128, QR — avto-generasiya formatı"
          count={barkodTipleri.length}
          activeCount={barkodTipleri.length}
          items={barkodTipleri.map((b) => `${b.ad}${b.kod ? ` — ${b.kod}` : ""}`).slice(0, 5)}
          href="/anbar"
          editHref="/anbar"
        />
        <CatalogCard
          icon={Printer}
          tone="rose"
          title="Etiket çap şablonları"
          desc="A4, termo printer (50x30, 40x30 mm) — barkod çap üçün"
          count={etiketSablonu.length}
          activeCount={etiketSablonu.length}
          items={etiketSablonu.map((e) => `${e.ad}${e.en_mm && e.hund_mm ? ` — ${e.en_mm}×${e.hund_mm}mm` : ""}`).slice(0, 5)}
          href="/anbar/etiket-cap"
          editHref="/anbar/etiket-cap"
        />
        <CatalogCard
          icon={FileText}
          tone="amber"
          title="Custom field-lər"
          desc="Məhsula əlavə özünüz təyin etdiyiniz xüsusiyyət sahələri"
          count={customFields.length}
          activeCount={customFields.filter((f) => f.aktiv !== false).length}
          items={customFields.map((f) => `${f.ad} (${f.tip})`).slice(0, 5)}
          href="/anbar"
          editHref="/anbar"
        />
      </div>

      <Card className="glass">
        <CardContent className="space-y-2 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Əlaqəli ayarlar</div>
          <RelatedLink href="/anbar/kateqoriyalar" label="Kateqoriyalar" desc="Məhsul ağacı və yarımkateqoriyalar" />
          <RelatedLink href="/anbar/markalar" label="Markalar" desc="Brand kataloqu və logo" />
          <RelatedLink href="/ayarlar/qiymet-tipi" label="Qiymət tipləri" desc="POS, topdan, partnyor, VIP qiymət strategiyası" />
          <RelatedLink href="/ayarlar/qiymet" label="Qiymət qaydaları" desc="Maya əsaslı avto-qiymət formulları" />
          <RelatedLink href="/ayarlar/satis-hedef" label="Satış hədəfləri" desc="Aylıq satış məqsədləri və KPI" />
        </CardContent>
      </Card>
    </div>
  );
}

function CatalogCard({
  icon: Icon,
  tone,
  title,
  desc,
  count,
  activeCount,
  items,
  href,
  editHref,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  desc: string;
  count: number;
  activeCount: number;
  items: string[];
  href: string;
  editHref: string;
}) {
  return (
    <Card className="glass">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start gap-2">
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-${tone}-500/15 text-${tone}-600`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{title}</div>
            <p className="text-[11.5px] text-muted-foreground">{desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline" className="text-[10.5px]">{count} qeyd</Badge>
          {activeCount !== count && (
            <Badge variant="outline" className="border-emerald-500/40 text-[10.5px] text-emerald-600">
              {activeCount} aktiv
            </Badge>
          )}
        </div>
        {items.length > 0 && (
          <div className="space-y-0.5 text-xs">
            {items.map((it, i) => (
              <div key={i} className="truncate text-muted-foreground">
                <span className="text-foreground/30">•</span> {it}
              </div>
            ))}
          </div>
        )}
        <Link
          href={editHref}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:bg-secondary"
        >
          İdarə et <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

function RelatedLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md border border-border/30 px-3 py-2 transition hover:border-border hover:bg-secondary/30"
    >
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
