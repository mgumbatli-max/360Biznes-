"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Phone,
  ShieldCheck,
  ExternalLink,
  ArrowRight,
  Printer,
  MessageSquare,
  CheckCircle2,
  Repeat,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ProductInline } from "@/features/anbar/components/product-inline";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import {
  changeServisStatus,
  sendCustomerNotification,
} from "../actions";
import {
  SERVIS_STATUS_LABELS,
  SERVIS_PRIORITY_LABELS,
  type ServisRow,
} from "../types";
import { formatMoney } from "@/lib/utils";
import { RejectReasonDialog } from "./reject-reason-dialog";
import { ServisStatusBadge, ServisPriorityBadge } from "./servis-status-badge";
import { RowIconButton, RowIconGroup } from "@/features/shared/row-icon-button";

const NEXT_STAGES: Record<string, string[]> = {
  qebul_edildi: ["diaqnostikada", "redd_edildi"],
  diaqnostikada: ["teklif_gozleyir", "usta_baxir", "qaytarildi"],
  teklif_gozleyir: ["usta_baxir", "ehtiyat_hisse", "redd_edildi"],
  usta_baxir: ["ehtiyat_hisse", "temir_olunur"],
  ehtiyat_hisse: ["temir_olunur"],
  temir_olunur: ["temir_edildi"],
  temir_edildi: ["musteriye_tehvil"],
};

const COLUMN_DEFS: ColumnDef[] = [
  { key: "nomre", label: "Nömrə", required: true },
  { key: "musteri", label: "Müştəri" },
  { key: "telefon", label: "Telefon" },
  { key: "mehsul", label: "Məhsul" },
  { key: "seri", label: "Serial / IMEI" },
  { key: "problem", label: "Problem" },
  { key: "status", label: "Status" },
  { key: "prioritet", label: "Prioritet" },
  { key: "texniki", label: "Məsul texniki" },
  { key: "qebul_eden", label: "Qəbul edən" },
  { key: "qebul_tarixi", label: "Qəbul tarixi" },
  { key: "ved_tarixi", label: "Vəd tarixi" },
  { key: "tehvil_tarixi", label: "Təhvil tarixi" },
  { key: "qiymet", label: "Qiymət təklif" },
  { key: "alinan", label: "Müştəridən" },
  { key: "ödəniş", label: "Ödəniş status" },
  { key: "zemanet", label: "Zəmanət" },
  { key: "yeniden", label: "Yenidən gələn" },
  { key: "kanal", label: "Kanal" },
  { key: "satis", label: "Satış əlaqəsi" },
  { key: "filial", label: "Filial" },
  { key: "amel", label: "Əməl", required: true },
];
const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

function fmt(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("az-AZ");
}

type TableFilters = {
  q: string;
  status: string;
  prioritet: string;
  zemanet: boolean;
  gecikme: boolean;
  odenilmis: boolean;
  xarici: boolean;
  iscisi: string;
  defekt: string;
  filial: string;
  marka: string;
  kateqoriya: string;
  from: string;
  to: string;
};

const DEFAULT_FILTERS: TableFilters = {
  q: "",
  status: "",
  prioritet: "",
  zemanet: false,
  gecikme: false,
  odenilmis: false,
  xarici: false,
  iscisi: "",
  defekt: "",
  filial: "",
  marka: "",
  kateqoriya: "",
  from: "",
  to: "",
};

export function ServisTable({
  rows: initial,
  filiallar = [],
  markalar = [],
  kateqoriyalar = [],
  texniki = [],
  defektKateq = [],
  initial: initialFilters,
}: {
  rows: ServisRow[];
  filiallar?: { id: number; ad: string }[];
  markalar?: { id: number; ad: string }[];
  kateqoriyalar?: { id: number; ad: string }[];
  texniki?: { id: string; ad: string }[];
  defektKateq?: { id: number; ad: string; qrup: string | null }[];
  initial?: Partial<TableFilters>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cols = useColumnToggle("servis-cols-v1", COLUMN_DEFS, DEFAULT_ORDER);
  const [filters, setFilters] = useState<TableFilters>({ ...DEFAULT_FILTERS, ...(initialFilters ?? {}) });

  // Sync filters → URL (server queries re-run via URL params)
  useEffect(() => {
    const sp = new URLSearchParams();
    if (filters.q) sp.set("q", filters.q);
    if (filters.status) sp.set("status", filters.status);
    if (filters.prioritet) sp.set("prioritet", filters.prioritet);
    if (filters.zemanet) sp.set("zemanet", "1");
    if (filters.gecikme) sp.set("gecikme", "1");
    if (filters.odenilmis) sp.set("odenilmis", "1");
    if (filters.xarici) sp.set("xarici", "1");
    if (filters.iscisi) sp.set("iscisi", filters.iscisi);
    if (filters.defekt) sp.set("defekt", filters.defekt);
    if (filters.filial) sp.set("filial", filters.filial);
    if (filters.marka) sp.set("marka", filters.marka);
    if (filters.kateqoriya) sp.set("kateqoriya", filters.kateqoriya);
    if (filters.from) sp.set("from", filters.from);
    if (filters.to) sp.set("to", filters.to);
    const next = sp.toString();
    const current = searchParams.toString();
    if (next === current) return;
    router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Server-side filter artıq tətbiq olunub. Burada yalnız client-side prioritet süzgəci əlavə.
  const filtered = useMemo(() => {
    return initial.filter((r) => {
      if (filters.prioritet && r.prioritet !== filters.prioritet) return false;
      return true;
    });
  }, [initial, filters.prioritet]);

  function resetAll() {
    setFilters(DEFAULT_FILTERS);
  }

  const hasFilter =
    !!filters.q ||
    !!filters.status ||
    !!filters.prioritet ||
    filters.zemanet ||
    filters.gecikme ||
    filters.odenilmis ||
    filters.xarici ||
    !!filters.iscisi ||
    !!filters.defekt ||
    !!filters.filial ||
    !!filters.marka ||
    !!filters.kateqoriya ||
    !!filters.from ||
    !!filters.to;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Axtar: nömrə, müştəri, telefon, IMEI, seriya, məhsul ad, kod, barkod, problem mətni…"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          className="h-9 min-w-[280px] flex-1"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Bütün statuslar</option>
          <option value="acig">Aktiv (açıq)</option>
          {Object.entries(SERVIS_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={filters.prioritet}
          onChange={(e) => setFilters((f) => ({ ...f, prioritet: e.target.value }))}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Prioritet</option>
          {Object.entries(SERVIS_PRIORITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {texniki.length > 0 && (
          <select
            value={filters.iscisi}
            onChange={(e) => setFilters((f) => ({ ...f, iscisi: e.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            title="Məsul texniki"
          >
            <option value="">Məsul texniki</option>
            {texniki.map((t) => (
              <option key={t.id} value={t.id}>{t.ad}</option>
            ))}
          </select>
        )}
        {defektKateq.length > 0 && (
          <select
            value={filters.defekt}
            onChange={(e) => setFilters((f) => ({ ...f, defekt: e.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            title="Defekt kateqoriyası"
          >
            <option value="">Defekt növü</option>
            {defektKateq.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.qrup ? `${d.qrup} · ${d.ad}` : d.ad}
              </option>
            ))}
          </select>
        )}
        {markalar.length > 0 && (
          <select
            value={filters.marka}
            onChange={(e) => setFilters((f) => ({ ...f, marka: e.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Marka</option>
            {markalar.map((m) => (
              <option key={m.id} value={String(m.id)}>{m.ad}</option>
            ))}
          </select>
        )}
        {kateqoriyalar.length > 0 && (
          <select
            value={filters.kateqoriya}
            onChange={(e) => setFilters((f) => ({ ...f, kateqoriya: e.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Kateqoriya</option>
            {kateqoriyalar.map((k) => (
              <option key={k.id} value={String(k.id)}>{k.ad}</option>
            ))}
          </select>
        )}
        {filiallar.length > 0 && (
          <select
            value={filters.filial}
            onChange={(e) => setFilters((f) => ({ ...f, filial: e.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Filial</option>
            {filiallar.map((f) => (
              <option key={f.id} value={String(f.id)}>{f.ad}</option>
            ))}
          </select>
        )}
        <Input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="h-9 w-[140px]"
          title="Başlanğıc tarix"
        />
        <Input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="h-9 w-[140px]"
          title="Bitmə tarix"
        />
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={filters.zemanet}
            onChange={(e) => setFilters((f) => ({ ...f, zemanet: e.target.checked }))}
            className="h-3.5 w-3.5 accent-primary"
          />
          Zəmanətli
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={filters.gecikme}
            onChange={(e) => setFilters((f) => ({ ...f, gecikme: e.target.checked }))}
            className="h-3.5 w-3.5 accent-primary"
          />
          Gecikən
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={filters.odenilmis}
            onChange={(e) => setFilters((f) => ({ ...f, odenilmis: e.target.checked }))}
            className="h-3.5 w-3.5 accent-primary"
          />
          Ödənilmiş
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={filters.xarici}
            onChange={(e) => setFilters((f) => ({ ...f, xarici: e.target.checked }))}
            className="h-3.5 w-3.5 accent-primary"
          />
          Xarici servis
        </label>
        {hasFilter && (
          <button
            type="button"
            onClick={resetAll}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground hover:bg-secondary"
          >
            Sıfırla
          </button>
        )}
        <div className="ml-auto">{cols.render()}</div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Filtrlərə uyğun servis sifarişi yoxdur.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {cols.order.map((key) => {
                  if (!cols.isVisible(key)) return null;
                  const def = COLUMN_DEFS.find((c) => c.key === key);
                  if (!def) return null;
                  const right = key === "qiymet" || key === "alinan" || key === "amel";
                  return (
                    <th key={key} className={`px-3 py-2.5 ${right ? "text-right" : ""}`}>
                      {def.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <ServisRow
                  key={r.id}
                  row={r}
                  order={cols.order}
                  isVisible={cols.isVisible}
                  router={router}
                  pathname={pathname}
                  searchParams={searchParams}
                />
              ))}
            </tbody>
          </table>
          <div className="border-t border-border/40 px-3 py-2 text-xs text-muted-foreground">
            Cəmi: {filtered.length} sifariş
          </div>
        </div>
      )}
    </div>
  );
}

function ServisRow({
  row,
  order,
  isVisible,
  router,
  pathname,
  searchParams,
}: {
  row: ServisRow;
  order: string[];
  isVisible: (k: string) => boolean;
  router: ReturnType<typeof useRouter>;
  pathname: string;
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  const [pending, startTransition] = useTransition();
  const status = SERVIS_STATUS_LABELS[row.status] ?? SERVIS_STATUS_LABELS.qebul_edildi;
  const prio = SERVIS_PRIORITY_LABELS[row.prioritet] ?? SERVIS_PRIORITY_LABELS.orta;
  const possibleNext = NEXT_STAGES[row.status] ?? [];
  const overdue = row.texmini_tehvil && new Date(row.texmini_tehvil) < new Date() && !row.qapanma_tarixi;
  const paymentStatus = paymentStatusFor(row);

  function openDetail() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("detail", row.id);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  function changeStatus(s: string) {
    startTransition(async () => {
      const res = await changeServisStatus(row.id, s as never);
      if (res.ok) {
        toast.success("Status dəyişdi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function sendSms() {
    startTransition(async () => {
      const msg = `Hörmətli ${row.musteri_ad}, servis sifarişiniz (${row.nomre}) statusu: ${status.label}`;
      const res = await sendCustomerNotification(row.id, "sms", msg);
      if (res.ok) toast.success("SMS göndərildi (mock)");
      else toast.error(res.error);
    });
  }

  function cells(key: string) {
    switch (key) {
      case "nomre":
        return (
          <td key={key} className="px-3 py-2.5 align-top">
            <button
              type="button"
              onClick={openDetail}
              className="text-left hover:text-primary-light"
            >
              <div className="font-mono text-xs font-medium">{row.nomre}</div>
              {row.yaradildi && (
                <div className="text-xs text-muted-foreground">{fmt(row.yaradildi)}</div>
              )}
            </button>
          </td>
        );
      case "musteri":
        return (
          <td key={key} className="px-3 py-2.5 align-top">
            <div className="font-medium">{row.musteri_ad}</div>
            {row.yenidenGelen && (
              <Badge variant="outline" className="mt-0.5 text-[10px] border-amber-400/30 bg-amber-400/10 text-amber-300">
                <Repeat className="h-2.5 w-2.5" /> Yenidən gəlir
              </Badge>
            )}
          </td>
        );
      case "telefon":
        return (
          <td key={key} className="px-3 py-2.5 align-top">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              {row.musteri_telefon}
            </div>
          </td>
        );
      case "mehsul":
        return (
          <td key={key} className="px-3 py-2.5 align-top">
            <div className="min-w-0">
              {row.mehsul_id ? (
                <ProductInline
                  id={row.mehsul_id}
                  ad={row.mehsul_ad}
                  kod={row.mehsul_kod}
                  barkod={row.mehsul_barkod}
                  showImage={false}
                  size="xs"
                />
              ) : (
                <span className="text-sm font-medium">{row.mehsul_ad}</span>
              )}
            </div>
          </td>
        );
      case "seri":
        return (
          <td key={key} className="px-3 py-2.5 align-top">
            {row.mehsul_seri_nomresi ? (
              <span className="font-mono text-xs">{row.mehsul_seri_nomresi}</span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </td>
        );
      case "problem":
        return (
          <td key={key} className="px-3 py-2.5 align-top">
            <p className="line-clamp-2 max-w-xs text-xs text-muted-foreground">{row.problem_tesviri}</p>
          </td>
        );
      case "status":
        return (
          <td key={key} className="px-3 py-2.5 align-top">
            <ServisStatusBadge value={row.status} />
            {overdue && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-400">
                <AlertTriangle className="h-3 w-3" /> Gecikib
              </div>
            )}
          </td>
        );
      case "prioritet":
        return (
          <td key={key} className="px-3 py-2.5 align-top">
            <ServisPriorityBadge value={row.prioritet} />
          </td>
        );
      case "texniki":
        return <td key={key} className="px-3 py-2.5 align-top text-xs">{row.servis_iscisi_ad ?? "—"}</td>;
      case "qebul_eden":
        return <td key={key} className="px-3 py-2.5 align-top text-xs">{row.qebul_eden_ad ?? "—"}</td>;
      case "qebul_tarixi":
        return <td key={key} className="px-3 py-2.5 align-top text-xs">{fmt(row.yaradildi)}</td>;
      case "ved_tarixi":
        return (
          <td key={key} className="px-3 py-2.5 align-top text-xs">
            <span className={overdue ? "text-rose-400 font-medium" : ""}>{fmt(row.texmini_tehvil)}</span>
          </td>
        );
      case "tehvil_tarixi":
        return <td key={key} className="px-3 py-2.5 align-top text-xs">{fmt(row.qapanma_tarixi)}</td>;
      case "qiymet":
        return (
          <td key={key} className="px-3 py-2.5 align-top text-right tabular-nums text-xs">
            {row.temir_xerci > 0 ? formatMoney(row.temir_xerci) : "—"}
          </td>
        );
      case "alinan":
        return (
          <td key={key} className="px-3 py-2.5 align-top text-right tabular-nums text-xs font-semibold">
            {row.musteriden_alinan > 0 ? formatMoney(row.musteriden_alinan) : "—"}
          </td>
        );
      case "ödəniş":
        return (
          <td key={key} className="px-3 py-2.5 align-top">
            <Badge variant="outline" className={paymentStatus.cls}>{paymentStatus.label}</Badge>
          </td>
        );
      case "zemanet":
        return (
          <td key={key} className="px-3 py-2.5 align-top">
            {row.zemanet_var ? (
              <Badge variant="outline" className="text-[10px] border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                <ShieldCheck className="h-2.5 w-2.5" /> Var
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </td>
        );
      case "yeniden":
        return (
          <td key={key} className="px-3 py-2.5 align-top text-xs">
            {row.yenidenGelen ? "Bəli" : "Xeyr"}
          </td>
        );
      case "kanal":
        return <td key={key} className="px-3 py-2.5 align-top text-xs text-muted-foreground">POS</td>;
      case "satis":
        return (
          <td key={key} className="px-3 py-2.5 align-top text-xs">
            {row.satis_id ? (
              <Link href={`/ticaret/satislar/${row.satis_id}`} className="text-primary-light hover:underline">
                Satışa keç →
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </td>
        );
      case "filial":
        return <td key={key} className="px-3 py-2.5 align-top text-xs">{row.filial_ad ?? "—"}</td>;
      case "amel":
        return (
          <td
            key={key}
            className="px-3 py-2.5 align-top text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-end gap-1.5">
              <RowIconGroup>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={openDetail}
                title="Modal detay"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              {possibleNext.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon-sm" variant="ghost" disabled={pending} title="Növbəti mərhələ">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {possibleNext
                      .filter((s) => s !== "redd_edildi")
                      .map((s) => (
                        <DropdownMenuItem key={s} onSelect={() => changeStatus(s)}>
                          → {SERVIS_STATUS_LABELS[s]?.label ?? s}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {possibleNext.includes("redd_edildi") && (
                <RejectReasonDialog
                  servisId={row.id}
                  trigger={
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Rədd et"
                      className="text-rose-400 hover:bg-rose-500/10"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
              )}
              <Button size="icon-sm" variant="ghost" onClick={sendSms} disabled={pending} title="SMS göndər">
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
              <RowIconButton
                as="a"
                tone="print"
                title="Qəbz çap et"
                href={`/servis/${row.id}/print?auto=1`}
                target="_blank"
                rel="noopener"
              >
                <Printer className="h-4 w-4" />
              </RowIconButton>
              </RowIconGroup>
              {row.status === "temir_edildi" && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => changeStatus("musteriye_tehvil")}
                  disabled={pending}
                  title="Yekun et"
                  className="text-emerald-500 hover:bg-emerald-500/10"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </td>
        );
      default:
        return null;
    }
  }

  return (
    <tr
      className={`cursor-pointer border-b border-border/30 transition hover:bg-secondary/40 ${pending ? "opacity-50" : ""}`}
      onClick={openDetail}
    >
      {order.map((key) => (isVisible(key) ? cells(key) : null))}
    </tr>
  );
}

function paymentStatusFor(r: ServisRow) {
  if (r.temir_xerci === 0 && r.musteriden_alinan === 0)
    return { label: "—", cls: "border-slate-400/30 bg-slate-400/10 text-slate-300" };
  if (r.musteriden_alinan >= r.temir_xerci && r.temir_xerci > 0)
    return { label: "Ödənilib", cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" };
  if (r.musteriden_alinan > 0)
    return { label: "Qismən", cls: "border-amber-400/30 bg-amber-400/10 text-amber-300" };
  return { label: "Borc", cls: "border-rose-400/30 bg-rose-400/10 text-rose-300" };
}
