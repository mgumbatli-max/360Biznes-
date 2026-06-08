import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Phone,
  User,
  Calendar,
  Package,
  Printer,
  ShoppingCart,
  CreditCard,
  Tag,
  AlertTriangle,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SaleStatusBadge, PaymentBadge } from "@/features/ticaret/components/sale-status-badge";
import { CancelSaleDialog } from "@/features/ticaret/components/cancel-sale-dialog";
import { SalePaymentDialog } from "@/features/ticaret/components/sale-payment-dialog";
import { SaleStatusButtons } from "@/features/ticaret/components/sale-status-buttons";
import { ProductInline } from "@/features/anbar/components/product-inline";
import { SaleNotesTasks } from "@/features/ticaret/components/sale-notes-tasks";
import { getSaleDetail } from "@/features/ticaret/satis-queries";
import {
  getLinkedTasksForSale,
} from "@/features/ticaret/satis-actions";
import { getCustomerCreditStatus } from "@/features/ticaret/satis-yeni-actions";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Satış detayı" };

/**
 * İstifadəçi qeydindən `[META] {...}` JSON parçasını ayırır.
 * Satış formaları metadata-nı qeyd sahəsində saxlayır — UI-da xam JSON
 * göstərmək istəmirik.
 */
function splitQeydAndMeta(raw: string | null): { qeyd: string; meta: Record<string, unknown> | null } {
  if (!raw) return { qeyd: "", meta: null };
  const metaMatch = raw.match(/\[META\]\s*(\{[\s\S]*?\})\s*$/m);
  if (!metaMatch) return { qeyd: raw.trim(), meta: null };
  const cleaned = raw.replace(metaMatch[0], "").trim();
  try {
    const meta = JSON.parse(metaMatch[1]) as Record<string, unknown>;
    return { qeyd: cleaned, meta };
  } catch {
    return { qeyd: cleaned, meta: null };
  }
}

export default async function SatisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { requireTicaretPerm } = await import("@/features/ticaret/access-guard");
  await requireTicaretPerm("satis.oxu");

  const { id } = await params;
  const sale = await getSaleDetail(id);
  if (!sale) notFound();

  // Müştəri seçilibsə, cari kredit (borc) statusunu da paralel oxu
  const creditStatus = sale.musteri_id
    ? await getCustomerCreditStatus(sale.musteri_id).catch(() => null)
    : null;

  const umumi = Number(sale.umumi_mebleg ?? 0);
  const endirim = Number(sale.endirim_mebleg ?? 0);
  const son = Number(sale.son_mebleg ?? 0);
  const odenilmis = Number(sale.odenilmis ?? 0);
  const qaliq = son - odenilmis;
  const canCancel = sale.status !== "legv";
  const lineCount = sale.satis_sifaris_satirlari.length;
  const totalQty = sale.satis_sifaris_satirlari.reduce(
    (s, l) => s + Number(l.miqdar ?? 0),
    0,
  );
  const { qeyd: cleanQeyd, meta: parsedMeta } = splitQeydAndMeta(sale.qeyd ?? "");

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-12">
      {/* Üst header — geri + nömrə + status + əməliyyatlar */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton fallback="/ticaret/satislar" className="mt-1" />
          <div>
            <div className="flex items-baseline gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <h1 className="font-mono text-xl font-bold tracking-tight">{sale.nomre}</h1>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(sale.tarix).toLocaleDateString("az-AZ", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              <span className="text-border">·</span>
              <SaleStatusBadge value={sale.status ?? "yeni"} />
              <PaymentBadge value={sale.odenis_nov ?? "negd"} />
              {sale.maya_alti && (
                <Badge variant="destructive" className="gap-0.5 text-[10px]">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  maya altı
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/ticaret/satislar/${sale.id}/print`}
            target="_blank"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-semibold hover:bg-secondary"
          >
            <Printer className="h-3.5 w-3.5" />
            Çap
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

      {/* Əsas invoice kart */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Müştəri / Satıcı / Anbar — bir cərgə, kompakt */}
        <div className="grid grid-cols-1 gap-px bg-border/60 sm:grid-cols-3">
          <MetaCell
            label="Müştəri"
            icon={User}
            primary={sale.kontragentler?.ad ?? "Pərakəndə"}
            secondary={
              <>
                {sale.kontragentler?.telefon && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {sale.kontragentler.telefon}
                  </span>
                )}
                {creditStatus && creditStatus.borc > 0 && (
                  <span className="ml-1 inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    Cari borc: {formatMoney(creditStatus.borc)}
                  </span>
                )}
                {creditStatus && creditStatus.borc === 0 && sale.kontragentler && (
                  <span className="ml-1 inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-1 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    Borc yoxdur
                  </span>
                )}
              </>
            }
          />
          <MetaCell
            label="Satıcı / Yaradan"
            icon={User}
            primary={
              sale.istifadeciler_satis_sifarisleri_satis_meneceri_idToistifadeciler?.ad_soyad ?? "—"
            }
            secondary={
              sale.istifadeciler_satis_sifarisleri_yaradan_idToistifadeciler?.ad_soyad &&
              sale.istifadeciler_satis_sifarisleri_yaradan_idToistifadeciler.ad_soyad !==
                sale.istifadeciler_satis_sifarisleri_satis_meneceri_idToistifadeciler?.ad_soyad
                ? `+ ${sale.istifadeciler_satis_sifarisleri_yaradan_idToistifadeciler.ad_soyad}`
                : null
            }
          />
          <MetaCell
            label="Anbar"
            icon={Package}
            primary={sale.anbarlar?.ad ?? "—"}
            secondary={
              <span>
                {lineCount} sətr · {formatNumber(totalQty, 0)} ədəd
              </span>
            }
          />
        </div>

        {/* Sətirlər cədvəli */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y border-border/60 bg-secondary/30 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-semibold">Məhsul</th>
                <th className="w-20 px-3 py-2 text-right font-semibold">Miqdar</th>
                <th className="w-24 px-3 py-2 text-right font-semibold">Qiymət</th>
                <th className="w-20 px-3 py-2 text-right font-semibold">Endirim</th>
                <th className="w-28 px-4 py-2 text-right font-semibold">Cəmi</th>
              </tr>
            </thead>
            <tbody>
              {sale.satis_sifaris_satirlari.map((line) => (
                <tr key={line.id} className="border-b border-border/30 last:border-b-0">
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
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatNumber(Number(line.miqdar), 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatMoney(Number(line.vahid_qiymet))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {Number(line.endirim_faiz ?? 0) > 0 ? `${Number(line.endirim_faiz)}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">
                    {formatMoney(Number(line.cemi ?? 0))}
                  </td>
                </tr>
              ))}
              {sale.satis_sifaris_satirlari.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    Sətr yoxdur
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cəmi xülasə — sağa düzülmüş kompakt */}
        <div className="border-t border-border/60 bg-secondary/20 px-4 py-3">
          <div className="ml-auto max-w-xs space-y-1 text-sm">
            <Row label="Ara cəm" value={formatMoney(umumi)} />
            {endirim > 0 && (
              <Row
                label="Endirim"
                value={`− ${formatMoney(endirim)}`}
                tone="muted"
              />
            )}
            <div className="my-1 h-px bg-border/60" />
            <Row label="YEKUN" value={formatMoney(son)} bold />
            <Row
              label={
                <span className="inline-flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  Ödənilib
                </span>
              }
              value={formatMoney(odenilmis)}
              tone="success"
            />
            {qaliq > 0 && (
              <Row label="Qalıq borc" value={formatMoney(qaliq)} tone="warning" bold />
            )}
          </div>
        </div>
      </div>

      {/* İstifadəçi qeydi — yalnız mövcud olduqda */}
      {(cleanQeyd || parsedMeta) && (
        <div className="rounded-xl border border-border bg-card/40 p-4">
          {cleanQeyd && (
            <>
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Qeyd
              </div>
              <p className="whitespace-pre-line text-sm text-foreground/90">{cleanQeyd}</p>
            </>
          )}
          {parsedMeta && (
            <details className="mt-3 group">
              <summary className="cursor-pointer list-none text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                Texniki metadata
                <span className="ml-1 opacity-60 group-open:hidden">(göstər)</span>
                <span className="ml-1 opacity-60 hidden group-open:inline">(gizlət)</span>
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-secondary/40 p-2 text-[10px] text-muted-foreground">
                {JSON.stringify(parsedMeta, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Daxili qeyd + bağlı tapşırıqlar — async yüklənir */}
      <Suspense fallback={<Skeleton className="h-32 w-full rounded-xl" />}>
        <NotesTasksSection saleId={sale.id} initialNote={cleanQeyd} />
      </Suspense>
    </div>
  );
}

async function NotesTasksSection({ saleId, initialNote }: { saleId: string; initialNote: string }) {
  const linkedTasks = await getLinkedTasksForSale(saleId);
  return <SaleNotesTasks saleId={saleId} initialNote={initialNote} tasks={linkedTasks} />;
}

function MetaCell({
  label,
  icon: Icon,
  primary,
  secondary,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="truncate text-sm font-medium">{primary}</div>
      {secondary && (
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{secondary}</div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: React.ReactNode;
  value: string;
  bold?: boolean;
  tone?: "warning" | "success" | "muted";
}) {
  const valueCls =
    tone === "warning"
      ? "text-warning"
      : tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "muted"
      ? "text-muted-foreground"
      : "";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums ${bold ? "text-base font-bold brand-text" : ""} ${valueCls}`}
      >
        {value}
      </span>
    </div>
  );
}
