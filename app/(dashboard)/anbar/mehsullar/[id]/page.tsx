import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Package, Tag, Layers, Barcode, Hash, Building2, ChevronDown, ChevronUp,
  TrendingUp, Calendar, AlertTriangle, ShoppingCart, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, ClipboardCheck,
  Wrench, ArrowRight,
} from "lucide-react";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { StockAdjustDialog } from "@/features/anbar/components/stock-adjust-dialog";
import { ProductDialog } from "@/features/anbar/components/product-dialog";
import {
  getProductDetail,
  getStockByWarehouse,
  getStockMovements,
  getRecentSalesForProduct,
  getProductSalesStats,
  getProductDailySales,
} from "@/features/anbar/detail-queries";
import { ProductDailyChart } from "@/features/anbar/components/product-daily-chart";
import { getCategoryOptions, getBrandOptions } from "@/features/anbar/queries";
import { getServisHistoryForProduct } from "@/features/servis/queries";
import { SERVIS_STATUS_LABELS } from "@/features/servis/types";
import { ObjectTasksTab } from "@/features/tapshiriqlar/components/object-tasks-tab";
import { ListTodo, History } from "lucide-react";
import { getProductHistory, canDeleteHistory } from "@/features/anbar/product-history";
import { ProductHistoryTab } from "@/features/anbar/components/product-history-tab";
import { formatMoney, formatNumber, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Məhsul detayı" };
export const dynamic = "force-dynamic";

const MOVEMENT_LABEL: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  medaxil: { label: "Mədaxil", icon: ArrowDownToLine, tone: "text-success" },
  mexaric: { label: "Məxaric", icon: ArrowUpFromLine, tone: "text-danger" },
  transfer_giris: { label: "Transfer (giriş)", icon: ArrowLeftRight, tone: "text-info" },
  transfer_cixis: { label: "Transfer (çıxış)", icon: ArrowLeftRight, tone: "text-info" },
  inventar: { label: "İnventar düzəliş", icon: ClipboardCheck, tone: "text-warning" },
  qaytarma_giris: { label: "Qaytarma (giriş)", icon: ArrowDownToLine, tone: "text-warning" },
  qaytarma_cixis: { label: "Qaytarma (çıxış)", icon: ArrowUpFromLine, tone: "text-warning" },
};

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const [product, byWarehouse, movements, sales, stats, categories, brands, servisHistory, history, allowHistoryDelete, dailySales] = await Promise.all([
    getProductDetail(id),
    getStockByWarehouse(id),
    getStockMovements(id, 30),
    getRecentSalesForProduct(id, 15),
    getProductSalesStats(id),
    getCategoryOptions(),
    getBrandOptions(),
    getServisHistoryForProduct(id),
    getProductHistory(id, 100),
    canDeleteHistory(),
    getProductDailySales(id, 30),
  ]);

  if (!product) notFound();

  const totalStock = byWarehouse.reduce((s, w) => s + w.miqdar, 0);
  const stockValue = byWarehouse.reduce((s, w) => s + w.miqdar * Number(w.son_qiymet ?? product.alish_qiymeti ?? 0), 0);
  const margin = Number(product.alish_qiymeti ?? 0) > 0
    ? ((Number(product.satis_qiymeti ?? 0) - Number(product.alish_qiymeti ?? 0)) / Number(product.alish_qiymeti ?? 0)) * 100
    : 0;
  const lowStock = product.kritik_stok != null && Number(product.kritik_stok) > 0 && totalStock <= Number(product.kritik_stok);
  const outStock = totalStock <= 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/anbar/mehsullar"
            className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{product.ad}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {product.kod && <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" /><span className="font-mono">{product.kod}</span></span>}
              {product.barkod && <span className="inline-flex items-center gap-1"><Barcode className="h-3 w-3" /><span className="font-mono">{product.barkod}</span></span>}
              {product.kateqoriyalar && <Badge variant="outline" className="text-[10px]"><Layers className="h-3 w-3" /> {product.kateqoriyalar.ad}</Badge>}
              {product.markalar && <Badge variant="outline" className="text-[10px]"><Tag className="h-3 w-3" /> {product.markalar.ad}</Badge>}
              {!product.aktiv && <Badge variant="outline" className="text-[10px]">passiv</Badge>}
              {outStock && <Badge variant="destructive" className="text-[10px]">stok bitib</Badge>}
              {lowStock && !outStock && <Badge variant="secondary" className="bg-warning/15 text-warning text-[10px]">az stok</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {byWarehouse.length > 0 && (
            <StockAdjustDialog
              mehsulId={product.id}
              mehsulAd={product.ad}
              anbarlar={byWarehouse.map((w) => ({ id: w.anbar_id, ad: w.anbar_ad }))}
              currentStock={totalStock}
              trigger={<Button size="sm" variant="outline"><Package className="h-3.5 w-3.5" /> Stok düzəliş</Button>}
            />
          )}
          <ProductDialog
            categories={categories}
            brands={brands}
            initial={{
              id: product.id,
              ad: product.ad,
              kod: product.kod,
              barkod: product.barkod,
              kateqoriya_ad: product.kateqoriyalar?.ad ?? null,
              marka_ad: product.markalar?.ad ?? null,
              alish_qiymeti: Number(product.alish_qiymeti ?? 0),
              satis_qiymeti: Number(product.satis_qiymeti ?? 0),
              kritik_stok: product.kritik_stok != null ? Number(product.kritik_stok) : null,
            }}
            trigger="edit"
          />
        </div>
      </header>

      {/* KPI summary */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Package}
          label="Cəm stok"
          value={formatNumber(totalStock, 0)}
          subline={`Dəyər ${formatMoney(stockValue)}`}
          tone={outStock ? "danger" : lowStock ? "warning" : "neutral"}
        />
        <KpiCard
          icon={TrendingUp}
          label="Bu ay satış"
          value={formatNumber(stats.bu_ay.qty, 0)}
          subline={formatMoney(stats.bu_ay.mebleg)}
          tone="success"
        />
        <KpiCard
          icon={Calendar}
          label="Son 30 gün"
          value={formatNumber(stats.son_30.qty, 0)}
          subline={`${formatMoney(stats.son_30.mebleg)} dövriyyə`}
        />
        <KpiCard
          icon={ShoppingCart}
          label="Toplam satılıb"
          value={formatNumber(stats.toplam.qty, 0)}
          subline={`${stats.toplam.sifaris_say} sifariş`}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Prices */}
        <Card className="glass lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Qiymət növləri</CardTitle>
            <p className="text-xs text-muted-foreground">5 fərqli kateqoriya üçün</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <PriceRow label="Maya (alış)" value={Number(product.alish_qiymeti ?? 0)} tone="muted" />
            <PriceRow label="Min. satış" value={Number(product.min_satis_qiymeti ?? 0)} tone="warning" />
            <div className="my-1 h-px bg-border/60" />
            <PriceRow label="Pərakəndə satış" value={Number(product.satis_qiymeti ?? 0)} bold />
            <PriceRow label="Topdan" value={Number(product.topdan_qiymeti ?? 0)} />
            <PriceRow label="Partnyor" value={Number(product.partnyor_qiymeti ?? 0)} />
            <PriceRow label="VIP" value={Number(product.vip_qiymeti ?? 0)} />
            <div className="my-1 h-px bg-border/60" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Margin</span>
              <span className={`tabular-nums font-bold ${margin < 0 ? "text-danger" : margin < 10 ? "text-warning" : "text-success"}`}>
                {margin.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Stock by warehouse */}
        <Card className="glass lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Anbarlar üzrə stok</CardTitle>
            <p className="text-xs text-muted-foreground">Cari miqdar və son alış qiyməti</p>
          </CardHeader>
          <CardContent className="p-0">
            {byWarehouse.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Anbar yoxdur</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-y border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Anbar</th>
                    <th className="px-4 py-2 text-right">Miqdar</th>
                    <th className="px-4 py-2 text-right">Son qiymət</th>
                    <th className="px-4 py-2 text-right">Dəyər</th>
                  </tr>
                </thead>
                <tbody>
                  {byWarehouse.map((w) => {
                    const value = w.miqdar * Number(w.son_qiymet ?? product.alish_qiymeti ?? 0);
                    return (
                      <tr key={w.anbar_id} className="border-b border-border/30 last:border-0">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {w.anbar_ad}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          <span className={w.miqdar <= 0 ? "text-danger" : ""}>{formatNumber(w.miqdar, 0)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                          {w.son_qiymet ? formatMoney(w.son_qiymet) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatMoney(value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/40 font-semibold">
                    <td className="px-4 py-2">Cəm</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatNumber(totalStock, 0)}</td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-right tabular-nums brand-text">{formatMoney(stockValue)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Movement history */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Son anbar hərəkətləri</CardTitle>
            <p className="text-xs text-muted-foreground">Son 30 əməliyyat</p>
          </CardHeader>
          <CardContent className="p-0 max-h-[500px] overflow-y-auto">
            {movements.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Hərəkət yoxdur</p>
            ) : (
              <div className="divide-y divide-border/40">
                {movements.map((m) => {
                  const meta = MOVEMENT_LABEL[m.nov] ?? { label: m.nov, icon: AlertTriangle, tone: "text-muted-foreground" };
                  const Icon = meta.icon;
                  const sign = ["medaxil", "transfer_giris", "qaytarma_giris"].includes(m.nov) ? "+" : "−";
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${meta.tone}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{meta.label}</span>
                          <span className="text-xs text-muted-foreground">{m.anbar_ad}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {m.tarix ? formatDate(m.tarix, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                          {m.edilen_ad && ` · ${m.edilen_ad}`}
                          {m.qeyd && ` · ${m.qeyd}`}
                        </div>
                      </div>
                      <div className={`tabular-nums font-semibold ${meta.tone}`}>
                        {sign} {formatNumber(m.miqdar, 0)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily sales trend — drill-down chart */}
        <ProductDailyChart data={dailySales} days={30} />

        {/* Recent sales */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Son satışlar</CardTitle>
            <p className="text-xs text-muted-foreground">Bu məhsulu alan müştərilər</p>
          </CardHeader>
          <CardContent className="p-0 max-h-[500px] overflow-y-auto">
            {sales.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Satış yoxdur</p>
            ) : (
              <div className="divide-y divide-border/40">
                {sales.map((s) => (
                  <Link
                    key={s.sale_id}
                    href={`/ticaret/satislar/${s.sale_id}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-secondary/40"
                  >
                    <ShoppingCart className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono font-medium">{s.nomre}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {s.tarix && formatDate(s.tarix)}
                        {s.musteri_ad && ` · ${s.musteri_ad}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="tabular-nums font-medium">{formatNumber(Number(s.miqdar), 0)} əd</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{formatMoney(Number(s.cemi))}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Servis tarixçəsi */}
      <Card className="glass">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4" /> Servis tarixçəsi
              </CardTitle>
              <p className="text-xs text-muted-foreground">Bu məhsulla bağlı servis sifarişləri</p>
            </div>
            <div className="flex gap-3 text-xs">
              <div className="rounded-md border border-border/40 px-3 py-1.5">
                <div className="text-[10.5px] uppercase text-muted-foreground">Cəmi</div>
                <div className="font-semibold tabular-nums">{servisHistory.stats.total}</div>
              </div>
              <div className="rounded-md border border-border/40 px-3 py-1.5">
                <div className="text-[10.5px] uppercase text-muted-foreground">Bu il</div>
                <div className="font-semibold tabular-nums text-info">{servisHistory.stats.thisYear}</div>
              </div>
              <div className="rounded-md border border-border/40 px-3 py-1.5">
                <div className="text-[10.5px] uppercase text-muted-foreground">Aktiv</div>
                <div className="font-semibold tabular-nums text-warning">{servisHistory.stats.active}</div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {servisHistory.rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Bu məhsula aid servis qeydi yoxdur</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-y border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Nömrə</th>
                  <th className="px-4 py-2">Tarix</th>
                  <th className="px-4 py-2">Müştəri</th>
                  <th className="px-4 py-2">Problem</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Ödəniş</th>
                  <th className="px-4 py-2">Texnik</th>
                  <th className="px-4 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {servisHistory.rows.map((r) => {
                  const st = SERVIS_STATUS_LABELS[r.status] ?? SERVIS_STATUS_LABELS.qebul_edildi;
                  return (
                    <tr key={r.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30">
                      <td className="px-4 py-2.5 font-mono text-xs">{r.nomre}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {r.yaradildi ? formatDate(r.yaradildi) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div>{r.musteri_ad}</div>
                        <div className="text-[10.5px] text-muted-foreground">{r.musteri_telefon}</div>
                      </td>
                      <td className="px-4 py-2.5 max-w-[260px] truncate text-xs" title={r.problem_tesviri}>
                        {r.problem_tesviri}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={`${st.cls} text-[10px]`}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {formatMoney(r.musteriden_alinan)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {r.texniki_ad ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/servis/${r.id}`}
                          className="inline-flex items-center text-xs text-primary-light hover:underline"
                        >
                          Bax <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Bağlı tapşırıqlar */}
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="h-4 w-4" /> Bağlı tapşırıqlar
          </CardTitle>
          <p className="text-xs text-muted-foreground">Bu məhsulla bağlı tapşırıqlar (sinxron görünüş)</p>
        </CardHeader>
        <CardContent>
          <ObjectTasksTab obyektNov="mehsul" obyektId={product.id} obyektBasliq={product.ad} />
        </CardContent>
      </Card>

      {/* Məhsul tarixçəsi — audit_log əsaslı */}
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Tarixçə
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Məhsul kartında edilmiş bütün dəyişikliklər — kim, nə zaman, hansı sahə.
            Yalnız sahibkar və admin qeydləri silə bilər.
          </p>
        </CardHeader>
        <CardContent>
          <ProductHistoryTab
            productId={product.id}
            entries={history.map((h) => ({
              id: h.id,
              yaradildi: h.yaradildi,
              emeliyyat: h.emeliyyat,
              istifadeci_ad: h.istifadeci_ad,
              url: h.url,
              status: h.status,
              sebeb: h.sebeb,
              changes: h.changes,
            }))}
            canDelete={allowHistoryDelete}
          />
        </CardContent>
      </Card>

      {/* Misc info */}
      <Card className="glass">
        <CardContent className="grid grid-cols-2 gap-3 py-4 text-xs sm:grid-cols-4">
          <Field label="Yaradılıb" value={product.yaradildi ? formatDate(product.yaradildi) : "—"} />
          <Field label="Yenilənib" value={product.yenilendi ? formatDate(product.yenilendi) : "—"} />
          <Field label="Kritik stok" value={product.kritik_stok ? formatNumber(Number(product.kritik_stok), 0) : "—"} />
          <Field label="Ölçü" value={product.olcu_vahidleri?.ad ?? "—"} />
        </CardContent>
      </Card>
    </div>
  );
}

function PriceRow({ label, value, bold, tone }: { label: string; value: number; bold?: boolean; tone?: "muted" | "warning" }) {
  const toneCls = tone === "muted" ? "text-muted-foreground" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={tone === "muted" ? "text-xs text-muted-foreground" : tone === "warning" ? "text-xs text-warning" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular-nums ${bold ? "text-lg font-bold brand-text" : `font-medium ${toneCls}`}`}>
        {value > 0 ? formatMoney(value) : "—"}
      </span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
