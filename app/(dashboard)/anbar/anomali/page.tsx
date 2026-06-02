import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, PackageX, ScanBarcode, Boxes, ImageOff, FolderOpen, Copy, CheckCircle2, Sparkles, ArrowRight, Coins, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { formatNumber } from "@/lib/utils";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { ProductInline } from "@/features/anbar/components/product-inline";
import { BarcodeFix, CostFix, SalePriceFix, ImageFix } from "@/features/anbar/components/quick-fix-cells";

export const metadata: Metadata = { title: "Anomaliyalar" };

type SimpleProduct = { id: string; ad: string; kod: string | null; sekil_url?: string | null; barkod?: string | null };

async function getAnomalies() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const [
      negStok,
      sifirStok,
      mayasizCount, mayasizList,
      barkodsuzCount, barkodsuzList,
      qiymetsizCount, qiymetsizList,
      sekilsizCount, sekilsizList,
      kateqorisiz, kateqorisizCount,
      dublikatList,
    ] = await Promise.all([
      // Negative stock (sistem xətası)
      prisma.$queryRaw<{ id: string; ad: string; kod: string | null; anbar: string; miqdar: number }[]>`
        SELECT m.id::text, m.ad, m.kod, a.ad AS anbar, s.miqdar::float
          FROM stok s
          JOIN mehsullar m ON m.id = s.mehsul_id
          JOIN anbarlar a ON a.id = s.anbar_id
         WHERE s.sahibkar_id = ${sahibkarId}::uuid
           AND s.miqdar < 0
         ORDER BY s.miqdar
         LIMIT 30
      `,
      // Out of stock
      prisma.$queryRaw<{ id: string; ad: string; kod: string | null }[]>`
        SELECT m.id::text, m.ad, m.kod
          FROM mehsullar m
         WHERE m.sahibkar_id = ${sahibkarId}::uuid AND m.aktiv = TRUE
           AND COALESCE((SELECT SUM(miqdar) FROM stok s WHERE s.mehsul_id = m.id), 0) <= 0
         LIMIT 30
      `,
      // Without cost (alish_qiymeti = 0 / null)
      prisma.mehsullar.count({
        where: { aktiv: true, OR: [{ alish_qiymeti: 0 }, { alish_qiymeti: null }] },
      }),
      prisma.mehsullar.findMany({
        where: { aktiv: true, OR: [{ alish_qiymeti: 0 }, { alish_qiymeti: null }] },
        select: { id: true, ad: true, kod: true },
        orderBy: { ad: "asc" },
        take: 20,
      }),
      // Without barcode
      prisma.mehsullar.count({
        where: { aktiv: true, barkod: null, mehsul_barkodlar: { none: {} } },
      }),
      prisma.mehsullar.findMany({
        where: { aktiv: true, barkod: null, mehsul_barkodlar: { none: {} } },
        select: { id: true, ad: true, kod: true, barkod: true },
        orderBy: { ad: "asc" },
        take: 20,
      }),
      // Without sale price
      prisma.mehsullar.count({
        where: { aktiv: true, OR: [{ satis_qiymeti: 0 }, { satis_qiymeti: null }] },
      }),
      prisma.mehsullar.findMany({
        where: { aktiv: true, OR: [{ satis_qiymeti: 0 }, { satis_qiymeti: null }] },
        select: { id: true, ad: true, kod: true },
        orderBy: { ad: "asc" },
        take: 20,
      }),
      // Without image
      prisma.mehsullar.count({
        where: { aktiv: true, OR: [{ sekil_url: null }, { sekil_url: "" }] },
      }),
      prisma.mehsullar.findMany({
        where: { aktiv: true, OR: [{ sekil_url: null }, { sekil_url: "" }] },
        select: { id: true, ad: true, kod: true, sekil_url: true },
        orderBy: { ad: "asc" },
        take: 20,
      }),
      // Without category
      prisma.mehsullar.findMany({
        where: { aktiv: true, kateqoriya_id: null },
        select: { id: true, ad: true, kod: true },
        orderBy: { ad: "asc" },
        take: 20,
      }),
      prisma.mehsullar.count({ where: { aktiv: true, kateqoriya_id: null } }),
      // Duplicate by name
      prisma.$queryRaw<{ ad: string; n: bigint }[]>`
        SELECT LOWER(TRIM(ad)) AS ad, COUNT(*)::bigint AS n
          FROM mehsullar
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND aktiv = TRUE
         GROUP BY LOWER(TRIM(ad))
         HAVING COUNT(*) > 1
         ORDER BY n DESC
         LIMIT 15
      `,
    ]);

    return {
      negStok,
      sifirStok,
      mayasiz: { count: mayasizCount, list: mayasizList as SimpleProduct[] },
      barkodsuz: { count: barkodsuzCount, list: barkodsuzList as SimpleProduct[] },
      qiymetsiz: { count: qiymetsizCount, list: qiymetsizList as SimpleProduct[] },
      sekilsiz: { count: sekilsizCount, list: sekilsizList as SimpleProduct[] },
      kateqorisiz: { count: kateqorisizCount, list: kateqorisiz as SimpleProduct[] },
      dublikat: dublikatList.map((d) => ({ ad: d.ad, n: Number(d.n) })),
    };
  });
}

export default async function AnomaliPage() {
  const { requireAnbarPerm } = await import("@/features/anbar/access-guard");
  await requireAnbarPerm("anbar.anomali");

  const a = await getAnomalies();
  const negStokCount = a.negStok.length;

  return (
    <div className="mx-auto max-w-6xl">
      <AnbarSubNav active="/anbar/anomali" />
      <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Anomaliyalar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Anbarda aşkar olunmuş problemlər və natamam məlumat.</p>
      </header>

      {/* Problem kartları — yalnız >0 olanlar, miqdar üzrə azalan sıralanır */}
      {(() => {
        type Problem = {
          key: string;
          icon: typeof AlertTriangle;
          label: string;
          count: number;
          tone: "danger" | "warning";
          desc: string;
          href?: string;
        };
        const all: Problem[] = [
          { key: "neg",   icon: AlertTriangle, label: "Mənfi stok",   count: negStokCount,       tone: "danger",  desc: "Sistem xətası",                href: "/anbar/mehsullar?stok_status=yox" },
          { key: "sifir", icon: PackageX,      label: "Stoku bitmiş", count: a.sifirStok.length, tone: "danger",  desc: "Sıfır miqdar",                  href: "/anbar/hesabat?mod=stoksuz" },
          { key: "sek",   icon: ImageOff,      label: "Şəkilsiz",     count: a.sekilsiz.count,   tone: "warning", desc: "Məhsul şəkili yox",            href: "/anbar/hesabat?mod=sekilsiz" },
          { key: "bk",    icon: ScanBarcode,   label: "Barkodsuz",    count: a.barkodsuz.count,  tone: "warning", desc: "Barkod yoxdur",                href: "/anbar/hesabat?mod=barkodsuz" },
          { key: "maya",  icon: Coins,         label: "Mayasız",      count: a.mayasiz.count,    tone: "warning", desc: "Alış qiyməti yox",             href: "/anbar/hesabat?mod=mayasiz" },
          { key: "qiy",   icon: Circle,        label: "Qiyməti yox",  count: a.qiymetsiz.count,  tone: "warning", desc: "Satış qiyməti 0",              href: "/anbar/hesabat?mod=qiymetsiz" },
          { key: "kat",   icon: FolderOpen,    label: "Kateqoriyasız",count: a.kateqorisiz.count,tone: "warning", desc: "Kateqoriya təyin edilməyib" },
          { key: "dup",   icon: Copy,          label: "Dublikat ad",  count: a.dublikat.length,  tone: "warning", desc: "Eyni adlı məhsullar" },
        ];
        const active = all.filter((p) => p.count > 0).sort((x, y) => y.count - x.count);

        if (active.length === 0) {
          return (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-emerald-700 dark:text-emerald-300">Heç bir problem aşkarlanmadı</div>
                <div className="text-xs text-muted-foreground">Bütün məhsullar şəkil, barkod, maya, qiymət və kateqoriya ilə tam doldurulub.</div>
              </div>
            </div>
          );
        }

        return (
          <>
            {/* AI Bulk Fix banner — yalnız şəkilsizlər çox olduqda */}
            {a.sekilsiz.count > 50 && (
              <Link
                href="/anbar/anomali/bulk-fix"
                className="group flex items-center gap-3 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 transition hover:border-primary/50"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-primary">AI ilə bulk şəkil yarat</div>
                  <div className="text-xs text-muted-foreground">
                    {a.sekilsiz.count} şəkilsiz məhsul üçün AI-dən şəkil yarat — bir dəfəlik wizard ilə hamısı 5 dəqiqəyə hazır olur
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-primary transition group-hover:translate-x-1" />
              </Link>
            )}

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {active.map((p) => (
                <ProblemCard
                  key={p.key}
                  icon={p.icon}
                  label={p.label}
                  count={p.count}
                  tone={p.tone}
                  desc={p.desc}
                  href={p.href}
                />
              ))}
            </section>

            {/* Show "all clean" indicator for the rest */}
            {all.length - active.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {all.length - active.length} kateqoriyada heç bir problem yoxdur.
              </div>
            )}
          </>
        );
      })()}

      {negStokCount > 0 && (
        <Card className="glass border-danger/30">
          <CardContent className="space-y-2 py-4">
            <h3 className="font-semibold text-danger flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Mənfi stok ({negStokCount}) — təcili düzəlişlik tələb edir
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-sticky-head>
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Məhsul</th>
                    <th className="px-3 py-2">Anbar</th>
                    <th className="px-3 py-2 text-right">Miqdar</th>
                  </tr>
                </thead>
                <tbody>
                  {a.negStok.map((p) => (
                    <tr key={`${p.id}-${p.anbar}`} className="border-b border-border/30">
                      <td className="px-3 py-2">
                        <ProductInline
                          id={p.id}
                          ad={p.ad}
                          kod={p.kod}
                          showImage={false}
                          size="xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-xs">{p.anbar}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-danger">
                        {formatNumber(p.miqdar, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProblemList title="Stoku bitmiş məhsullar" icon={PackageX} items={a.sifirStok.slice(0, 15)} link="/anbar/mehsullar?stok_status=yox" />

        {a.kateqorisiz.list.length > 0 && (
          <ProblemList
            title="Kateqoriyasız məhsullar"
            icon={FolderOpen}
            items={a.kateqorisiz.list}
            link="/anbar/mehsullar?kateq=null"
          />
        )}
      </div>

      {a.barkodsuz.list.length > 0 && (
        <FixList
          title="Barkodsuz məhsullar"
          icon={ScanBarcode}
          desc="Aşağıda hər sətrdə barkodu daxil edin və ya Avto yarat ilə EAN-13 generasiya edin."
          link="/anbar/hesabat?mod=barkodsuz"
          rows={a.barkodsuz.list.map((p) => ({
            id: p.id,
            ad: p.ad,
            kod: p.kod,
            fix: <BarcodeFix id={p.id} current={p.barkod ?? null} compact />,
          }))}
        />
      )}

      {a.mayasiz.list.length > 0 && (
        <FixList
          title="Mayasız məhsullar"
          icon={Boxes}
          desc="Maya (alış) qiyməti təyin edilməyən məhsullar. Düz qiymət hesabat və marja üçün vacibdir."
          link="/anbar/hesabat?mod=mayasiz"
          rows={a.mayasiz.list.map((p) => ({
            id: p.id,
            ad: p.ad,
            kod: p.kod,
            fix: <CostFix id={p.id} current={0} />,
          }))}
        />
      )}

      {a.qiymetsiz.list.length > 0 && (
        <FixList
          title="Qiymətsiz məhsullar"
          icon={ImageOff}
          desc="Satış qiyməti təyin edilməyən məhsullar — POS-da satılmır."
          link="/anbar/hesabat?mod=qiymetsiz"
          rows={a.qiymetsiz.list.map((p) => ({
            id: p.id,
            ad: p.ad,
            kod: p.kod,
            fix: <SalePriceFix id={p.id} current={0} />,
          }))}
        />
      )}

      {a.sekilsiz.list.length > 0 && (
        <FixList
          title="Şəkilsiz məhsullar"
          icon={ImageOff}
          desc="Şəkili olmayan məhsullar — URL yapışdır, yüklə və ya AI generasiya."
          link="/anbar/hesabat?mod=sekilsiz"
          rows={a.sekilsiz.list.map((p) => ({
            id: p.id,
            ad: p.ad,
            kod: p.kod,
            fix: <ImageFix id={p.id} productName={p.ad} current={p.sekil_url ?? null} />,
          }))}
        />
      )}

      {a.dublikat.length > 0 && (
        <Card className="glass border-warning/30">
          <CardContent className="space-y-2 py-4">
            <h3 className="font-semibold text-warning flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Dublikat adlı məhsullar
            </h3>
            <p className="text-xs text-muted-foreground">Eyni adda təkrarlanan məhsulları yoxlayın — birləşdirin və ya fərqləndirin.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-sticky-head>
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Ad</th>
                    <th className="px-3 py-2 text-right">Təkrar sayı</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {a.dublikat.map((d) => (
                    <tr key={d.ad} className="border-b border-border/30">
                      <td className="px-3 py-2 font-medium">{d.ad}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-warning">{d.n}</td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/anbar/mehsullar?q=${encodeURIComponent(d.ad)}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Yoxla →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}

function ProblemCard({
  icon: Icon, label, count, tone, desc, href,
}: { icon: React.ComponentType<{ className?: string }>; label: string; count: number; tone: "danger" | "warning"; desc: string; href?: string }) {
  const cls = tone === "danger" ? "text-danger" : "text-warning";
  const body = (
    <Card className={`glass ${href ? "cursor-pointer transition hover:border-border-hi hover:bg-secondary/40" : ""}`}>
      <CardContent className="space-y-1 py-4 text-center">
        <Icon className={`mx-auto h-5 w-5 ${cls}`} />
        <div className={`text-2xl font-bold tabular-nums ${count > 0 ? cls : ""}`}>{count}</div>
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground">{desc}</div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

function ProblemList({
  title, icon: Icon, items, link,
}: { title: string; icon: React.ComponentType<{ className?: string }>; items: { id: string; ad: string; kod: string | null }[]; link: string }) {
  if (items.length === 0) return null;
  return (
    <Card className="glass">
      <CardContent className="space-y-2 py-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4" /> {title}
        </h3>
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/anbar/mehsullar/${p.id}`}
              className="block rounded-md border border-border/40 bg-secondary/30 px-2 py-1.5 text-sm transition hover:bg-secondary"
            >
              {p.ad}
              {p.kod && <span className="ml-2 text-xs text-muted-foreground font-mono">{p.kod}</span>}
            </Link>
          ))}
        </div>
        <Link href={link} className="block pt-2 text-xs text-primary-light hover:underline">
          Hamısını gör →
        </Link>
      </CardContent>
    </Card>
  );
}

function FixList({
  title, icon: Icon, desc, link, rows,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  desc?: string;
  link: string;
  rows: { id: string; ad: string; kod: string | null; fix: React.ReactNode }[];
}) {
  if (rows.length === 0) return null;
  return (
    <Card className="glass">
      <CardContent className="space-y-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Icon className="h-4 w-4 text-warning" /> {title}
              <Badge variant="outline" className="text-[10px]">{rows.length}</Badge>
            </h3>
            {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
          </div>
          <Link href={link} className="shrink-0 text-xs text-primary-light hover:underline">
            Hamısı →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-sticky-head>
            <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Məhsul</th>
                <th className="px-3 py-2 text-right">Sürətli düzəliş</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-border/30">
                  <td className="px-3 py-2">
                    <ProductInline
                      id={p.id}
                      ad={p.ad}
                      kod={p.kod}
                      showImage={false}
                      size="xs"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">{p.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
