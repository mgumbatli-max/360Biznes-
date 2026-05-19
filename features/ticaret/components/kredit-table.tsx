"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CreditCard, ExternalLink, RefreshCw, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { formatDate, formatMoney } from "@/lib/utils";
import { recordKreditPayment } from "../kredit-actions";
import type { KreditRow } from "../kredit-queries";
import { CustomerDrawer } from "@/features/elaqe/components/customer-drawer";

const STORAGE_KEY = "ticaret-kredit-cols-v2";

const COLUMN_DEFS: ColumnDef[] = [
  { key: "nomre", label: "Nömrə", required: true },
  { key: "tarix", label: "Tarix" },
  { key: "musteri", label: "Müştəri" },
  { key: "bank", label: "Bank" },
  { key: "telefon", label: "Telefon" },
  { key: "satici", label: "Satıcı" },
  { key: "anbar", label: "Anbar" },
  { key: "satir", label: "Sətir" },
  { key: "son_mebleg", label: "Cəmi" },
  { key: "komissiya", label: "Komissiya" },
  { key: "magaza_net", label: "Net çatdı" },
  { key: "odenilmis", label: "Ödənilmiş" },
  { key: "qaliq", label: "Qalıq" },
  { key: "qeyd_status", label: "Status" },
  { key: "gecikme", label: "Gecikmə" },
];

const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

const DEFAULT_VISIBLE: Record<string, boolean> = {
  nomre: true,
  tarix: true,
  musteri: true,
  bank: true,
  telefon: false,
  satici: false,
  anbar: false,
  satir: false,
  son_mebleg: true,
  komissiya: true,
  magaza_net: true,
  odenilmis: true,
  qaliq: false,
  qeyd_status: true,
  gecikme: false,
};

type SortKey = "tarix" | "musteri" | "son_mebleg" | "magaza_net" | "odenilmis" | "qaliq" | "gecikme";

type Hesab = { id: string; ad: string };

export function KreditTable({
  items,
  total,
  hesablar = [],
}: {
  items: KreditRow[];
  total: number;
  hesablar?: Hesab[];
}) {
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ visible: DEFAULT_VISIBLE, order: DEFAULT_ORDER }),
        );
      }
    } catch {}
  }, []);

  const cols = useColumnToggle(STORAGE_KEY, COLUMN_DEFS, DEFAULT_ORDER);
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const sortBy = (sp.get("sort") ?? "") as SortKey | "";
  const sortDir = (sp.get("dir") as SortDir) ?? "asc";

  const [openPay, setOpenPay] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function setSort(key: string) {
    const newDir: SortDir = sortBy === key && sortDir === "asc" ? "desc" : "asc";
    const params = new URLSearchParams(sp.toString());
    params.set("sort", key);
    params.set("dir", newDir);
    router.push(`${pathname}?${params.toString()}`);
  }

  const sorted = useMemo(() => {
    if (!sortBy) return items;
    const mult = sortDir === "asc" ? 1 : -1;
    const cs = (a: string | null, b: string | null) => (a ?? "").localeCompare(b ?? "", "az") * mult;
    const cn = (a: number, b: number) => (a - b) * mult;
    const cd = (a: Date | null, b: Date | null) =>
      ((a ? a.getTime() : 0) - (b ? b.getTime() : 0)) * mult;
    return [...items].sort((a, b) => {
      switch (sortBy) {
        case "tarix": return cd(a.tarix, b.tarix);
        case "musteri": return cs(a.musteri_ad, b.musteri_ad);
        case "son_mebleg": return cn(a.son_mebleg, b.son_mebleg);
        case "magaza_net": return cn(a.magaza_net, b.magaza_net);
        case "qaliq": return cn(a.qaliq, b.qaliq);
        case "gecikme": return cn(a.gecikme_gun, b.gecikme_gun);
        case "odenilmis": return cn(a.odenilmis, b.odenilmis);
        default: return 0;
      }
    });
  }, [items, sortBy, sortDir]);

  async function onRecordPayment(t: KreditRow, formData: FormData) {
    const amount = Number(formData.get("amount"));
    const hesabId = String(formData.get("hesab_id") ?? "");
    const tarix = String(formData.get("tarix") ?? "");
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Düzgün məbləğ daxil edin");
      return;
    }
    if (!hesabId) {
      alert("Hesab seçin");
      return;
    }
    if (!t.kredit_id) {
      alert("Bu satışın kredit qeydi tapılmadı");
      return;
    }
    setBusy(t.id);
    const r = await recordKreditPayment(t.kredit_id, amount, hesabId, tarix);
    setBusy(null);
    if (!r.ok) alert(r.error);
    else {
      setOpenPay(null);
      startTransition(() => router.refresh());
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">Kredit qeydi yoxdur</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          <Link href="/ticaret/kredit-yeni" className="text-primary hover:underline">Yeni kredit qeydi</Link> yaratmaq üçün düyməyə vurun.
        </p>
      </div>
    );
  }

  const statusLabel = (s: string) => {
    switch (s) {
      case "tamamlandi": return { ad: "Tamamlandı", cls: "bg-success/15 text-success border-success/30" };
      case "qismen": return { ad: "Qismən ödənilib", cls: "bg-warning/15 text-warning border-warning/30" };
      case "redd": return { ad: "Rədd edildi", cls: "bg-danger/15 text-danger border-danger/30" };
      default: return { ad: "Gözlənilir", cls: "bg-secondary text-muted-foreground border-border" };
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-sm font-semibold">
          Kredit qeydləri <span className="ml-2 text-xs font-normal text-muted-foreground">{total} nəticə</span>
        </h3>
        {cols.render()}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {cols.order.map((key) => {
                if (!cols.isVisible(key)) return null;
                switch (key) {
                  case "nomre": return <th key={key} className="px-3 py-2.5">Nömrə</th>;
                  case "tarix": return <SortableTh key={key} label="Tarix" current={sortBy} sortKey="tarix" dir={sortDir} onClick={setSort} />;
                  case "musteri": return <SortableTh key={key} label="Müştəri" current={sortBy} sortKey="musteri" dir={sortDir} onClick={setSort} />;
                  case "bank": return <th key={key} className="px-3 py-2.5">Bank</th>;
                  case "telefon": return <th key={key} className="px-3 py-2.5">Telefon</th>;
                  case "satici": return <th key={key} className="px-3 py-2.5">Satıcı</th>;
                  case "anbar": return <th key={key} className="px-3 py-2.5">Anbar</th>;
                  case "satir": return <th key={key} className="px-3 py-2.5 text-center">Sətir</th>;
                  case "son_mebleg": return <SortableTh key={key} label="Cəmi" current={sortBy} sortKey="son_mebleg" dir={sortDir} onClick={setSort} align="right" />;
                  case "komissiya": return <th key={key} className="px-3 py-2.5 text-right">Komissiya</th>;
                  case "magaza_net": return <SortableTh key={key} label="Net çatdı" current={sortBy} sortKey="magaza_net" dir={sortDir} onClick={setSort} align="right" />;
                  case "odenilmis": return <SortableTh key={key} label="Ödənilmiş" current={sortBy} sortKey="odenilmis" dir={sortDir} onClick={setSort} align="right" />;
                  case "qaliq": return <SortableTh key={key} label="Qalıq" current={sortBy} sortKey="qaliq" dir={sortDir} onClick={setSort} align="right" />;
                  case "qeyd_status": return <th key={key} className="px-3 py-2.5">Status</th>;
                  case "gecikme": return <SortableTh key={key} label="Gecikmə" current={sortBy} sortKey="gecikme" dir={sortDir} onClick={setSort} align="center" />;
                  default: return null;
                }
              })}
              <th className="px-3 py-2.5 text-right">Əməliyyat</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const isOpen = openPay === t.id;
              const isBusy = busy === t.id;
              const sLabel = statusLabel(t.qeyd_status);
              const cells: Record<string, React.ReactNode> = {
                nomre: (
                  <td key="nomre" className="px-3 py-2.5">
                    <Link href={`/ticaret/satislar/${t.id}`} className="font-mono text-xs font-medium hover:text-primary">
                      {t.nomre}
                    </Link>
                  </td>
                ),
                tarix: (
                  <td key="tarix" className="px-3 py-2.5 text-xs text-muted-foreground">{formatDate(t.tarix)}</td>
                ),
                musteri: (
                  <td key="musteri" className="px-3 py-2.5">
                    {t.musteri_id && t.musteri_ad ? (
                      <CustomerDrawer customerId={t.musteri_id}>
                        <button type="button" className="text-left text-sm transition hover:text-primary hover:underline">
                          {t.musteri_ad}
                        </button>
                      </CustomerDrawer>
                    ) : (
                      <div className="text-sm">{t.musteri_ad ?? <span className="text-muted-foreground">—</span>}</div>
                    )}
                  </td>
                ),
                bank: (
                  <td key="bank" className="px-3 py-2.5 text-xs">{t.bank ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                telefon: (
                  <td key="telefon" className="px-3 py-2.5 text-xs text-muted-foreground">{t.musteri_telefon ?? "—"}</td>
                ),
                satici: (
                  <td key="satici" className="px-3 py-2.5 text-xs text-muted-foreground">{t.satici_ad ?? "—"}</td>
                ),
                anbar: (
                  <td key="anbar" className="px-3 py-2.5 text-xs">{t.anbar_ad ?? "—"}</td>
                ),
                satir: (
                  <td key="satir" className="px-3 py-2.5 text-center tabular-nums text-xs">{t.satir_say}</td>
                ),
                son_mebleg: (
                  <td key="son_mebleg" className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatMoney(t.son_mebleg)}</td>
                ),
                komissiya: (
                  <td key="komissiya" className="px-3 py-2.5 text-right tabular-nums text-xs text-danger">
                    {t.bank_komissiya > 0 ? `-${formatMoney(t.bank_komissiya)}` : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                magaza_net: (
                  <td key="magaza_net" className="px-3 py-2.5 text-right tabular-nums font-semibold text-success">{formatMoney(t.magaza_net)}</td>
                ),
                odenilmis: (
                  <td key="odenilmis" className="px-3 py-2.5 text-right tabular-nums text-xs text-success">
                    {t.odenilmis > 0 ? formatMoney(t.odenilmis) : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                qaliq: (
                  <td key="qaliq" className="px-3 py-2.5 text-right tabular-nums">
                    {t.qaliq > 0 ? <span className="text-warning">{formatMoney(t.qaliq)}</span> : <span className="text-success">Ödənilib</span>}
                  </td>
                ),
                qeyd_status: (
                  <td key="qeyd_status" className="px-3 py-2.5">
                    <Badge variant="outline" className={`text-[10px] ${sLabel.cls}`}>{sLabel.ad}</Badge>
                  </td>
                ),
                gecikme: (
                  <td key="gecikme" className="px-3 py-2.5 text-center tabular-nums">
                    {t.gecikme_gun > 0 ? (
                      <Badge variant="outline" className="bg-danger/15 text-danger border-danger/30 text-[10px]">
                        {t.gecikme_gun} gün
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                ),
              };
              return (
                <>
                  <tr key={t.id} className="border-b border-border/30 transition hover:bg-secondary/40">
                    {cols.order.map((k) => (cols.isVisible(k) ? cells[k] : null))}
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        {t.qeyd_status !== "tamamlandi" && t.kredit_id && (
                          <button
                            type="button"
                            onClick={() => setOpenPay(isOpen ? null : t.id)}
                            disabled={isBusy}
                            title="Ödəniş qeyd et"
                            className="inline-flex h-7 items-center gap-0.5 rounded-md bg-success/15 px-2 text-[10.5px] font-semibold text-success hover:bg-success/25 disabled:opacity-50"
                          >
                            {isBusy ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Wallet className="h-3 w-3" />}
                            Ödəniş qeyd et
                          </button>
                        )}
                        <Link
                          href={`/ticaret/satislar/${t.id}`}
                          title="Satış detalı"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${t.id}-pay`} className="border-b border-border/30 bg-success/5">
                      <td colSpan={cols.order.filter((k) => cols.isVisible(k)).length + 1} className="px-3 py-3">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            onRecordPayment(t, new FormData(e.currentTarget));
                          }}
                          className="flex flex-wrap items-end gap-2"
                        >
                          <div>
                            <label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                              Məbləğ (net: {formatMoney(t.magaza_net)})
                            </label>
                            <input
                              type="number"
                              name="amount"
                              required
                              min="0.01"
                              step="0.01"
                              defaultValue={Math.max(0, t.magaza_net - t.odenilmis).toFixed(2)}
                              className="block h-9 w-40 rounded-lg border border-border bg-background px-2 text-sm focus:border-primary focus:outline-none"
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Hesab</label>
                            <select
                              name="hesab_id"
                              required
                              className="block h-9 w-48 rounded-lg border border-border bg-background px-2 text-sm focus:border-primary focus:outline-none"
                            >
                              <option value="">— Seçin —</option>
                              {hesablar.map((h) => (
                                <option key={h.id} value={h.id}>{h.ad}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Tarix</label>
                            <input
                              type="date"
                              name="tarix"
                              defaultValue={new Date().toISOString().slice(0, 10)}
                              className="block h-9 w-36 rounded-lg border border-border bg-background px-2 text-sm focus:border-primary focus:outline-none"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={isBusy}
                            className="inline-flex h-9 items-center gap-1 rounded-lg bg-success px-3 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-50"
                          >
                            {isBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
                            Qeyd et
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenPay(null)}
                            className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-secondary"
                          >
                            Bağla
                          </button>
                        </form>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
