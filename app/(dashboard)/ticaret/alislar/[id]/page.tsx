import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Truck, Package, Calendar, FileText, Tag, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { ProductInline } from "@/features/anbar/components/product-inline";
import { XercQaimeLinkDialog } from "@/features/maliyye/components/xerc-qaime-link-dialog";
import { LinkedTasksPanel } from "@/features/ticaret/components/linked-tasks-panel";
import { getLinkedTasksForPurchase } from "@/features/ticaret/alis-actions";
import {
  getExpenseCategories,
  getLinkedExpensesForPurchase,
} from "@/features/maliyye/queries";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Alış detayı" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  gozlemede: { label: "Gözləmədə", cls: "border-warning/30 text-warning bg-warning/10" },
  qebul_edildi: { label: "Qəbul edildi", cls: "border-success/30 text-success bg-success/10" },
  legv: { label: "Ləğv", cls: "border-muted text-muted-foreground" },
};

async function getPurchaseDetail(id: string) {
  return withTenant(async () =>
    prisma.alis_sifarisleri.findUnique({
      where: { id },
      include: {
        alis_sifaris_satirlari: { include: { mehsullar: { select: { id: true, ad: true, kod: true } } }, orderBy: { id: "asc" } },
        kontragentler: { select: { id: true, ad: true, telefon: true } },
        anbarlar: { select: { ad: true } },
        istifadeciler_alis_sifarisleri_menecer_idToistifadeciler: { select: { ad_soyad: true } },
      },
    })
  );
}

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, linkedExpenses, categories, linkedTasks] = await Promise.all([
    getPurchaseDetail(id),
    getLinkedExpensesForPurchase(id),
    getExpenseCategories(),
    getLinkedTasksForPurchase(id),
  ]);
  if (!p) notFound();

  const status = STATUS[p.status ?? "gozlemede"] ?? STATUS.gozlemede;
  const umumi = Number(p.umumi_mebleg ?? 0);
  const odenilmis = Number(p.odenilmis ?? 0);
  const qalig = umumi - odenilmis;
  const elaveXercCem =
    linkedExpenses.reduce((s, x) => s + x.mebleg, 0) || Number(p.elave_xerc ?? 0);
  const realMayaCem = umumi + elaveXercCem;
  const lineCount = p.alis_sifaris_satirlari.length;
  const elaveXercPerLine = lineCount > 0 ? elaveXercCem / lineCount : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-start gap-3">
        <Link
          href="/ticaret/alislar"
          className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary-light" />
            <h1 className="font-mono text-xl font-bold">{p.nomre}</h1>
            <Badge variant="outline" className={status.cls}>{status.label}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(p.tarix)}
            {p.qaime_nomre && <><span>·</span><FileText className="h-3 w-3" /><span>Qaimə: {p.qaime_nomre}</span></>}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Təchizatçı</CardTitle>
          </CardHeader>
          <CardContent>
            {p.kontragentler ? (
              <Link href={`/elaqe/techizatcilar/${p.kontragentler.id}`} className="hover:text-primary-light">
                <div className="font-semibold">{p.kontragentler.ad}</div>
                {p.kontragentler.telefon && <div className="mt-0.5 text-xs text-muted-foreground">{p.kontragentler.telefon}</div>}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Anbar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{p.anbarlar?.ad ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Komanda</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="text-xs text-muted-foreground">Menecer</div>
            <div className="font-medium">{p.istifadeciler_alis_sifarisleri_menecer_idToistifadeciler?.ad_soyad ?? "—"}</div>
          </CardContent>
        </Card>
      </div>

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
                  <th className="px-4 py-2 text-right">Vahid qiymət</th>
                  <th className="px-4 py-2 text-right">Cəmi</th>
                </tr>
              </thead>
              <tbody>
                {p.alis_sifaris_satirlari.map((l) => (
                  <tr key={l.id} className="border-b border-border/30">
                    <td className="px-4 py-2">
                      {l.mehsul_id ? (
                        <ProductInline
                          id={l.mehsul_id}
                          ad={l.mehsullar?.ad ?? "—"}
                          kod={l.mehsullar?.kod ?? null}
                          showImage={false}
                          size="xs"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Tag className="h-3 w-3 text-muted-foreground" />
                          <div className="font-medium">{l.mehsullar?.ad ?? "—"}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatNumber(Number(l.miqdar), 0)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatMoney(Number(l.vahid_qiymet))}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">{formatMoney(Number(l.cemi ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div>
            <CardTitle className="text-base">Əlavə xərclər (logistika, taksi, gömrük)</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bu qaiməyə bağlı əlavə xərclər. Sistem real maya dəyərini proporsional bölgü ilə hesablayır.
            </p>
          </div>
          <XercQaimeLinkDialog
            categories={categories.map((c) => ({ id: c.id, ad: c.ad }))}
            purchases={[]}
            lockedAlisId={id}
            variant="compact"
            triggerLabel="Yeni əlavə xərc"
          />
        </CardHeader>
        <CardContent className="space-y-2">
          {linkedExpenses.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-secondary/30 px-3 py-4 text-center text-xs text-muted-foreground">
              <Receipt className="mx-auto mb-1 h-4 w-4" />
              Bu qaiməyə bağlı əlavə xərc qeydi yoxdur.
            </div>
          ) : (
            <div className="space-y-1">
              {linkedExpenses.map((x) => (
                <div
                  key={x.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card/30 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{x.tesvir}</span>
                      {x.kateqoriya_ad && (
                        <Badge variant="outline" className="text-[10px]">{x.kateqoriya_ad}</Badge>
                      )}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground">{formatDate(x.tarix)}</div>
                  </div>
                  <div className="tabular-nums font-semibold text-warning">
                    + {formatMoney(x.mebleg)}
                  </div>
                </div>
              ))}
              {lineCount > 0 && elaveXercCem > 0 && (
                <div className="mt-2 rounded-md bg-info/10 px-3 py-2 text-[11px] text-info">
                  Avto-bölgü: {formatMoney(elaveXercCem)} → {lineCount} sətr arasında
                  proporsional bölünür (sətr başına orta: {formatMoney(elaveXercPerLine)})
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="space-y-2 py-4">
          <Row label="Cəm dəyər" value={formatMoney(umumi)} />
          {elaveXercCem > 0 && <Row label="Əlavə xərc" value={formatMoney(elaveXercCem)} tone="warning" />}
          {elaveXercCem > 0 && <Row label="Real maya cəmi" value={formatMoney(realMayaCem)} bold />}
          <div className="my-1 h-px bg-border/60" />
          <Row label="Ödənilib" value={formatMoney(odenilmis)} tone="success" />
          {qalig > 0 && <Row label="Qalıq borc" value={formatMoney(qalig)} tone="warning" bold />}
        </CardContent>
      </Card>

      {p.qeyd && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Qeyd</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{p.qeyd}</p>
          </CardContent>
        </Card>
      )}

      <LinkedTasksPanel
        contextType="alis_sifarisi"
        contextId={id}
        tasks={linkedTasks}
      />
    </div>
  );
}

function Row({ label, value, tone, bold }: { label: string; value: string; tone?: "success" | "warning"; bold?: boolean }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold text-lg" : ""} ${cls}`}>{value}</span>
    </div>
  );
}
