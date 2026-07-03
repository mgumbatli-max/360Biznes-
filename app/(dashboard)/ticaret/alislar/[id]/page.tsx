import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Truck, Package, Calendar, FileText, Tag, Receipt, User } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { getKontragentBorc } from "@/features/elaqe/kontragent-borc";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Alış detayı" };

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
        alis_sifaris_satirlari: {
          include: { mehsullar: { select: { id: true, ad: true, kod: true } } },
          orderBy: { id: "asc" },
        },
        kontragentler: { select: { id: true, ad: true, telefon: true } },
        anbarlar: { select: { ad: true } },
        istifadeciler_alis_sifarisleri_menecer_idToistifadeciler: { select: { ad_soyad: true } },
        istifadeciler_alis_sifarisleri_yaradan_idToistifadeciler: { select: { ad_soyad: true } },
      },
    }),
  );
}

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { requireTicaretPerm } = await import("@/features/ticaret/access-guard");
  await requireTicaretPerm("alis.oxu");

  const { id } = await params;
  const p = await getPurchaseDetail(id);
  if (!p) notFound();

  // Təchizatçı borcunu paralel oxu — kart üzərində kompakt göstəriləcək
  const supplierBorc = p.kontragentler?.id
    ? await getKontragentBorc(p.kontragentler.id).catch(() => null)
    : null;

  const status = STATUS[p.status ?? "gozlemede"] ?? STATUS.gozlemede;
  const umumi = Number(p.umumi_mebleg ?? 0);
  const odenilmis = Number(p.odenilmis ?? 0);
  const qalig = umumi - odenilmis;
  const lineCount = p.alis_sifaris_satirlari.length;
  const totalQty = p.alis_sifaris_satirlari.reduce((s, l) => s + Number(l.miqdar ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-12">
      {/* Header */}
      <header className="flex items-start gap-3">
        <BackButton fallback="/ticaret/alislar" className="mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <h1 className="font-mono text-xl font-bold tracking-tight">{p.nomre}</h1>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(p.tarix, {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
            <span className="text-border">·</span>
            <Badge variant="outline" className={`text-[10px] ${status.cls}`}>
              {status.label}
            </Badge>
            {p.qaime_nomre && (
              <>
                <span className="text-border">·</span>
                <FileText className="h-3 w-3" />
                <span>Qaimə: {p.qaime_nomre}</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Əsas invoice kart */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Təchizatçı / Komanda / Anbar */}
        <div className="grid grid-cols-1 gap-px bg-border/60 sm:grid-cols-3">
          <MetaCell
            label="Təchizatçı"
            icon={Truck}
            primary={
              p.kontragentler ? (
                <Link
                  href={`/elaqe/techizatcilar/${p.kontragentler.id}`}
                  className="hover:text-primary-light"
                >
                  {p.kontragentler.ad}
                </Link>
              ) : (
                "—"
              )
            }
            secondary={
              <>
                {p.kontragentler?.telefon && <span>{p.kontragentler.telefon}</span>}
                {supplierBorc && supplierBorc.techizatci_borcu > 0 && (
                  <span className="ml-1 inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    Bizim borc: {formatMoney(supplierBorc.techizatci_borcu)}
                  </span>
                )}
                {supplierBorc && supplierBorc.techizatci_borcu === 0 && p.kontragentler && (
                  <span className="ml-1 inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-1 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    Borc yoxdur
                  </span>
                )}
              </>
            }
          />
          <MetaCell
            label="Menecer / Yaradan"
            icon={User}
            primary={
              p.istifadeciler_alis_sifarisleri_menecer_idToistifadeciler?.ad_soyad ?? "—"
            }
            secondary={
              p.istifadeciler_alis_sifarisleri_yaradan_idToistifadeciler?.ad_soyad &&
              p.istifadeciler_alis_sifarisleri_yaradan_idToistifadeciler.ad_soyad !==
                p.istifadeciler_alis_sifarisleri_menecer_idToistifadeciler?.ad_soyad
                ? `+ ${p.istifadeciler_alis_sifarisleri_yaradan_idToistifadeciler.ad_soyad}`
                : null
            }
          />
          <MetaCell
            label="Anbar"
            icon={Package}
            primary={p.anbarlar?.ad ?? "—"}
            secondary={
              <span>
                {lineCount} sətr · {formatNumber(totalQty, 0)} ədəd
              </span>
            }
          />
        </div>

        {/* Sətirlər */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y border-border/60 bg-secondary/30 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-semibold">Məhsul</th>
                <th className="w-20 px-3 py-2 text-right font-semibold">Miqdar</th>
                <th className="w-28 px-3 py-2 text-right font-semibold">Vahid qiymət</th>
                <th className="w-28 px-4 py-2 text-right font-semibold">Cəmi</th>
              </tr>
            </thead>
            <tbody>
              {p.alis_sifaris_satirlari.map((l) => (
                <tr key={l.id} className="border-b border-border/30 last:border-b-0">
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
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatNumber(Number(l.miqdar), 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatMoney(Number(l.vahid_qiymet))}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">
                    {formatMoney(Number(l.cemi ?? 0))}
                  </td>
                </tr>
              ))}
              {p.alis_sifaris_satirlari.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    Sətr yoxdur
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cəmi xülasə + əlavə xərclər */}
        <Suspense
          fallback={
            <div className="border-t border-border/60 bg-secondary/20 px-4 py-3">
              <Skeleton className="ml-auto h-20 max-w-xs" />
            </div>
          }
        >
          <TotalsAndCostSection
            id={id}
            fallbackElaveXerc={Number(p.elave_xerc ?? 0)}
            umumi={umumi}
            odenilmis={odenilmis}
            qalig={qalig}
            lineCount={lineCount}
          />
        </Suspense>
      </div>

      {/* Qeyd — yalnız mövcud olduqda */}
      {p.qeyd && (
        <div className="rounded-xl border border-border bg-card/40 p-4">
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Qeyd
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground/90">{p.qeyd}</p>
        </div>
      )}

      {/* Bağlı tapşırıqlar */}
      <Suspense fallback={<Skeleton className="h-32 w-full rounded-xl" />}>
        <LinkedTasksSection id={id} />
      </Suspense>
    </div>
  );
}

async function TotalsAndCostSection({
  id,
  fallbackElaveXerc,
  umumi,
  odenilmis,
  qalig,
  lineCount,
}: {
  id: string;
  fallbackElaveXerc: number;
  umumi: number;
  odenilmis: number;
  qalig: number;
  lineCount: number;
}) {
  const [linkedExpenses, categories] = await Promise.all([
    getLinkedExpensesForPurchase(id),
    getExpenseCategories(),
  ]);
  const elaveXercCem = linkedExpenses.reduce((s, x) => s + x.mebleg, 0) || fallbackElaveXerc;
  const realMayaCem = umumi + elaveXercCem;
  const elaveXercPerLine = lineCount > 0 ? elaveXercCem / lineCount : 0;

  return (
    <div className="border-t border-border/60 bg-secondary/20 px-4 py-3">
      {/* Əlavə xərclər list — kompakt */}
      {linkedExpenses.length > 0 && (
        <div className="mb-3 space-y-1">
          <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Əlavə xərclər</span>
            <XercQaimeLinkDialog
              categories={categories.map((c) => ({ id: c.id, ad: c.ad }))}
              purchases={[]}
              lockedAlisId={id}
              variant="compact"
              triggerLabel="+ Yeni"
            />
          </div>
          {linkedExpenses.map((x) => (
            <div
              key={x.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-card/40 px-2.5 py-1.5 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{x.tesvir}</span>
                  {x.kateqoriya_ad && (
                    <Badge variant="outline" className="text-[10px]">
                      {x.kateqoriya_ad}
                    </Badge>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">{formatDate(x.tarix)}</div>
              </div>
              <div className="tabular-nums font-semibold text-warning">
                + {formatMoney(x.mebleg)}
              </div>
            </div>
          ))}
          {lineCount > 0 && elaveXercCem > 0 && (
            <div className="text-[10.5px] text-muted-foreground">
              💡 Avto-bölgü: sətr başına orta {formatMoney(elaveXercPerLine)}
            </div>
          )}
        </div>
      )}
      {linkedExpenses.length === 0 && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-dashed border-border/60 bg-background/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Receipt className="h-3 w-3" />
            Əlavə xərc yoxdur
          </span>
          <XercQaimeLinkDialog
            categories={categories.map((c) => ({ id: c.id, ad: c.ad }))}
            purchases={[]}
            lockedAlisId={id}
            variant="compact"
            triggerLabel="+ Əlavə xərc"
          />
        </div>
      )}

      {/* Cəmi xülasə — sağda kompakt */}
      <div className="ml-auto max-w-xs space-y-1 text-sm">
        <Row label="Mal dəyəri" value={formatMoney(umumi)} />
        {elaveXercCem > 0 && (
          <Row label="Əlavə xərc" value={`+ ${formatMoney(elaveXercCem)}`} tone="warning" />
        )}
        {elaveXercCem > 0 && (
          <Row label="Real maya" value={formatMoney(realMayaCem)} bold />
        )}
        {elaveXercCem === 0 && <Row label="YEKUN" value={formatMoney(umumi)} bold />}
        <div className="my-1 h-px bg-border/60" />
        <Row label="Ödənilib" value={formatMoney(odenilmis)} tone="success" />
        {qalig > 0 && (
          <Row label="Qalıq borc" value={formatMoney(qalig)} tone="warning" bold />
        )}
      </div>
    </div>
  );
}

async function LinkedTasksSection({ id }: { id: string }) {
  const linkedTasks = await getLinkedTasksForPurchase(id);
  return (
    <LinkedTasksPanel
      contextType="alis_sifarisi"
      contextId={id}
      tasks={linkedTasks}
    />
  );
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
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "muted";
  bold?: boolean;
}) {
  const cls =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
      ? "text-warning"
      : tone === "muted"
      ? "text-muted-foreground"
      : "";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums ${bold ? "text-base font-bold brand-text" : ""} ${cls}`}
      >
        {value}
      </span>
    </div>
  );
}
