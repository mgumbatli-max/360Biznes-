"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  User,
  Globe,
  Monitor,
  AlertCircle,
  Clock,
  Activity,
  FileText,
  Fingerprint,
  Smartphone,
  Copy,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, formatDecimal } from "@/lib/utils";
import { OP_META as SHARED_OP_META, RESOURCE_LABEL as SHARED_RESOURCE_LABEL, type AuditTone } from "../labels";

type Detail = {
  id: string;
  yaradildi: string | null;
  istifadeci: { ad_soyad: string | null; email?: string };
  emeliyyat: string;
  resurs_nov: string;
  resurs_id: string | null;
  url: string | null;
  metod: string | null;
  status: string | null;
  sebeb: string | null;
  ip_adres: string | null;
  user_agent: string | null;
  brauzer: string | null;
  os: string | null;
  cihaz: string | null;
  sessiya_id: string | null;
  evvelki_data: unknown;
  yeni_data: unknown;
};

type Tone = AuditTone;

// Hər əməliyyat növü üçün başlıq, rəng, fel — paylaşılan labels-dən genişləndirilir
const LOCAL_OP_META: Record<string, { label: string; tone: Tone; verb: string }> = {
  yarat: { label: "Yaratma", tone: "success", verb: "yaradıldı" },
  yarad: { label: "Yaratma", tone: "success", verb: "yaradıldı" },
  YARAT: { label: "Yaratma", tone: "success", verb: "yaradıldı" },
  yenile: { label: "Yeniləmə", tone: "info", verb: "yeniləndi" },
  YENILE: { label: "Yeniləmə", tone: "info", verb: "yeniləndi" },
  sil: { label: "Silmə", tone: "danger", verb: "silindi" },
  SIL: { label: "Silmə", tone: "danger", verb: "silindi" },
  berpa: { label: "Bərpa", tone: "info", verb: "bərpa edildi" },
  tesdiq: { label: "Təsdiq", tone: "success", verb: "təsdiqləndi" },
  redd: { label: "Rədd", tone: "danger", verb: "rədd edildi" },
  legv: { label: "Ləğv", tone: "warning", verb: "ləğv edildi" },
  giris: { label: "Giriş", tone: "primary", verb: "sistemə girdi" },
  GIRIS: { label: "Giriş", tone: "primary", verb: "sistemə girdi" },
  cixis: { label: "Çıxış", tone: "primary", verb: "sistemdən çıxdı" },
  uğursuz_giris: { label: "Uğursuz giriş", tone: "danger", verb: "uğursuz giriş cəhdi etdi" },
  pin_giris: { label: "PIN girişi", tone: "primary", verb: "PIN ilə girdi" },
  pin_lockout: { label: "PIN lockout", tone: "danger", verb: "PIN lockout aktivləşdi" },
  pin_qur: { label: "PIN qurma", tone: "info", verb: "PIN qurdu" },
  pin_yenile: { label: "PIN yeniləmə", tone: "info", verb: "PIN-i yenilədi" },
  gizli_giris: { label: "Gizli giriş", tone: "warning", verb: "gizli kodla girdi" },
  import: { label: "Import", tone: "info", verb: "idxal etdi" },
  export: { label: "Export", tone: "warning", verb: "ixrac etdi" },
  "icaze_dəyişdir": { label: "İcazə dəyişdi", tone: "warning", verb: "icazələri dəyişdi" },
};

// Resurs növü insanın oxuya biləcəyi formada
const RESOURCE_LABEL: Record<string, string> = {
  mehsul: "Məhsul",
  marka: "Marka",
  kateqoriya: "Kateqoriya",
  stok: "Stok",
  stok_transfer: "Stok transferi",
  kontragent: "Kontragent (müştəri/təchizatçı)",
  kontragent_borc: "Müştəri borcu",
  satis_sifarisi: "Satış sifarişi",
  pos_satis: "POS satışı",
  marketplace_satis: "Marketplace satışı",
  alis_sifarisi: "Alış sifarişi",
  kredit_satis: "Kredit satışı",
  kredit_satis_odenis: "Kredit satışı ödənişi",
  kredit_bank_odenis: "Bank ödənişi",
  qaytarma_sifarisi: "Qaytarma sifarişi",
  inventarizasiya: "Sayım",
  kassa: "Kassa",
  iscilier: "İşçi",
  maas_hesablama: "Maaş hesablama",
  maas_odenis: "Maaş ödənişi",
  maas_odenis_bulk: "Toplu maaş ödənişi",
  rol: "Rol",
  istifadeci_sifre: "İstifadəçi şifrəsi",
  tesdiq_telep: "Təsdiq sorğusu",
  tesdiq_telep_bulk: "Toplu təsdiq",
  sahibkar_ayar: "Sahibkar ayarı",
  session: "Sessiya",
  mehsul_import_preview: "Məhsul idxal preview",
  mehsul_import_execute: "Məhsul idxal icra",
  mehsul_import_partiya: "Məhsul idxal partiyası",
  mehsul_export: "Məhsul ixracı",
  satis_export: "Satış ixracı",
  alis_export: "Alış ixracı",
  stok_export: "Stok ixracı",
  audit_log_export: "Audit log ixracı",
};

const TONE_CLASSES: Record<Tone, string> = {
  success: "border-emerald-500/40 bg-emerald-500/5 text-emerald-600",
  info: "border-sky-500/40 bg-sky-500/5 text-sky-600",
  danger: "border-rose-500/40 bg-rose-500/5 text-rose-600",
  warning: "border-amber-500/40 bg-amber-500/5 text-amber-600",
  primary: "border-violet-500/40 bg-violet-500/5 text-violet-600",
  neutral: "border-border/40 bg-secondary/30 text-muted-foreground",
};

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec} san əvvəl`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dəq əvvəl`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} saat əvvəl`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day} gün əvvəl`;
  return formatDate(d, { day: "2-digit", month: "short", year: "numeric" });
}

export function AuditDetailModal() {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp.get("detail");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const ac = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null);
    fetch(`/api/audit-log/detail?id=${id}`, { signal: ac.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Yüklənmədi");
        return j as Detail;
      })
      .then((d) => {
        if (!ac.signal.aborted) setDetail(d);
      })
      .catch((e) => {
        if (!ac.signal.aborted) setError(String(e));
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [id]);

  function close() {
    const params = new URLSearchParams(sp.toString());
    params.delete("detail");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 md:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Audit qeyd detalları</DialogTitle>
        </DialogHeader>

        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {detail && <DetailBody d={detail} />}
      </DialogContent>
    </Dialog>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted/60" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-20 animate-pulse rounded-lg bg-muted/40" />
        <div className="h-32 animate-pulse rounded-lg bg-muted/40" />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Yüklənir…
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-rose-500/10 text-rose-600">
        <XCircle className="h-6 w-6" />
      </div>
      <div className="text-sm font-medium text-rose-600">Yükləmək alınmadı</div>
      <div className="text-xs text-muted-foreground">{message}</div>
    </div>
  );
}

function DetailBody({ d }: { d: Detail }) {
  const yaradildi = d.yaradildi ? new Date(d.yaradildi) : null;
  const meta: { label: string; tone: Tone; verb: string } =
    LOCAL_OP_META[d.emeliyyat]
    ?? (SHARED_OP_META[d.emeliyyat] as { label: string; tone: Tone; verb: string } | undefined)
    ?? { label: d.emeliyyat, tone: "neutral", verb: d.emeliyyat };
  const resourceLabel = SHARED_RESOURCE_LABEL[d.resurs_nov] ?? RESOURCE_LABEL[d.resurs_nov] ?? d.resurs_nov;
  const userName = d.istifadeci.ad_soyad ?? d.istifadeci.email ?? "Naməlum istifadəçi";
  const initials: string = userName.split(" ").map((s) => s[0] ?? "").filter((c): c is string => Boolean(c)).slice(0, 2).join("").toUpperCase();
  const success = d.status === "ugur" || d.status === null;
  const isNewDevice = d.emeliyyat === "yeni_cihaz_giris";
  // Yeni cihaz → həmişə warning rəng göstər (uğurlu olsa da)
  const tone: Tone = !success ? "danger" : isNewDevice ? "warning" : meta.tone;

  return (
    <div className="flex flex-col">
      {/* Hero başlıq — istifadəçi → əməliyyat → resurs aydın gözəxoş axın */}
      <div className={cn("border-b px-6 py-5", TONE_CLASSES[tone])}>
        <div className="flex items-start gap-3">
          <div className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-xl font-bold text-base shadow-sm",
            "bg-background/60 backdrop-blur"
          )}>
            {initials || <User className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{userName}</span>
              <Badge variant="outline" className={cn("border-0 text-[10px]", TONE_CLASSES[tone])}>
                {meta.label}
              </Badge>
              {!success && d.status && (
                <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-[10px] text-rose-600">
                  {d.status}
                </Badge>
              )}
            </div>
            <div className="mt-1 text-sm text-foreground/80">
              <span className="text-muted-foreground">{meta.verb}</span>{" "}
              <span className="font-medium">{resourceLabel}</span>
              {d.resurs_id && (
                <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                  #{d.resurs_id.slice(0, 12)}{d.resurs_id.length > 12 && "…"}
                </span>
              )}
            </div>
            {yaradildi && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatRelative(yaradildi)}</span>
                <span className="text-foreground/30">·</span>
                <span>{formatDate(yaradildi, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              </div>
            )}
          </div>
          <div className="shrink-0">
            {success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-500" />
            )}
          </div>
        </div>
        {isNewDevice && (
          <div className="mt-3 rounded-md border-2 border-amber-500/60 bg-amber-500/10 px-3 py-2.5 backdrop-blur">
            <div className="flex items-start gap-2">
              <div className="text-lg leading-none">🆕</div>
              <div className="flex-1 text-sm">
                <div className="font-bold text-amber-700 dark:text-amber-500">Bu cihazdan ilk dəfə giriş edildi</div>
                <div className="mt-0.5 text-xs text-foreground/80">
                  Son 90 gündə bu istifadəçinin bu cihaz növü + əməliyyat sistemi + brauzer kombinasiyası ilə uğurlu girişi qeydə alınmayıb.
                  Əgər bu siz deyilsinizsə, dərhal şifrəni dəyişin.
                </div>
              </div>
            </div>
          </div>
        )}
        {d.sebeb && (
          <div className="mt-3 rounded-md border border-foreground/10 bg-background/60 px-3 py-2 text-sm backdrop-blur">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Səbəb / qeyd</div>
            <div className="mt-0.5 text-foreground">{d.sebeb}</div>
          </div>
        )}
      </div>

      {/* Diff — əvvəl/sonra */}
      {Boolean(d.evvelki_data || d.yeni_data) && (
        <div className="border-b px-6 py-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> Dəyişikliklər
          </div>
          <DiffView before={d.evvelki_data} after={d.yeni_data} />
        </div>
      )}

      {/* Texniki məlumat — kompakt grid */}
      <div className="grid grid-cols-2 gap-px bg-border/40 sm:grid-cols-4">
        <MetaCell label="IP" icon={Globe} value={d.ip_adres ?? "—"} mono />
        <MetaCell
          label="Cihaz"
          icon={Smartphone}
          value={d.cihaz ?? "—"}
          sub={d.os ?? undefined}
        />
        <MetaCell label="Brauzer" icon={Monitor} value={d.brauzer ?? "—"} />
        <MetaCell
          label="Sessiya"
          icon={Fingerprint}
          value={d.sessiya_id ? d.sessiya_id.slice(0, 8) : "—"}
          mono
        />
      </div>

      {/* URL + User-agent — collapse */}
      {(d.url || d.user_agent) && (
        <DisclosurePanel label="Texniki detallar">
          {d.url && (
            <div className="px-6 py-2 text-xs">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">URL{d.metod && ` (${d.metod})`}</div>
              <div className="mt-0.5 break-all font-mono text-[11px] text-foreground/80">{d.url}</div>
            </div>
          )}
          {d.user_agent && (
            <div className="border-t border-border/30 px-6 py-2 text-xs">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">User-Agent</div>
              <div className="mt-0.5 break-all font-mono text-[10.5px] text-muted-foreground">{d.user_agent}</div>
            </div>
          )}
        </DisclosurePanel>
      )}
    </div>
  );
}

function MetaCell({
  label,
  icon: Icon,
  value,
  sub,
  mono,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  sub?: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-background px-4 py-3">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={cn("mt-0.5 truncate text-sm", mono && "font-mono text-xs")}>{value}</div>
      {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function DisclosurePanel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-6 py-2.5 text-left text-xs font-medium text-muted-foreground transition hover:bg-secondary/30"
      >
        {label}
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="border-t border-border/30 pb-2">{children}</div>}
    </div>
  );
}

/* ---- Diff renderer ---- */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function DiffView({ before, after }: { before: unknown; after: unknown }) {
  const rows = useMemo(() => buildDiffRows(before, after), [before, after]);
  const [copied, setCopied] = useState(false);

  if (rows.length === 0) {
    // Yalnız bir tərəf var (yarat / sil) — onu siyahı kimi göstər
    const only = isObject(before) ? before : isObject(after) ? after : null;
    const kind = isObject(before) ? "before" : "after";
    if (!only) {
      return (
        <pre className="rounded-md border border-border/40 bg-secondary/30 p-3 font-mono text-[11px]">
          {JSON.stringify(after ?? before, null, 2)}
        </pre>
      );
    }
    return (
      <div className="space-y-1">
        {Object.entries(only).map(([k, v]) => (
          <div
            key={k}
            className={cn(
              "flex items-start gap-3 rounded-md border px-3 py-1.5 text-sm",
              kind === "before" ? "border-rose-500/30 bg-rose-500/5" : "border-emerald-500/30 bg-emerald-500/5"
            )}
          >
            <span className="min-w-[140px] text-[11px] font-mono text-muted-foreground">{k}</span>
            <span className="flex-1 break-all">{renderValue(v)}</span>
          </div>
        ))}
      </div>
    );
  }

  async function copyJson() {
    await navigator.clipboard?.writeText(
      JSON.stringify({ evvelki: before, yeni: after }, null, 2),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div className="rounded-lg border border-border/40">
        <div className="grid grid-cols-[150px_1fr_auto_1fr] gap-px bg-border/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="bg-secondary/40 px-3 py-1.5">Sahə</div>
          <div className="bg-secondary/40 px-3 py-1.5">Əvvəl</div>
          <div className="bg-secondary/40 px-1 py-1.5" />
          <div className="bg-secondary/40 px-3 py-1.5">Sonra</div>
        </div>
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[150px_1fr_auto_1fr] gap-px bg-border/40">
            <div className="bg-background px-3 py-2 font-mono text-[11px] text-muted-foreground">{row.key}</div>
            <div className="bg-rose-500/5 px-3 py-2 text-sm">
              {row.before === undefined ? <span className="text-muted-foreground">—</span> : renderValue(row.before)}
            </div>
            <div className="bg-background px-1.5 py-2 text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
            <div className="bg-emerald-500/5 px-3 py-2 text-sm">
              {row.after === undefined ? <span className="text-muted-foreground">—</span> : renderValue(row.after)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={copyJson}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-[10.5px] font-medium text-muted-foreground transition hover:bg-secondary"
        >
          {copied ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Kopyalandı
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> JSON kopyala
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function buildDiffRows(before: unknown, after: unknown): { key: string; before: unknown; after: unknown }[] {
  if (!isObject(before) || !isObject(after)) return [];
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  const rows: { key: string; before: unknown; after: unknown }[] = [];
  for (const k of keys) {
    const b = before[k];
    const a = after[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      rows.push({ key: k, before: b, after: a });
    }
  }
  return rows;
}

function renderValue(v: unknown): React.ReactNode {
  if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof v === "boolean") return <Badge variant="outline" className="text-[10px]">{v ? "✓ bəli" : "✗ xeyr"}</Badge>;
  if (typeof v === "number") return <span className="font-mono tabular-nums">{formatDecimal(v)}</span>;
  if (typeof v === "string") {
    if (v.length > 80) return <span className="break-all">{v.slice(0, 80)}…</span>;
    return <span className="break-all">{v}</span>;
  }
  return (
    <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-[11px]">
      {JSON.stringify(v, null, 2)}
    </pre>
  );
}

// Row click row component
export function AuditRowLink({ id, children }: { id: bigint | string; children: React.ReactNode }) {
  const router = useRouter();
  const sp = useSearchParams();

  function open() {
    const params = new URLSearchParams(sp.toString());
    params.set("detail", String(id));
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <tr
      onClick={open}
      className="cursor-pointer border-b border-border/30 transition hover:bg-secondary/40"
    >
      {children}
    </tr>
  );
}
