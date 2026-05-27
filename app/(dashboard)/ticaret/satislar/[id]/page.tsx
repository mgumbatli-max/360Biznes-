import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, User, Calendar, Package, Tag, Printer } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaleStatusBadge, PaymentBadge } from "@/features/ticaret/components/sale-status-badge";
import { CancelSaleDialog } from "@/features/ticaret/components/cancel-sale-dialog";
import { SalePaymentDialog } from "@/features/ticaret/components/sale-payment-dialog";
import { SaleStatusButtons } from "@/features/ticaret/components/sale-status-buttons";
import { ProductInline } from "@/features/anbar/components/product-inline";
import { SaleNotesTasks } from "@/features/ticaret/components/sale-notes-tasks";
import { getSaleDetail } from "@/features/ticaret/satis-queries";
import { getLinkedTasksForSale } from "@/features/ticaret/satis-actions";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Satış detayı" };
export const dynamic = "force-dynamic";

export default async function SatisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [sale, linkedTasks] = await Promise.all([
    getSaleDetail(id),
    getLinkedTasksForSale(id),
  ]);
  if (!sale) notFound();

  const umumi = Number(sale.umumi_mebleg ?? 0);
  const endirim = Number(sale.endirim_mebleg ?? 0);
  const son = Number(sale.son_mebleg ?? 0);
  const odenilmis = Number(sale.odenilmis ?? 0);
  const qaliq = son - odenilmis;
  const canCancel = sale.status !== "legv";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton fallback="/ticaret/satislar" className="mt-1" />
          <div>
            <h1 className="font-mono text-xl font-bold tracking-tight">{sale.nomre}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(sale.tarix).toLocaleDateString("az-AZ")}
              <span>·</span>
              <SaleStatusBadge value={sale.status ?? "yeni"} />
              <PaymentBadge value={sale.odenis_nov ?? "negd"} />
              {sale.maya_alti && (
                <Badge variant="destructive" className="text-[10px]">maya altı</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/ticaret/satislar/${sale.id}/print`}
            target="_blank"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary"
          >
            <Printer className="h-3.5 w-3.5" />
            Çap / Qəbz
          </Link>
          {qaliq > 0 && sale.status !== "legv" && (
            <SalePaymentDialog saleId={sale.id} qaliq={qaliq} />
          )}
          {sale.status !== "legv" && (
            <SaleStatusButtons saleId={sale.id} status={sale.status ?? "yeni"} />
          )}
          {canCancel && <CancelSaleDialog saleId={sale.id} nomre={sale.nomre} />}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Müştəri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2">
              <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="font-medium">{sale.kontragentler?.ad ?? "Pərakəndə"}</div>
                {sale.kontragentler?.telefon && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {sale.kontragentler.telefon}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Komanda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Satıcı:</span>
              <span className="font-medium">
                {sale.istifadeciler_satis_sifarisleri_satis_meneceri_idToistifadeciler?.ad_soyad ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Yaradan:</span>
              <span className="font-medium">
                {sale.istifadeciler_satis_sifarisleri_yaradan_idToistifadeciler?.ad_soyad ?? "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Anbar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{sale.anbarlar?.ad ?? "—"}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Sətirlər</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Məhsul</th>
                  <th className="px-4 py-2 text-right">Miqdar</th>
                  <th className="px-4 py-2 text-right">Qiymət</th>
                  <th className="px-4 py-2 text-right">Endirim</th>
                  <th className="px-4 py-2 text-right">Cəmi</th>
                </tr>
              </thead>
              <tbody>
                {sale.satis_sifaris_satirlari.map((line) => (
                  <tr key={line.id} className="border-b border-border/30">
                    <td className="px-4 py-2">
                      {line.mehsul_id ? (
                        <ProductInline
                          id={line.mehsul_id}
                          ad={line.mehsullar?.ad ?? "—"}
                          kod={line.mehsullar?.kod ?? null}
                          showImage={false}
                          size="xs"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Tag className="h-3 w-3 text-muted-foreground" />
                          <div className="font-medium">{line.mehsullar?.ad ?? "—"}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatNumber(Number(line.miqdar), 0)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatMoney(Number(line.vahid_qiymet))}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs text-muted-foreground">
                      {Number(line.endirim_faiz ?? 0) > 0 ? `${Number(line.endirim_faiz)}%` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">
                      {formatMoney(Number(line.cemi ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="space-y-2 py-4">
          <Row label="Cəm" value={formatMoney(umumi)} />
          {endirim > 0 && <Row label="Endirim" value={`- ${formatMoney(endirim)}`} />}
          <div className="h-px bg-border/60" />
          <Row label="Yekun məbləğ" value={formatMoney(son)} bold />
          <Row label="Ödənilib" value={formatMoney(odenilmis)} />
          {qaliq > 0 && <Row label="Qalıq" value={formatMoney(qaliq)} tone="warning" />}
        </CardContent>
      </Card>

      <SaleNotesTasks
        saleId={sale.id}
        initialNote={sale.qeyd ?? ""}
        tasks={linkedTasks}
      />
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "warning";
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "text-lg font-bold brand-text" : ""} ${tone === "warning" ? "text-warning" : ""}`}>
        {value}
      </span>
    </div>
  );
}
