"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FileText, Eye, ChevronDown, ChevronRight } from "lucide-react";
import { TeklifRowActions } from "./teklif-row-actions";
import { Badge } from "@/components/ui/badge";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { formatDate, formatMoney } from "@/lib/utils";
import type { TeklifListItem } from "../teklif-queries";
import { CustomerDrawer } from "@/features/elaqe/components/customer-drawer";

type Props = {
  items: TeklifListItem[];
  total: number;
  canConvert?: boolean;
  canChangeStatus?: boolean;
  canDelete?: boolean;
};

const STORAGE_KEY = "ticaret-teklif-cols-v1";

const COLUMN_DEFS: ColumnDef[] = [
  { key: "nomre", label: "Nömrə", required: true },
  { key: "tarix", label: "Tarix" },
  { key: "bitme", label: "Etibarlıdır" },
  { key: "musteri", label: "Müştəri" },
  { key: "telefon", label: "Telefon" },
  { key: "menecer", label: "Menecer" },
  { key: "filial", label: "Filial" },
  { key: "tipi", label: "Tipi" },
  { key: "satir", label: "Sətir" },
  { key: "umumi", label: "Cəmi" },
  { key: "endirim", label: "Endirim" },
  { key: "son", label: "Son məbləğ" },
  { key: "valyuta", label: "Valyuta" },
  { key: "status", label: "Status" },
  { key: "satish", label: "Satışa çevrildi" },
  { key: "yaradan", label: "Yaradan" },
  { key: "tesdiq", label: "Təsdiq edən" },
  { key: "yaradildi", label: "Yaradılma" },
  { key: "yenilendi", label: "Son düzəliş" },
  { key: "qeyd", label: "Qeyd" },
];

const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

const DEFAULT_VISIBLE: Record<string, boolean> = {
  nomre: true,
  tarix: true,
  bitme: true,
  musteri: true,
  telefon: false,
  menecer: true,
  filial: false,
  tipi: false,
  satir: true,
  umumi: false,
  endirim: false,
  son: true,
  valyuta: false,
  status: true,
  satish: true,
  yaradan: false,
  tesdiq: false,
  yaradildi: false,
  yenilendi: false,
  qeyd: false,
};

const STATUS: Record<string, { label: string; cls: string }> = {
  qaralama:        { label: "Qaralama",        cls: "bg-muted text-muted-foreground border-border" },
  gonderildi:      { label: "Göndərildi",      cls: "bg-info/15 text-info border-info/30" },
  qebul:           { label: "Qəbul",           cls: "bg-success/15 text-success border-success/30" },
  redd:            { label: "Rədd",            cls: "bg-danger/15 text-danger border-danger/30" },
  satisa_cevrildi: { label: "Satışa çevrildi", cls: "bg-primary/15 text-primary-light border-primary/30" },
  legv:            { label: "Ləğv",            cls: "bg-muted text-muted-foreground border-border line-through" },
  gozlemede:       { label: "Gözləmədə",       cls: "bg-warning/15 text-warning border-warning/30" },
};

type SortKey = "tarix" | "nomre" | "musteri" | "status" | "son" | "satir" | "bitme";

export function TeklifTable({
  items,
  total,
  canConvert = false,
  canChangeStatus = false,
  canDelete = false,
}: Props) {
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

  const [openPeeks, setOpenPeeks] = useState<Set<string>>(new Set());
  function togglePeek(id: string) {
    setOpenPeeks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
        case "nomre": return cs(a.nomre, b.nomre);
        case "musteri": return cs(a.musteri_ad, b.musteri_ad);
        case "status": return cs(a.status, b.status);
        case "son": return cn(a.son_meblegh, b.son_meblegh);
        case "satir": return cn(a.satir_say, b.satir_say);
        case "bitme": return cd(a.bitme_tarixi, b.bitme_tarixi);
        default: return 0;
      }
    });
  }, [items, sortBy, sortDir]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">Təklif yoxdur</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          POS və ya CRM-dən təklif (proposal) yaradın.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-sm font-semibold">
          Təkliflər <span className="ml-2 text-xs font-normal text-muted-foreground">{total} nəticə</span>
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
                  case "nomre": return <SortableTh key={key} label="Nömrə" current={sortBy} sortKey="nomre" dir={sortDir} onClick={setSort} />;
                  case "tarix": return <SortableTh key={key} label="Tarix" current={sortBy} sortKey="tarix" dir={sortDir} onClick={setSort} />;
                  case "bitme": return <SortableTh key={key} label="Etibarlıdır" current={sortBy} sortKey="bitme" dir={sortDir} onClick={setSort} />;
                  case "musteri": return <SortableTh key={key} label="Müştəri" current={sortBy} sortKey="musteri" dir={sortDir} onClick={setSort} />;
                  case "telefon": return <th key={key} className="px-3 py-2.5">Telefon</th>;
                  case "menecer": return <th key={key} className="px-3 py-2.5">Menecer</th>;
                  case "filial": return <th key={key} className="px-3 py-2.5">Filial</th>;
                  case "tipi": return <th key={key} className="px-3 py-2.5">Tipi</th>;
                  case "satir": return <SortableTh key={key} label="Sətir" current={sortBy} sortKey="satir" dir={sortDir} onClick={setSort} align="center" />;
                  case "umumi": return <th key={key} className="px-3 py-2.5 text-right">Cəmi</th>;
                  case "endirim": return <th key={key} className="px-3 py-2.5 text-right">Endirim</th>;
                  case "son": return <SortableTh key={key} label="Məbləğ" current={sortBy} sortKey="son" dir={sortDir} onClick={setSort} align="right" />;
                  case "valyuta": return <th key={key} className="px-3 py-2.5">Valyuta</th>;
                  case "status": return <SortableTh key={key} label="Status" current={sortBy} sortKey="status" dir={sortDir} onClick={setSort} />;
                  case "satish": return <th key={key} className="px-3 py-2.5">Satış</th>;
                  case "yaradan": return <th key={key} className="px-3 py-2.5">Yaradan</th>;
                  case "tesdiq": return <th key={key} className="px-3 py-2.5">Təsdiq</th>;
                  case "yaradildi": return <th key={key} className="px-3 py-2.5">Yaradılma</th>;
                  case "yenilendi": return <th key={key} className="px-3 py-2.5">Son düzəliş</th>;
                  case "qeyd": return <th key={key} className="px-3 py-2.5">Qeyd</th>;
                  default: return null;
                }
              })}
              <th className="px-3 py-2.5 text-right">Əməliyyat</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const st = STATUS[t.status] ?? STATUS.qaralama;
              const isExpired =
                t.bitme_tarixi && new Date(t.bitme_tarixi) < new Date() && !t.satish_id && t.status !== "redd";

              const cells: Record<string, React.ReactNode> = {
                nomre: (
                  <td key="nomre" className="px-3 py-2.5">
                    <span className="font-mono text-xs font-medium">{t.nomre}</span>
                  </td>
                ),
                tarix: (
                  <td key="tarix" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {formatDate(t.tarix)}
                  </td>
                ),
                bitme: (
                  <td key="bitme" className="px-3 py-2.5 text-xs">
                    {t.bitme_tarixi ? (
                      <span className={isExpired ? "text-danger font-medium" : "text-muted-foreground"}>
                        {formatDate(t.bitme_tarixi)} {isExpired && "(vaxtı keçib)"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
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
                    {/* Cərgədə təklif məhsulları — daxil olmadan görünür */}
                    {t.ilk_mehsullar.length > 0 && (
                      <div
                        className="mt-0.5 line-clamp-1 text-[10.5px] text-muted-foreground"
                        title={t.ilk_mehsullar.map((m) => `${m.ad} ×${m.miqdar}`).join(", ")}
                      >
                        {t.ilk_mehsullar.slice(0, 2).map((m, i) => (
                          <span key={i}>
                            {i > 0 && " · "}
                            <span>{m.ad}</span>
                            <span className="text-muted-foreground/70"> ×{m.miqdar}</span>
                          </span>
                        ))}
                        {t.satir_say > 2 && (
                          <span className="text-muted-foreground/70"> +{t.satir_say - 2}</span>
                        )}
                      </div>
                    )}
                  </td>
                ),
                telefon: (
                  <td key="telefon" className="px-3 py-2.5 text-xs text-muted-foreground">{t.musteri_telefon ?? "—"}</td>
                ),
                menecer: (
                  <td key="menecer" className="px-3 py-2.5 text-xs text-muted-foreground">{t.menecer_ad ?? "—"}</td>
                ),
                filial: (
                  <td key="filial" className="px-3 py-2.5 text-xs">{t.filial_ad ?? "—"}</td>
                ),
                tipi: (
                  <td key="tipi" className="px-3 py-2.5 text-xs">
                    <Badge variant="outline" className="text-[10px]">{t.satish_tipi}</Badge>
                  </td>
                ),
                satir: (
                  <td key="satir" className="px-3 py-2.5 text-center tabular-nums text-xs">{t.satir_say}</td>
                ),
                umumi: (
                  <td key="umumi" className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {t.umumi_meblegh > 0 ? formatMoney(t.umumi_meblegh) : "—"}
                  </td>
                ),
                endirim: (
                  <td key="endirim" className="px-3 py-2.5 text-right tabular-nums text-xs">
                    {t.endirim_meblegh > 0 ? <span className="text-warning">−{formatMoney(t.endirim_meblegh)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                ),
                son: (
                  <td key="son" className="px-3 py-2.5 text-right tabular-nums font-semibold">
                    {formatMoney(t.son_meblegh)}
                  </td>
                ),
                valyuta: (
                  <td key="valyuta" className="px-3 py-2.5 text-xs text-muted-foreground">{t.valyuta}</td>
                ),
                status: (
                  <td key="status" className="px-3 py-2.5">
                    <Badge variant="outline" className={`${st.cls} text-[10px]`}>{st.label}</Badge>
                  </td>
                ),
                satish: (
                  <td key="satish" className="px-3 py-2.5 text-xs">
                    {t.satish_id ? (
                      <Link href={`/ticaret/satislar/${t.satish_id}`} className="font-mono text-primary hover:underline">
                        {t.satish_nomre ?? "Bax"}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ),
                yaradan: (
                  <td key="yaradan" className="px-3 py-2.5 text-xs text-muted-foreground">{t.yaradan_ad ?? "—"}</td>
                ),
                tesdiq: (
                  <td key="tesdiq" className="px-3 py-2.5 text-xs text-muted-foreground">{t.tesdiq_eden_ad ?? "—"}</td>
                ),
                yaradildi: (
                  <td key="yaradildi" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {t.yaradildi ? formatDate(t.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                yenilendi: (
                  <td key="yenilendi" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {t.yenilendi ? formatDate(t.yenilendi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                ),
                qeyd: (
                  <td key="qeyd" className="px-3 py-2.5 text-xs text-muted-foreground">
                    {t.qeyd ? <span className="line-clamp-2 max-w-xs" title={t.qeyd}>{t.qeyd}</span> : "—"}
                  </td>
                ),
              };
              const isOpen = openPeeks.has(t.id);
              const visibleColCount = cols.order.filter((k) => cols.isVisible(k)).length + 1;
              const isCancelled = t.status === "legv" || t.status === "redd";
              return (
                <Fragment key={t.id}>
                <tr
                  className={`border-b border-border/30 transition hover:bg-secondary/40 ${
                    isCancelled
                      ? "bg-destructive/[0.04] text-muted-foreground line-through decoration-destructive/40"
                      : ""
                  }`}
                >
                  {cols.order.map((k) => (cols.isVisible(k) ? cells[k] : null))}
                  <td className="px-3 py-2.5 text-right no-underline [text-decoration:none]">
                    <div className="inline-flex items-center gap-1 no-underline [text-decoration:none]">
                      {t.ilk_mehsullar.length > 0 && (
                        <button
                          type="button"
                          onClick={() => togglePeek(t.id)}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition ${
                            isOpen
                              ? "bg-primary/15 text-primary"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                          title={isOpen ? "Bağla" : "Tez baxış (məhsulları gör)"}
                        >
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      <TeklifRowActions
                        teklifId={t.id}
                        nomre={t.nomre}
                        status={t.status}
                        satishId={t.satish_id ?? null}
                        canConvert={canConvert}
                        canChangeStatus={canChangeStatus}
                        canDelete={canDelete}
                      />
                    </div>
                  </td>
                </tr>
                {isOpen && t.ilk_mehsullar.length > 0 && (
                  <tr className="border-b border-border/30 bg-secondary/30">
                    <td colSpan={visibleColCount} className="px-3 py-3">
                      <TeklifPeekContent teklif={t} />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeklifPeekContent({ teklif }: { teklif: TeklifListItem }) {
  const totalLines = teklif.ilk_mehsullar.reduce((s, l) => s + l.cemi, 0);
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">
          {teklif.nomre} — Təklif sətirləri
        </span>
        {teklif.satish_id && (
          <Link
            href={`/ticaret/satislar/${teklif.satish_id}`}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[10.5px] text-muted-foreground hover:text-foreground"
          >
            Çevrildiyi satışa bax
            <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="pb-1 text-left">Məhsul</th>
            <th className="pb-1 text-right w-20">Miqdar</th>
            <th className="pb-1 text-right w-24">Qiymət</th>
            <th className="pb-1 text-right w-24">Cəmi</th>
          </tr>
        </thead>
        <tbody>
          {teklif.ilk_mehsullar.map((line, idx) => (
            <tr key={idx} className="border-t border-border/30">
              <td className="py-1.5">
                <div className="font-medium">{line.ad}</div>
                {line.kod && (
                  <div className="font-mono text-[10px] text-muted-foreground">{line.kod}</div>
                )}
              </td>
              <td className="py-1.5 text-right tabular-nums">{line.miqdar}</td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                {formatMoney(line.qiymet)}
              </td>
              <td className="py-1.5 text-right tabular-nums font-medium">
                {formatMoney(line.cemi)}
              </td>
            </tr>
          ))}
          {teklif.satir_say > teklif.ilk_mehsullar.length && (
            <tr>
              <td colSpan={4} className="pt-2 text-center text-[10.5px] italic text-muted-foreground">
                + {teklif.satir_say - teklif.ilk_mehsullar.length} əlavə sətr
              </td>
            </tr>
          )}
          <tr className="border-t-2 border-border/60">
            <td colSpan={3} className="pt-1.5 text-right text-[10.5px] uppercase tracking-wider text-muted-foreground">
              Sətirlər cəmi
            </td>
            <td className="pt-1.5 text-right tabular-nums font-bold">
              {formatMoney(totalLines)}
            </td>
          </tr>
          {teklif.endirim_meblegh > 0 && (
            <tr>
              <td colSpan={3} className="text-right text-[10.5px] text-muted-foreground">
                Endirim
              </td>
              <td className="text-right tabular-nums text-warning">
                −{formatMoney(teklif.endirim_meblegh)}
              </td>
            </tr>
          )}
          <tr>
            <td colSpan={3} className="text-right text-[10.5px] font-semibold uppercase tracking-wider">
              Təklif yekunu
            </td>
            <td className="text-right tabular-nums font-bold brand-text">
              {formatMoney(teklif.son_meblegh)}
            </td>
          </tr>
        </tbody>
      </table>
      {teklif.shertler && (
        <div className="mt-3 rounded-md border border-border/40 bg-secondary/30 px-2.5 py-2 text-[11px] text-muted-foreground">
          <strong>Şərtlər:</strong> {teklif.shertler}
        </div>
      )}
    </div>
  );
}
