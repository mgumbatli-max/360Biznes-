import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, X, Clock, AlertTriangle, ShieldCheck, User, Calendar,
  Tag, FileText, MessageCircle, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { formatDate, formatMoney, cn } from "@/lib/utils";
import { ApprovalActions } from "@/features/tesdiq/components/approval-actions";
import { EditApprovalForm } from "@/features/tesdiq/components/edit-approval-form";
import { canApproveDocApproval } from "@/features/tesdiq/permissions";
import { requireTenant } from "@/lib/db/tenant-context";

export const metadata: Metadata = { title: "Təsdiq tələbi" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  gozleyir: { label: "Gözləyir", cls: "bg-amber-500/15 text-amber-500 border-amber-500/40", icon: Clock },
  tesdiq:   { label: "Təsdiq",   cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40", icon: CheckCircle2 },
  red:      { label: "Rədd",     cls: "bg-rose-500/15 text-rose-500 border-rose-500/40", icon: X },
  legv:     { label: "Ləğv",     cls: "bg-secondary text-muted-foreground border-border", icon: X },
};

const LOG_EMELIYYAT: Record<string, { label: string; cls: string }> = {
  yaradildi:               { label: "Yaradıldı",                cls: "bg-primary/15 text-primary border-primary/30" },
  auto_tesdiq:             { label: "Auto-təsdiq",              cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  tesdiqlendi:             { label: "Təsdiqləndi",              cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  redd_edildi:             { label: "Rədd edildi",              cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  legv_edildi:             { label: "Ləğv edildi",              cls: "bg-secondary text-muted-foreground border-border" },
  bulk_tesdiq:             { label: "Bulk təsdiq",              cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  bulk_red:                { label: "Bulk rədd",                cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  qeyd:                    { label: "Qeyd",                     cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  yaradan_duzelis:         { label: "Yaradan düzəltdi",         cls: "bg-sky-500/15 text-sky-600 border-sky-500/30" },
  tesdiq_eden_duzelis:     { label: "Təsdiq edən düzəltdi",     cls: "bg-violet-500/15 text-violet-600 border-violet-500/30" },
  yenilendi:               { label: "Sorğu yeniləndi",          cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
};

async function loadDetail(id: number) {
  return withTenant(async () => {
    const row = await prisma.tesdiq_telep.findUnique({
      where: { id },
      include: {
        istifadeciler_tesdiq_telep_yaradan_idToistifadeciler: { select: { ad_soyad: true, email: true } },
        istifadeciler_tesdiq_telep_baxan_idToistifadeciler: { select: { ad_soyad: true, email: true } },
        tesdiq_log: {
          orderBy: { yaradildi: "desc" },
          include: { istifadeciler: { select: { ad_soyad: true } } },
        },
      },
    });
    if (!row) return null;
    // İcazəni serverdə əvvəlcədən hesabla — UI birbaşa istifadə edə bilsin
    const { istifadeciId } = requireTenant();
    const canApprove = await canApproveDocApproval(row.emeliyyat_nov);
    return {
      ...row,
      _canApprove: canApprove,
      _isCreator: row.yaradan_id === istifadeciId,
    };
  });
}

export default async function TesdiqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) notFound();

  const row = await loadDetail(idNum);
  if (!row) notFound();

  const s = STATUS[row.status ?? "gozleyir"] ?? STATUS.gozleyir;
  const StatusIcon = s.icon;
  const isPending = (row.status ?? "gozleyir") === "gozleyir";
  const yaradan = row.istifadeciler_tesdiq_telep_yaradan_idToistifadeciler;
  const baxan = row.istifadeciler_tesdiq_telep_baxan_idToistifadeciler;

  const responseHours = row.yaradildi && row.netice_tarix
    ? (row.netice_tarix.getTime() - row.yaradildi.getTime()) / 3_600_000
    : null;

  const detayObj = row.detay_json && typeof row.detay_json === "object" && !Array.isArray(row.detay_json)
    ? (row.detay_json as Record<string, unknown>)
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/tesdiq" className="hover:text-foreground">Təsdiq mərkəzi</Link>
        <ChevronRight className="h-3 w-3" />
        <span>#{row.id}</span>
      </nav>

      {/* Header card */}
      <Card className={cn("glass border-l-4", isPending ? "border-l-amber-500" : row.status === "tesdiq" ? "border-l-emerald-500" : "border-l-rose-500")}>
        <CardContent className="space-y-3 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold">{row.basliq ?? row.emeliyyat_nov}</h1>
                <Badge variant="outline" className={cn("text-[11px]", s.cls)}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {s.label}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span><Tag className="mr-1 inline h-3 w-3" />{row.emeliyyat_nov}</span>
                {row.resurs_nov && <span>· {row.resurs_nov} {row.resurs_id && <code className="rounded bg-secondary/60 px-1 font-mono">{row.resurs_id}</code>}</span>}
                {row.mebleg != null && <span className="font-bold text-foreground">· {formatMoney(Number(row.mebleg))}</span>}
                <span>· prioritet: <strong className="text-foreground">{row.prioritet}</strong></span>
              </div>
              {row.risk_sebeb && (
                <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm">
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-500" />
                  <strong>Səbəb:</strong> {row.risk_sebeb}
                </p>
              )}
            </div>
            {isPending && (
              <div className="shrink-0">
                <ApprovalActions id={row.id} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Meta grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <MetaCard icon={User} title="Yaradan" body={yaradan?.ad_soyad ?? "—"} sub={yaradan?.email ?? null} date={row.yaradildi} />
        {baxan ? (
          <MetaCard
            icon={ShieldCheck}
            title="Cavablandı"
            body={baxan.ad_soyad ?? "—"}
            sub={baxan.email ?? null}
            date={row.netice_tarix}
            extra={responseHours != null ? `${responseHours.toFixed(1)} saat sonra` : null}
          />
        ) : (
          <MetaCard icon={Clock} title="Gözləyir" body="Hələ cavab verilməyib" sub={null} date={null} />
        )}
      </div>

      {/* Decision note */}
      {row.netice_qeyd && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
              {row.status === "tesdiq" ? "Təsdiq qeydi" : "Rədd səbəbi"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap rounded-md bg-secondary/40 px-3 py-2 text-sm">{row.netice_qeyd}</p>
          </CardContent>
        </Card>
      )}

      {/* Diff cədvəli — yalnız before/after olduqda (məhsul update halı) */}
      {detayObj && hasDiff(detayObj) && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-3.5 w-3.5 text-primary" />
              {detayObj.tip === "create" ? "Yeni qiymətlər" : "Dəyişikliklər (köhnə → yeni)"}
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              {detayObj.tip === "create"
                ? "Bu məhsul kartı yaradılır — yalnız təsdiqdən sonra siyahıda görünəcək."
                : "Aşağıdakı sahələr dəyişdirilməyə təklif olunur. Təsdiqdən sonra mehsullar cədvəlinə tətbiq olunacaq."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <DiffTable
              before={detayObj.before as Record<string, unknown> | null | undefined}
              after={detayObj.after as Record<string, unknown> | null | undefined}
            />
            {/* Düzəliş + Qeyd formu — yalnız gözləyən sorğularda */}
            {isPending && (
              <EditApprovalForm
                telepId={row.id}
                before={(detayObj.before as Record<string, unknown> | null) ?? null}
                after={(detayObj.after as Record<string, unknown>) ?? {}}
                canApprove={row._canApprove}
                isCreator={row._isCreator}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Detail JSON — only when no diff (digər təsdiq növləri üçün) */}
      {detayObj && !hasDiff(detayObj) && Object.keys(detayObj).length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Detallar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {Object.entries(detayObj).map(([k, v]) => (
                <div key={k} className="rounded-md border border-border/40 bg-secondary/20 px-3 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                  <dd className="text-sm font-medium tabular-nums">{formatValue(v)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Timeline / log */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-3.5 w-3.5 text-primary" />
            Tarixçə ({row.tesdiq_log.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {row.tesdiq_log.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Tarixçə yoxdur</p>
          ) : (
            <ol className="space-y-2.5">
              {row.tesdiq_log.map((l) => {
                const meta = LOG_EMELIYYAT[l.emeliyyat ?? ""] ?? { label: l.emeliyyat ?? "—", cls: "bg-secondary text-foreground" };
                return (
                  <li key={String(l.id)} className="flex items-start gap-3 rounded-md border border-border/40 bg-secondary/20 px-3 py-2">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-card">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn("text-[10px]", meta.cls)}>{meta.label}</Badge>
                        {l.istifadeciler?.ad_soyad && (
                          <span className="text-xs font-semibold">{l.istifadeciler.ad_soyad}</span>
                        )}
                        {l.evvelki_status && l.yeni_status && (
                          <span className="text-[10px] text-muted-foreground">
                            <code className="font-mono">{l.evvelki_status}</code>
                            <ChevronRight className="mx-1 inline h-2.5 w-2.5" />
                            <code className="font-mono">{l.yeni_status}</code>
                          </span>
                        )}
                      </div>
                      {l.qeyd && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{l.qeyd}</p>}
                      {l.yaradildi && (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          <Calendar className="mr-1 inline h-2.5 w-2.5" />
                          {formatDate(l.yaradildi, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Back link */}
      <div className="flex items-center justify-between">
        <Link href="/tesdiq" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" />
          Bütün təsdiqlər
        </Link>
      </div>
    </div>
  );
}

function MetaCard({
  icon: Icon, title, body, sub, date, extra,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  sub: string | null;
  date: Date | null;
  extra?: string | null;
}) {
  return (
    <Card className="glass">
      <CardContent className="space-y-1.5 py-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3 w-3" />
          {title}
        </div>
        <div className="font-bold">{body}</div>
        {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
        {date && (
          <div className="text-[11px] text-muted-foreground">
            <Calendar className="mr-1 inline h-2.5 w-2.5" />
            {formatDate(date, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
        {extra && <div className="text-[11px] font-semibold text-emerald-500">{extra}</div>}
      </CardContent>
    </Card>
  );
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString("az-AZ");
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "Hə" : "Yox";
  return JSON.stringify(v);
}

function hasDiff(o: Record<string, unknown>): boolean {
  return ("before" in o || "after" in o) && (o.tip === "create" || o.tip === "update");
}

const FIELD_LABELS: Record<string, string> = {
  ad: "Ad",
  kod: "Kod",
  barkod: "Barkod",
  alish_qiymeti: "Alış qiyməti",
  satis_qiymeti: "Satış qiyməti",
  min_satis_qiymeti: "Min satış qiyməti",
  topdan_qiymeti: "Topdan qiymət",
  vip_qiymeti: "VIP qiymət",
  partnyor_qiymeti: "Partnyor qiymət",
  endirimli_qiymet: "Endirimli qiymət",
  kritik_stok: "Kritik stok",
  min_stok: "Min stok",
  max_stok: "Max stok",
  kateqoriya_id: "Kateqoriya ID",
  marka_id: "Marka ID",
  olcu_id: "Ölçü ID",
  model: "Model",
  rang: "Rəng",
  istehsalci: "İstehsalçı",
  aktiv: "Aktiv",
  sekil_url: "Şəkil",
  aciqlamaq: "Açıqlama",
  qisaca_tesvir: "Qısa təsvir",
  zemanet_ay: "Zəmanət (ay)",
  komissiya_faiz: "Komissiya %",
  edv_status: "ƏDV statusu",
};

function DiffTable({
  before,
  after,
}: {
  before: Record<string, unknown> | null | undefined;
  after: Record<string, unknown> | null | undefined;
}) {
  const b = before ?? {};
  const a = after ?? {};
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();
  const rows = keys
    .map((k) => ({ k, from: b[k], to: a[k] }))
    .filter((r) => JSON.stringify(r.from) !== JSON.stringify(r.to));

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Heç bir fərq tapılmadı
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border/40">
      <table className="w-full text-sm">
        <thead className="bg-secondary/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Sahə</th>
            <th className="px-3 py-2 text-left">Köhnə</th>
            <th className="w-5 px-0 py-2"></th>
            <th className="px-3 py-2 text-left">Yeni</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {rows.map(({ k, from, to }) => (
            <tr key={k} className="hover:bg-secondary/20">
              <td className="px-3 py-2 text-xs font-semibold">{FIELD_LABELS[k] ?? k}</td>
              <td className="px-3 py-2">
                <code className="inline-block max-w-xs truncate rounded bg-rose-500/10 px-1.5 py-0.5 text-[11px] text-rose-700 line-through dark:text-rose-300">
                  {formatValue(from)}
                </code>
              </td>
              <td className="px-0 py-2 text-center text-muted-foreground">→</td>
              <td className="px-3 py-2">
                <code className="inline-block max-w-xs truncate rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  {formatValue(to)}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bg-secondary/30 px-3 py-1.5 text-[10px] text-muted-foreground">
        {rows.length} sahə dəyişib
      </div>
    </div>
  );
}
