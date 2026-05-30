import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ClipboardList,
  FileSpreadsheet,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AddLineDialog } from "@/features/satinalma/components/add-line-dialog";
import { LineRowEditor } from "@/features/satinalma/components/line-row-editor";
import { ProposalActions } from "@/features/satinalma/components/proposal-actions";
import { AiSuggestionsPanel } from "@/features/satinalma/components/ai-suggestions-panel";
import {
  getProposalDetail,
  getProductsForPicker,
  getSuppliersForPicker,
  getAiSuggestions,
} from "@/features/satinalma/queries";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Təklif detalı" };

const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "text-muted-foreground border-border" },
  gonderildi: { label: "Göndərildi", cls: "text-primary border-primary/40 bg-primary/5" },
  tesdiq: { label: "Təsdiqləndi", cls: "text-emerald-600 border-emerald-500/40 bg-emerald-500/5" },
  redd: { label: "Rədd", cls: "text-rose-500 border-rose-500/40 bg-rose-500/5" },
  legv: { label: "Ləğv", cls: "text-muted-foreground border-border" },
};

function fmtMoney(n: number) {
  return new Intl.NumberFormat("az-AZ", { maximumFractionDigits: 2 }).format(n) + " ₼";
}

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("az-AZ", { dateStyle: "short", timeStyle: "short" }).format(d);
}

function toNum(v: { toNumber?: () => number } | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return v.toNumber ? v.toNumber() : Number(v);
}

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Critical-path: təklif detalı + ProposalActions üçün icazə yoxlanışı.
  // Picker datası (məhsul + təchizatçı) və AI tövsiyələri ayrı Suspense-lərdə.
  const [teklif, canDeleteNonDraft] = await Promise.all([
    getProposalDetail(Number(id)),
    withTenant(async () => {
      const { rolId, icazeler } = requireTenant();
      // Sahibkar (rol_id=9) və administrator (rol_id=1) həmişə silə bilər;
      // digərləri yalnız `satinalma.tesdiq_silme` icazəsi ilə.
      return rolId === 1 || rolId === 9 || icazeler.includes("satinalma.tesdiq_silme");
    }),
  ]);
  if (!teklif) notFound();

  const st = STATUS_INFO[teklif.status] ?? STATUS_INFO.draft;
  const isDraft = teklif.status === "draft";

  const cemiMeblegh = toNum(teklif.cemi_meblegh);
  const cemiMaya = toNum(teklif.cemi_maya);
  const mənfeet = cemiMeblegh - cemiMaya;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <BackButton fallback="/anbar/satinalma" label="Satınalma siyahısı" />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-secondary text-primary">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {teklif.ad ?? "Satınalma təklifi"}
              </h1>
              <Badge variant="outline" className={cn("text-[11px]", st.cls)}>{st.label}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="font-mono font-semibold">{teklif.kod}</span>
              <span>·</span>
              <span>{teklif.yaradan?.ad_soyad ?? "—"}</span>
              {teklif.filial && <><span>·</span><span>{teklif.filial.ad}</span></>}
              <span>·</span>
              <span>{fmtDate(teklif.yaradildi)}</span>
            </div>
          </div>
        </div>
        <ProposalActions teklifId={teklif.id} status={teklif.status} canDeleteNonDraft={canDeleteNonDraft} />
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Sətir" value={String(teklif.satirlar.length)} />
        <Stat label="Cəmi miqdar" value={String(teklif.satirlar.reduce((s, l) => s + toNum(l.miqdar), 0))} />
        <Stat label="Cəmi məbləğ" value={fmtMoney(cemiMeblegh)} tone="primary" />
        <Stat label="Cəmi maya" value={fmtMoney(cemiMaya)} tone="muted" />
        <Stat label="Mənfəət" value={fmtMoney(mənfeet)} tone={mənfeet < 0 ? "rose" : "emerald"} />
      </div>

      {teklif.qeyd && (
        <Card className="glass border-primary/30">
          <CardContent className="py-3">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-primary">Təsvir</div>
            <div className="text-sm">{teklif.qeyd}</div>
          </CardContent>
        </Card>
      )}

      {teklif.baxan_qeyd && (
        <Card className={cn("glass", teklif.status === "tesdiq" ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5")}>
          <CardContent className="py-3">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider">Sahibkar qeydi</div>
            <div className="text-sm">{teklif.baxan_qeyd}</div>
            <div className="mt-1 text-[10.5px] text-muted-foreground">
              {teklif.baxan?.ad_soyad ?? "—"} · {fmtDate(teklif.baxildi_de)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add line + Export */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isDraft && (
            <Suspense fallback={<Skeleton className="h-9 w-36 rounded-md" />}>
              <AddLineDialogSection teklifId={teklif.id} />
            </Suspense>
          )}
        </div>
        <a
          href={`/api/satinalma/export/${teklif.id}`}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel ixrac
        </a>
      </div>

      {/* Line items */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Məhsullar ({teklif.satirlar.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {teklif.satirlar.length === 0 ? (
            <div className="px-3 py-12 text-center text-sm text-muted-foreground">
              <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              Hələ sətir yoxdur. «+ Sətir əlavə et» düyməsi ilə başla.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/40 text-left">
                    <th className="px-2 py-2 w-10">#</th>
                    <th className="px-2 py-2 w-14">Şəkil</th>
                    <th className="px-2 py-2">Məhsul</th>
                    <th className="px-2 py-2 w-20 text-right">Miqdar</th>
                    <th className="px-2 py-2 w-24 text-right">Bazar</th>
                    <th className="px-2 py-2 w-24 text-right">Son alış</th>
                    <th className="px-2 py-2 w-24 text-right">Təklif</th>
                    <th className="px-2 py-2 w-24 text-right">Sat. qiymət</th>
                    <th className="px-2 py-2 w-24 text-right">Cəmi</th>
                    <th className="px-2 py-2 w-20 text-right">Mənfəət</th>
                    <th className="px-2 py-2">Təchizatçı</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {teklif.satirlar.map((s, i) => (
                    <LineRowEditor key={s.id} line={s} index={i + 1} readOnly={!isDraft} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Suggestions */}
      {isDraft && (
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <AiSuggestionsSection teklifId={teklif.id} />
        </Suspense>
      )}

      {/* Status / decision history */}
      {teklif.status !== "draft" && (
        <Card className="glass">
          <CardContent className="py-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-xs">
              {teklif.gonderildi_de && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Göndərildi</div>
                  <div className="font-semibold">{fmtDate(teklif.gonderildi_de)}</div>
                </div>
              )}
              {teklif.baxildi_de && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Baxıldı</div>
                  <div className="font-semibold">{fmtDate(teklif.baxildi_de)}</div>
                </div>
              )}
              {teklif.baxan && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Qərar verən</div>
                  <div className="font-semibold">{teklif.baxan.ad_soyad}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function AddLineDialogSection({ teklifId }: { teklifId: number }) {
  const [products, suppliers] = await Promise.all([
    getProductsForPicker(""),
    getSuppliersForPicker(),
  ]);
  return <AddLineDialog teklifId={teklifId} products={products} suppliers={suppliers} />;
}

async function AiSuggestionsSection({ teklifId }: { teklifId: number }) {
  const aiSuggestions = await getAiSuggestions();
  if (aiSuggestions.length === 0) return null;
  return <AiSuggestionsPanel teklifId={teklifId} suggestions={aiSuggestions} />;
}

function Package({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "primary" | "muted" | "emerald" | "rose";
}) {
  const cls =
    tone === "primary"
      ? "text-primary"
      : tone === "muted"
      ? "text-muted-foreground"
      : tone === "emerald"
      ? "text-emerald-500"
      : tone === "rose"
      ? "text-rose-500"
      : "text-foreground";
  return (
    <div className="glass rounded-xl border border-border/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-xl font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
