"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FileText, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { formatDate, formatMoney } from "@/lib/utils";
import type { ExpenseRow } from "../queries";

type Props = { items: ExpenseRow[]; total: number };

const STORAGE_KEY = "maliyye-xercler-cols-v2";

function extractInvoiceId(qeyd: string | null): string | null {
  if (!qeyd) return null;
  const m = /\[INVOICE:([0-9a-f-]+)\]/i.exec(qeyd);
  return m ? m[1] : null;
}

const ODENIS_LABEL: Record<string, string> = {
  negd: "Nağd",
  kart: "Kart",
  bank: "Bank",
  kecirme: "Köçürmə",
};

const COLUMN_DEFS: ColumnDef[] = [
  { key: "tarix",         label: "Tarix", required: true },
  { key: "yaradildi_col", label: "Yaradılma vaxtı" },
  { key: "yenilendi_col", label: "Son düzəliş" },
  { key: "tesvir",        label: "Təsvir" },
  { key: "qaime_col",     label: "Bağlı qaimə" },
  { key: "kateqoriya",    label: "Kateqoriya" },
  { key: "qrup",          label: "Kateqoriya qrupu" },
  { key: "techizatci",    label: "Təchizatçı" },
  { key: "odenis",        label: "Ödəniş növü" },
  { key: "mebleg",        label: "Məbləğ" },
  { key: "valyuta",       label: "Valyuta" },
  { key: "mezenne",       label: "Məzənnə" },
  { key: "mebleg_azn",    label: "AZN-də məbləğ" },
  { key: "qebz_col",      label: "Sənəd nömrəsi" },
  { key: "fayl_col",      label: "Fayl əlavəsi" },
  { key: "filial",        label: "Filial" },
  { key: "yaradan",       label: "Yaradan" },
  { key: "status_col",    label: "Status" },
  { key: "tesdiqleyen",   label: "Təsdiqləyən" },
  { key: "edv",           label: "ƏDV" },
  { key: "edv_mebleg",    label: "ƏDV məbləği" },
  { key: "dovr",          label: "Dövr" },
  { key: "tag",           label: "Tag/Etiket" },
  { key: "qeyd_col",      label: "Qeyd" },
];

const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

const DEFAULT_VISIBLE: Record<string, boolean> = {
  tarix: true,
  yaradildi_col: false,
  yenilendi_col: false,
  tesvir: true,
  qaime_col: true,
  kateqoriya: true,
  qrup: false,
  techizatci: false,
  odenis: true,
  mebleg: true,
  valyuta: false,
  mezenne: false,
  mebleg_azn: false,
  qebz_col: false,
  fayl_col: false,
  filial: false,
  yaradan: false,
  status_col: false,
  tesdiqleyen: false,
  edv: false,
  edv_mebleg: false,
  dovr: false,
  tag: false,
  qeyd_col: false,
};

type SortKey = "tarix" | "kateqoriya" | "mebleg" | "kassa" | "valyuta" | "yaradildi";

export function ExpensesTable({ items, total }: Props) {
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
        case "kateqoriya": return cmpStr(a.kateqoriya_ad, b.kateqoriya_ad);
        case "mebleg": return cmpNum(a.mebleg, b.mebleg);
        case "kassa": return cmpStr(a.odenis_nov, b.odenis_nov);
        case "valyuta": return cmpStr(a.valyuta, b.valyuta);
        case "yaradildi": return cmpDate(a.yaradildi, b.yaradildi);
        default: return 0;
      }
    });
  }, [items, sortBy, sortDir]);

  const total_mebleg = items.reduce((s, e) => s + e.mebleg, 0);

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-sm font-semibold">
          Xərclər <span className="ml-2 text-xs font-normal text-muted-foreground">{total} qeyd</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums">Cəm: {formatMoney(total_mebleg)}</span>
          {cols.render()}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {cols.order.map((key) => {
                if (!cols.isVisible(key)) return null;
                switch (key) {
                  case "tarix":         return <SortableTh key={key} label="Tarix" current={sortBy} sortKey="tarix" dir={sortDir} onClick={setSort} />;
                  case "yaradildi_col": return <SortableTh key={key} label="Yaradıldı" current={sortBy} sortKey="yaradildi" dir={sortDir} onClick={setSort} />;
                  case "yenilendi_col": return <th key={key} className="px-3 py-2.5">Son düzəliş</th>;
                  case "tesvir":        return <th key={key} className="px-3 py-2.5">Təsvir</th>;
                  case "qaime_col":     return <th key={key} className="px-3 py-2.5">Bağlı qaimə</th>;
                  case "kateqoriya":    return <SortableTh key={key} label="Kateqoriya" current={sortBy} sortKey="kateqoriya" dir={sortDir} onClick={setSort} />;
                  case "qrup":          return <th key={key} className="px-3 py-2.5">Qrup</th>;
                  case "techizatci":    return <th key={key} className="px-3 py-2.5">Təchizatçı</th>;
                  case "odenis":        return <SortableTh key={key} label="Ödəniş" current={sortBy} sortKey="kassa" dir={sortDir} onClick={setSort} />;
                  case "mebleg":        return <SortableTh key={key} label="Məbləğ" current={sortBy} sortKey="mebleg" dir={sortDir} onClick={setSort} align="right" />;
                  case "valyuta":       return <SortableTh key={key} label="Valyuta" current={sortBy} sortKey="valyuta" dir={sortDir} onClick={setSort} />;
                  case "mezenne":       return <th key={key} className="px-3 py-2.5 text-right">Məzənnə</th>;
                  case "mebleg_azn":    return <th key={key} className="px-3 py-2.5 text-right">AZN</th>;
                  case "qebz_col":      return <th key={key} className="px-3 py-2.5">Sənəd №</th>;
                  case "fayl_col":      return <th key={key} className="px-3 py-2.5">Fayl</th>;
                  case "filial":        return <th key={key} className="px-3 py-2.5">Filial</th>;
                  case "yaradan":       return <th key={key} className="px-3 py-2.5">Yaradan</th>;
                  case "status_col":    return <th key={key} className="px-3 py-2.5">Status</th>;
                  case "tesdiqleyen":   return <th key={key} className="px-3 py-2.5">Təsdiqləyən</th>;
                  case "edv":           return <th key={key} className="px-3 py-2.5">ƏDV</th>;
                  case "edv_mebleg":    return <th key={key} className="px-3 py-2.5 text-right">ƏDV məbləği</th>;
                  case "dovr":          return <th key={key} className="px-3 py-2.5">Dövr</th>;
                  case "tag":           return <th key={key} className="px-3 py-2.5">Tag</th>;
                  case "qeyd_col":      return <th key={key} className="px-3 py-2.5">Qeyd</th>;
                  default: return null;
                }
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={cols.order.length} className="py-12 text-center text-sm text-muted-foreground">
                  Xərc yoxdur
                </td>
              </tr>
            )}
            {sorted.map((e) => {
              const cells: Record<string, React.ReactNode> = {
                tarix: (
                  <td key="tarix" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(e.tarix).toLocaleDateString("az-AZ")}
                  </td>
                ),
                yaradildi_col: (
                  <td key="yaradildi_col" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {e.yaradildi ? formatDate(e.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                yenilendi_col: (
                  <td key="yenilendi_col" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {e.yenilendi ? formatDate(e.yenilendi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                tesvir: (
                  <td key="tesvir" className="px-3 py-2.5">{e.tesvir}</td>
                ),
                qaime_col: (
                  <td key="qaime_col" className="px-3 py-2.5">
                    {(() => {
                      const inv = extractInvoiceId(e.qeyd);
                      return inv ? (
                        <Link
                          href={`/ticaret/alislar/${inv}`}
                          className="inline-flex items-center gap-1 rounded-md border border-info/30 bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info hover:bg-info/20"
                          title="Qaiməyə bax"
                        >
                          <Link2 className="h-3 w-3" /> Qaimə
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      );
                    })()}
                  </td>
                ),
                kateqoriya: (
                  <td key="kateqoriya" className="px-3 py-2.5">
                    {e.kateqoriya_ad ? (
                      <Badge
                        variant="outline"
                        style={{ borderColor: e.kateqoriya_reng ?? undefined, color: e.kateqoriya_reng ?? undefined }}
                      >
                        {e.kateqoriya_ad}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                qrup: (
                  <td key="qrup" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {e.kateqoriya_qrup ?? "—"}
                  </td>
                ),
                techizatci: (
                  <td key="techizatci" className="px-3 py-2.5 text-xs text-muted-foreground">—</td>
                ),
                odenis: (
                  <td key="odenis" className="px-3 py-2.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {ODENIS_LABEL[e.odenis_nov] ?? e.odenis_nov}
                    </Badge>
                  </td>
                ),
                mebleg: (
                  <td key="mebleg" className="px-3 py-2.5 text-right tabular-nums font-semibold text-danger">
                    − {formatMoney(e.mebleg)}
                  </td>
                ),
                valyuta: (
                  <td key="valyuta" className="px-3 py-2.5 text-xs">{e.valyuta}</td>
                ),
                mezenne: (
                  <td key="mezenne" className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {e.mezenne !== 1 ? e.mezenne.toFixed(4) : "—"}
                  </td>
                ),
                mebleg_azn: (
                  <td key="mebleg_azn" className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {e.mebleg_azn > 0 ? formatMoney(e.mebleg_azn) : "—"}
                  </td>
                ),
                qebz_col: (
                  <td key="qebz_col" className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {e.qebz_nomresi ? (
                      <span className="inline-flex items-center gap-0.5">
                        <span>{e.qebz_nomresi}</span>
                        <CopyButton value={e.qebz_nomresi} title="Sənəd kopya et" size="xs" />
                      </span>
                    ) : "—"}
                  </td>
                ),
                fayl_col: (
                  <td key="fayl_col" className="px-3 py-2.5 text-xs">
                    {e.fayl_url ? (
                      <a href={e.fayl_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                        <FileText className="h-3 w-3" /> Fayl
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                filial: (
                  <td key="filial" className="px-3 py-2.5 text-xs">{e.filial_ad ?? <span className="text-muted-foreground">—</span>}</td>
                ),
                yaradan: (
                  <td key="yaradan" className="px-3 py-2.5 text-xs text-muted-foreground">{e.yaradan_ad ?? "—"}</td>
                ),
                status_col: (
                  <td key="status_col" className="px-3 py-2.5">
                    <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">Təsdiqlənmiş</Badge>
                  </td>
                ),
                tesdiqleyen: (
                  <td key="tesdiqleyen" className="px-3 py-2.5 text-xs text-muted-foreground">—</td>
                ),
                edv: (
                  <td key="edv" className="px-3 py-2.5 text-xs text-muted-foreground">—</td>
                ),
                edv_mebleg: (
                  <td key="edv_mebleg" className="px-3 py-2.5 text-right text-xs text-muted-foreground">—</td>
                ),
                dovr: (
                  <td key="dovr" className="px-3 py-2.5 text-xs">
                    <Badge variant="outline" className="text-[10px]">birdəfəlik</Badge>
                  </td>
                ),
                tag: (
                  <td key="tag" className="px-3 py-2.5 text-xs text-muted-foreground">—</td>
                ),
                qeyd_col: (
                  <td key="qeyd_col" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {e.qeyd ? <span className="line-clamp-2 max-w-xs" title={e.qeyd}>{e.qeyd}</span> : "—"}
                  </td>
                ),
              };
              return (
                <tr key={e.id} className="border-b border-border/30 transition hover:bg-secondary/40">
                  {cols.order.map((k) => (cols.isVisible(k) ? cells[k] : null))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
