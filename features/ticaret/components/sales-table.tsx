"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ShoppingCart, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { SaleStatusBadge, PaymentBadge } from "./sale-status-badge";
import { SalesBulkBar } from "./sales-bulk-bar";
import { CustomerDrawer } from "@/features/elaqe/components/customer-drawer";
import { formatDate, formatMoney } from "@/lib/utils";
import type { SaleListItem } from "../satis-queries";

type Props = { items: SaleListItem[]; total: number };

const STORAGE_KEY = "ticaret-satislar-cols-v1";

const COLUMN_DEFS: ColumnDef[] = [
  { key: "nomre",         label: "Nömrə", required: true },
  { key: "tarix",         label: "Tarix" },
  { key: "yaradildi_col", label: "Yaradılma vaxtı" },
  { key: "yenilendi_col", label: "Son düzəliş" },
  { key: "musteri",       label: "Müştəri" },
  { key: "satici",        label: "Satıcı (kassir)" },
  { key: "yaradan",       label: "Yaradan" },
  { key: "anbar",         label: "Anbar" },
  { key: "filial",        label: "Filial" },
  { key: "kassa",         label: "Kassa" },
  { key: "satir",         label: "Sətir sayı" },
  { key: "status_col",    label: "Status" },
  { key: "odenis",        label: "Ödəniş növü" },
  { key: "kanal",         label: "Satış kanalı" },
  { key: "umumi",         label: "Cəmi (umumi)" },
  { key: "endirim",       label: "Endirim cəmi" },
  { key: "son_mebleg",    label: "Son məbləğ" },
  { key: "alinan",        label: "Alınan (ödənilmiş)" },
  { key: "qaliq",         label: "Qalıq borc" },
  { key: "qaime_col",     label: "Qaimə №" },
  { key: "cek_col",       label: "Çek №" },
  { key: "vergi_col",     label: "Vergi kassası" },
  { key: "qeyd_col",      label: "Qeyd" },
];

const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

const DEFAULT_VISIBLE: Record<string, boolean> = {
  nomre: true,
  tarix: true,
  yaradildi_col: false,
  yenilendi_col: false,
  musteri: true,
  satici: true,
  yaradan: false,
  anbar: false,
  filial: false,
  kassa: false,
  satir: true,
  status_col: true,
  odenis: true,
  kanal: false,
  umumi: false,
  endirim: false,
  son_mebleg: true,
  alinan: false,
  qaliq: true,
  qaime_col: false,
  cek_col: false,
  vergi_col: false,
  qeyd_col: false,
};

type SortKey =
  | "tarix" | "nomre" | "musteri" | "status" | "cemi" | "endirim"
  | "alinan" | "qalig_borc" | "satir_say" | "yaradildi";

export function SalesTable({ items, total }: Props) {
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

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const allSelected = items.length > 0 && items.every((s) => selected.has(s.id));
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (items.every((s) => prev.has(s.id))) {
        const next = new Set(prev);
        for (const s of items) next.delete(s.id);
        return next;
      }
      const next = new Set(prev);
      for (const s of items) next.add(s.id);
      return next;
    });
  }
  function clearSel() { setSelected(new Set()); }

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
    const cmpStr = (a: string | null | undefined, b: string | null | undefined) =>
      (a ?? "").localeCompare(b ?? "", "az") * mult;
    const cmpNum = (a: number, b: number) => (a - b) * mult;
    const cmpDate = (a: Date | null, b: Date | null) =>
      ((a ? a.getTime() : 0) - (b ? b.getTime() : 0)) * mult;
    return [...items].sort((a, b) => {
      switch (sortBy) {
        case "tarix": return cmpDate(a.tarix, b.tarix);
        case "nomre": return cmpStr(a.nomre, b.nomre);
        case "musteri": return cmpStr(a.musteri_ad, b.musteri_ad);
        case "status": return cmpStr(a.status, b.status);
        case "cemi": return cmpNum(a.son_mebleg, b.son_mebleg);
        case "endirim": return cmpNum(a.endirim_mebleg, b.endirim_mebleg);
        case "alinan": return cmpNum(a.odenilmis, b.odenilmis);
        case "qalig_borc": return cmpNum(a.son_mebleg - a.odenilmis, b.son_mebleg - b.odenilmis);
        case "satir_say": return cmpNum(a.satir_say, b.satir_say);
        case "yaradildi": return cmpDate(a.yaradildi, b.yaradildi);
        default: return 0;
      }
    });
  }, [items, sortBy, sortDir]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
          <ShoppingCart className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">Satış yoxdur</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Filtri sıfırlayın və ya POS-dan ilk satışı edin.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-sm font-semibold">
          Satışlar <span className="ml-2 text-xs font-normal text-muted-foreground">{total} nəticə</span>
        </h3>
        {cols.render()}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Hamısını seç"
                  className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-primary"
                />
              </th>
              {cols.order.map((key) => {
                if (!cols.isVisible(key)) return null;
                switch (key) {
                  case "nomre":         return <SortableTh key={key} label="Nömrə" current={sortBy} sortKey="nomre" dir={sortDir} onClick={setSort} />;
                  case "tarix":         return <SortableTh key={key} label="Tarix" current={sortBy} sortKey="tarix" dir={sortDir} onClick={setSort} />;
                  case "yaradildi_col": return <SortableTh key={key} label="Yaradıldı" current={sortBy} sortKey="yaradildi" dir={sortDir} onClick={setSort} />;
                  case "yenilendi_col": return <th key={key} className="px-3 py-2.5">Son düzəliş</th>;
                  case "musteri":       return <SortableTh key={key} label="Müştəri" current={sortBy} sortKey="musteri" dir={sortDir} onClick={setSort} />;
                  case "satici":        return <th key={key} className="px-3 py-2.5">Satıcı</th>;
                  case "yaradan":       return <th key={key} className="px-3 py-2.5">Yaradan</th>;
                  case "anbar":         return <th key={key} className="px-3 py-2.5">Anbar</th>;
                  case "filial":        return <th key={key} className="px-3 py-2.5">Filial</th>;
                  case "kassa":         return <th key={key} className="px-3 py-2.5">Kassa</th>;
                  case "satir":         return <SortableTh key={key} label="Sətir" current={sortBy} sortKey="satir_say" dir={sortDir} onClick={setSort} align="center" />;
                  case "status_col":    return <SortableTh key={key} label="Status" current={sortBy} sortKey="status" dir={sortDir} onClick={setSort} />;
                  case "odenis":        return <th key={key} className="px-3 py-2.5">Ödəniş</th>;
                  case "kanal":         return <th key={key} className="px-3 py-2.5">Kanal</th>;
                  case "umumi":         return <th key={key} className="px-3 py-2.5 text-right">Cəmi</th>;
                  case "endirim":       return <SortableTh key={key} label="Endirim" current={sortBy} sortKey="endirim" dir={sortDir} onClick={setSort} align="right" />;
                  case "son_mebleg":    return <SortableTh key={key} label="Məbləğ" current={sortBy} sortKey="cemi" dir={sortDir} onClick={setSort} align="right" />;
                  case "alinan":        return <SortableTh key={key} label="Alınan" current={sortBy} sortKey="alinan" dir={sortDir} onClick={setSort} align="right" />;
                  case "qaliq":         return <SortableTh key={key} label="Qalıq" current={sortBy} sortKey="qalig_borc" dir={sortDir} onClick={setSort} align="right" />;
                  case "qaime_col":     return <th key={key} className="px-3 py-2.5">Qaimə №</th>;
                  case "cek_col":       return <th key={key} className="px-3 py-2.5">Çek №</th>;
                  case "vergi_col":     return <th key={key} className="px-3 py-2.5">Vergi</th>;
                  case "qeyd_col":      return <th key={key} className="px-3 py-2.5">Qeyd</th>;
                  default: return null;
                }
              })}
              <th className="px-3 py-2.5 text-right w-12"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const unpaid = s.son_mebleg - s.odenilmis;
              const cells: Record<string, React.ReactNode> = {
                nomre: (
                  <td key="nomre" className="px-3 py-2.5">
                    <Link href={`/ticaret/satislar/${s.id}`} className="font-mono text-xs font-medium hover:text-primary">
                      {s.nomre}
                    </Link>
                  </td>
                ),
                tarix: (
                  <td key="tarix" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(s.tarix).toLocaleDateString("az-AZ")}
                  </td>
                ),
                yaradildi_col: (
                  <td key="yaradildi_col" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {s.yaradildi ? formatDate(s.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                yenilendi_col: (
                  <td key="yenilendi_col" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {s.yenilendi ? formatDate(s.yenilendi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                musteri: (
                  <td key="musteri" className="px-3 py-2.5">
                    {s.musteri_id && s.musteri_ad ? (
                      <CustomerDrawer customerId={s.musteri_id}>
                        <button
                          type="button"
                          className="text-left text-sm transition hover:text-primary hover:underline"
                          title="Müştəri kartını aç"
                        >
                          {s.musteri_ad}
                        </button>
                      </CustomerDrawer>
                    ) : (
                      <div className="text-sm">{s.musteri_ad ?? <span className="text-muted-foreground">—</span>}</div>
                    )}
                  </td>
                ),
                satici: (
                  <td key="satici" className="px-3 py-2.5 text-xs text-muted-foreground">{s.satici_ad ?? "—"}</td>
                ),
                yaradan: (
                  <td key="yaradan" className="px-3 py-2.5 text-xs text-muted-foreground">{s.yaradan_ad ?? "—"}</td>
                ),
                anbar: (
                  <td key="anbar" className="px-3 py-2.5 text-xs">{s.anbar_ad ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                filial: (
                  <td key="filial" className="px-3 py-2.5 text-xs">{s.filial_ad ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                kassa: (
                  <td key="kassa" className="px-3 py-2.5 text-xs">{s.kassa_ad ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                satir: (
                  <td key="satir" className="px-3 py-2.5 text-center tabular-nums text-xs">{s.satir_say}</td>
                ),
                status_col: (
                  <td key="status_col" className="px-3 py-2.5">
                    <SaleStatusBadge value={s.status} />
                  </td>
                ),
                odenis: (
                  <td key="odenis" className="px-3 py-2.5">
                    <PaymentBadge value={s.odenis_nov} />
                  </td>
                ),
                kanal: (
                  <td key="kanal" className="px-3 py-2.5 text-xs">
                    {s.marketplace_platform ? (
                      <Badge variant="outline" className="text-[10px]">{s.marketplace_platform}</Badge>
                    ) : s.kassa_ad ? (
                      <Badge variant="outline" className="text-[10px]">POS</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                umumi: (
                  <td key="umumi" className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {s.umumi_mebleg > 0 ? formatMoney(s.umumi_mebleg) : "—"}
                  </td>
                ),
                endirim: (
                  <td key="endirim" className="px-3 py-2.5 text-right tabular-nums text-xs">
                    {s.endirim_mebleg > 0 ? <span className="text-warning">−{formatMoney(s.endirim_mebleg)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                son_mebleg: (
                  <td key="son_mebleg" className="px-3 py-2.5 text-right">
                    <div className="font-semibold tabular-nums">{formatMoney(s.son_mebleg)}</div>
                    {s.maya_alti && (
                      <div className="mt-0.5 text-[10px] font-medium text-danger">maya altı</div>
                    )}
                  </td>
                ),
                alinan: (
                  <td key="alinan" className="px-3 py-2.5 text-right tabular-nums text-xs text-success">
                    {s.odenilmis > 0 ? formatMoney(s.odenilmis) : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                qaliq: (
                  <td key="qaliq" className="px-3 py-2.5 text-right tabular-nums text-xs">
                    {unpaid > 0 ? <span className="text-warning font-medium">{formatMoney(unpaid)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                qaime_col: (
                  <td key="qaime_col" className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {s.qaime_nomresi ? (
                      <span className="inline-flex items-center gap-0.5">
                        <span>{s.qaime_nomresi}</span>
                        <CopyButton value={s.qaime_nomresi} title="Qaimə kopya et" size="xs" />
                      </span>
                    ) : "—"}
                  </td>
                ),
                cek_col: (
                  <td key="cek_col" className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {s.cek_nomresi ?? "—"}
                  </td>
                ),
                vergi_col: (
                  <td key="vergi_col" className="px-3 py-2.5 text-xs">
                    {s.vergi_kassasina_vur ? (
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">Vuruldu</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                qeyd_col: (
                  <td key="qeyd_col" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {s.qeyd ? <span className="line-clamp-2 max-w-xs" title={s.qeyd}>{s.qeyd}</span> : "—"}
                  </td>
                ),
              };
              return (
                <tr key={s.id} className="border-b border-border/30 transition hover:bg-secondary/40">
                  <td className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggleOne(s.id)}
                      aria-label={`${s.nomre} seç`}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-primary"
                    />
                  </td>
                  {cols.order.map((k) => (cols.isVisible(k) ? cells[k] : null))}
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`/ticaret/satislar/${s.id}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title="Detay"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SalesBulkBar
        selectedIds={selectedIds}
        total={items.length}
        onClear={clearSel}
        onSelectAll={toggleAll}
        allSelected={allSelected}
      />
    </div>
  );
}
