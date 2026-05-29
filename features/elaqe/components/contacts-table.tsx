"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Phone,
  Mail,
  MapPin,
  Trash2,
  User2,
  Building2,
  ExternalLink,
  MessageCircle,
  Copy as CopyIcon,
  Tag,
  UserCog,
  Power,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { ContactDialog } from "./contact-dialog";
import { PaymentDialog } from "./payment-dialog";
import {
  deactivateContact,
  bulkAddTag,
  bulkAssignManager,
  bulkSetStatus,
  bulkDeactivate,
} from "../actions";
import { formatMoney, formatDate } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import type { ContactRow } from "../queries";

type Manager = { id: string; ad_soyad: string };

type Props = {
  items: ContactRow[];
  total: number;
  defaultNov: "musteri" | "techizatci" | "any";
  managers?: Manager[];
  page?: number;
  pageSize?: number;
  basePath?: string;
};

const COLUMNS: ColumnDef[] = [
  { key: "select", label: "✓", required: true },
  { key: "ad", label: "Ad / Şirkət", required: true },
  { key: "tip", label: "Tip" },
  { key: "elaqe", label: "Telefon / Email" },
  { key: "voen_fin", label: "VÖEN / FİN" },
  { key: "unvan", label: "Ünvan / Şəhər" },
  { key: "qiymet_tipi", label: "Qiymət tipi" },
  { key: "borc_limiti", label: "Borc limit" },
  { key: "borc", label: "Borc" },
  { key: "menecer", label: "Məsul" },
  { key: "yaradildi", label: "Tarix" },
  { key: "son_temas", label: "Son əlaqə" },
  { key: "status", label: "Status" },
  { key: "eml", label: "Əməl", required: true },
];
const DEFAULT_ORDER = COLUMNS.map((c) => c.key);

export function ContactsTable({ items, total, defaultNov, managers = [], page, pageSize, basePath }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const { isVisible, order, render } = useColumnToggle("elaqe-cols-v2", COLUMNS, DEFAULT_ORDER);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagInput, setTagInput] = useState("");
  const [managerPick, setManagerPick] = useState("");

  const allSelected = useMemo(
    () => items.length > 0 && items.every((i) => selected.has(i.id)),
    [items, selected]
  );

  function toggleSelectAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  }

  function toggleRow(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function doBulkTag() {
    const name = tagInput.trim();
    if (!name) {
      toast.error("Tag adı boşdur");
      return;
    }
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await bulkAddTag(ids, name);
      if (res.ok) {
        toast.success(`${res.count} kontragentə tag əlavə olundu`);
        setTagInput("");
        clearSelection();
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function doBulkManager() {
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await bulkAssignManager(ids, managerPick || null);
      if (res.ok) {
        toast.success(`${res.count} kontragentə menecer təyin edildi`);
        setManagerPick("");
        clearSelection();
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function doBulkStatus(aktiv: boolean) {
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await bulkSetStatus(ids, aktiv);
      if (res.ok) {
        toast.success(`${res.count} qeyd ${aktiv ? "aktiv" : "passiv"} edildi`);
        clearSelection();
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function doBulkDeactivate() {
    if (!confirm(`${selected.size} kontragent silinsin (deaktivləşdirilsin)?`)) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await bulkDeactivate(ids);
      if (res.ok) {
        toast.success(`${res.count} qeyd silindi`);
        clearSelection();
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function exportSelectedCsv() {
    const rows = items.filter((i) => selected.has(i.id));
    if (rows.length === 0) {
      toast.error("Seçim yoxdur");
      return;
    }
    const headers = ["ad", "telefon", "email", "voen", "fin_kod", "borc", "nov", "sirket_adi", "sheher", "yaradildi"];
    const lines = [headers.join(",")];
    for (const r of rows) {
      const vals = [
        r.ad,
        r.telefon ?? "",
        r.email ?? "",
        r.voen ?? "",
        r.fin_kod ?? "",
        String(r.borc),
        r.nov,
        r.sirket_adi ?? "",
        r.sheher ?? "",
        r.yaradildi ? r.yaradildi.toISOString().slice(0, 10) : "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(vals.join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `elaqe-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sort = (sp.get("sort") as string) || "yaradildi";
  const dir = ((sp.get("dir") as SortDir) || "desc") as SortDir;

  function setSort(key: string) {
    const p = new URLSearchParams(sp.toString());
    if (sort === key) p.set("dir", dir === "asc" ? "desc" : "asc");
    else {
      p.set("sort", key);
      p.set("dir", "desc");
    }
    router.push(`${pathname}?${p.toString()}`);
  }

  function onDeactivate(id: string, ad: string) {
    if (!confirm(`"${ad}" deaktivləşdirilsin?`)) return;
    startTransition(async () => {
      const res = await deactivateContact(id);
      if (res.ok) toast.success("Deaktivləşdirildi");
      else toast.error(res.error);
    });
  }

  function copyVoen(v: string) {
    navigator.clipboard.writeText(v).then(() => toast.success("Köçürüldü"));
  }

  function detailPath(c: ContactRow) {
    return c.nov === "techizatci" ? `/elaqe/techizatcilar/${c.id}` : `/elaqe/musteriler/${c.id}`;
  }

  if (items.length === 0) {
    const Icon = defaultNov === "musteri" ? User2 : defaultNov === "techizatci" ? Building2 : User2;
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">Qeyd tapılmadı</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Yuxarıdakı düymə ilə yeni qeyd əlavə edin və ya filtrlərinizi yumşaldın.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <h3 className="text-sm font-semibold">
          Kontragentlər
          <span className="ml-2 text-xs font-normal text-muted-foreground">{total} qeyd</span>
        </h3>
        {render()}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-secondary/30 px-3 py-2">
          <span className="text-xs font-semibold text-foreground">
            {selected.size} seçilib
          </span>
          <Button size="sm" variant="ghost" onClick={clearSelection} title="Seçimi təmizlə">
            <X className="h-3.5 w-3.5" />
          </Button>

          <div className="ml-2 flex items-center gap-1">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Tag adı..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="h-7 w-32 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") doBulkTag(); }}
            />
            <Button size="sm" variant="outline" onClick={doBulkTag} disabled={pending || !tagInput.trim()}>
              Əlavə et
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={managerPick}
              onChange={(e) => setManagerPick(e.target.value)}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Menecer seç...</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.ad_soyad}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={doBulkManager} disabled={pending}>
              Təyin et
            </Button>
          </div>

          <Button size="sm" variant="outline" onClick={() => doBulkStatus(true)} disabled={pending}>
            <Power className="h-3.5 w-3.5" /> Aktiv et
          </Button>
          <Button size="sm" variant="outline" onClick={doBulkDeactivate} disabled={pending}>
            <Trash2 className="h-3.5 w-3.5" /> Sil
          </Button>
          <Button size="sm" variant="outline" onClick={exportSelectedCsv}>
            CSV ixrac
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {order.map((key) => {
                if (!isVisible(key)) return null;
                if (key === "select")
                  return (
                    <th key={key} className="w-8 px-2 py-2.5">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="Hamısını seç"
                      />
                    </th>
                  );
                if (key === "ad")
                  return <SortableTh key={key} label="Ad / Şirkət" current={sort} sortKey="ad" dir={dir} onClick={setSort} />;
                if (key === "borc")
                  return <SortableTh key={key} label="Borc" current={sort} sortKey="borc" dir={dir} onClick={setSort} align="right" />;
                if (key === "yaradildi")
                  return <SortableTh key={key} label="Tarix" current={sort} sortKey="yaradildi" dir={dir} onClick={setSort} />;
                if (key === "son_temas")
                  return <SortableTh key={key} label="Son əlaqə" current={sort} sortKey="son_temas" dir={dir} onClick={setSort} />;
                if (key === "eml") return <th key={key} className="px-3 py-2.5 text-right w-32">Əməl</th>;
                const def = COLUMNS.find((c) => c.key === key)!;
                return <th key={key} className="px-3 py-2.5">{def.label}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className={`border-b border-border/30 transition hover:bg-secondary/40 ${!c.aktiv ? "opacity-60" : ""}`}>
                {order.map((key) => {
                  if (!isVisible(key)) return null;
                  switch (key) {
                    case "select":
                      return (
                        <td key={key} className="w-8 px-2 py-2.5">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-primary"
                            checked={selected.has(c.id)}
                            onChange={() => toggleRow(c.id)}
                            aria-label={`${c.ad} seç`}
                          />
                        </td>
                      );
                    case "ad":
                      return (
                        <td key={key} className="px-3 py-2.5">
                          <Link href={detailPath(c)} className="font-medium hover:text-primary-light">
                            {c.ad}
                          </Link>
                          {c.sirket_adi && c.sirket_adi !== c.ad && (
                            <div className="mt-0.5 text-xs text-muted-foreground">{c.sirket_adi}</div>
                          )}
                          {c.qara_siyahi && (
                            <Badge variant="outline" className="mt-1 text-[10px] text-danger">qara siyahı</Badge>
                          )}
                        </td>
                      );
                    case "tip":
                      return (
                        <td key={key} className="px-3 py-2.5">
                          <Badge variant="outline" className="text-[10px]">
                            {c.nov === "her_ikisi" ? "Hər ikisi" : c.nov === "musteri" ? "Müştəri" : "Təchizatçı"}
                          </Badge>
                        </td>
                      );
                    case "elaqe":
                      return (
                        <td key={key} className="px-3 py-2.5 text-xs">
                          {c.telefon && (
                            <a href={`tel:${c.telefon}`} className="flex items-center gap-1 text-muted-foreground hover:text-primary-light">
                              <Phone className="h-3 w-3" /> {c.telefon}
                            </a>
                          )}
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="mt-0.5 flex items-center gap-1 text-muted-foreground hover:text-primary-light">
                              <Mail className="h-3 w-3" /> {c.email}
                            </a>
                          )}
                        </td>
                      );
                    case "voen_fin":
                      return (
                        <td key={key} className="px-3 py-2.5 text-xs font-mono text-muted-foreground">
                          {c.voen && (
                            <button onClick={() => copyVoen(c.voen!)} className="hover:text-foreground inline-flex items-center gap-1">
                              <CopyIcon className="h-3 w-3" /> {c.voen}
                            </button>
                          )}
                          {c.fin_kod && <div>{c.fin_kod}</div>}
                          {!c.voen && !c.fin_kod && "—"}
                        </td>
                      );
                    case "unvan":
                      return (
                        <td key={key} className="px-3 py-2.5 text-xs text-muted-foreground">
                          {c.sheher && <div className="font-medium text-foreground">{c.sheher}</div>}
                          {c.unvan ? (
                            <div className="inline-flex items-start gap-1">
                              <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                              <span className="line-clamp-2">{c.unvan}</span>
                            </div>
                          ) : !c.sheher ? "—" : null}
                        </td>
                      );
                    case "qiymet_tipi":
                      return (
                        <td key={key} className="px-3 py-2.5 text-xs capitalize">
                          {c.qiymet_tipi ?? "—"}
                        </td>
                      );
                    case "borc_limiti":
                      return (
                        <td key={key} className="px-3 py-2.5 text-right text-xs tabular-nums">
                          {c.borc_limiti !== null ? formatMoney(c.borc_limiti) : <span className="text-muted-foreground">—</span>}
                        </td>
                      );
                    case "borc":
                      return (
                        <td key={key} className="px-3 py-2.5 text-right">
                          {c.borc > 0 ? (
                            <span className="tabular-nums font-semibold text-warning">{formatMoney(c.borc)}</span>
                          ) : c.borc < 0 ? (
                            <span className="tabular-nums font-semibold text-danger">{formatMoney(c.borc)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    case "menecer":
                      return (
                        <td key={key} className="px-3 py-2.5 text-xs text-muted-foreground">
                          {c.menecer_ad ?? "—"}
                        </td>
                      );
                    case "yaradildi":
                      return (
                        <td key={key} className="px-3 py-2.5 text-xs text-muted-foreground">
                          {formatDate(c.yaradildi)}
                        </td>
                      );
                    case "son_temas":
                      return (
                        <td key={key} className="px-3 py-2.5 text-xs text-muted-foreground">
                          {formatDate(c.son_temas)}
                        </td>
                      );
                    case "status":
                      return (
                        <td key={key} className="px-3 py-2.5">
                          {c.aktiv ? (
                            <Badge variant="outline" className="text-[10px] text-success">Aktiv</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">Passiv</Badge>
                          )}
                        </td>
                      );
                    case "eml":
                      return (
                        <td key={key} className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-0.5">
                            <Link
                              href={detailPath(c)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                              title="Profil"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                            {c.telefon && (
                              <a
                                href={`https://wa.me/${c.telefon.replace(/\D+/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-success/10 hover:text-success"
                                title="WhatsApp"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {c.borc > 0 && (
                              <PaymentDialog kontragentId={c.id} ad={c.ad} maxAmount={c.borc} />
                            )}
                            <ContactDialog
                              defaultNov={c.nov === "techizatci" ? "techizatci" : "musteri"}
                              initial={c}
                              trigger="edit"
                              managers={managers}
                            />
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              title="Deaktivləşdir"
                              disabled={pending}
                              onClick={() => onDeactivate(c.id, c.ad)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      );
                  }
                  return null;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {page !== undefined && pageSize !== undefined && basePath && total > pageSize && (
        <div className="flex items-center justify-between px-2 pt-2 text-xs text-muted-foreground">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / cəmi {total}
          </span>
          <Pagination total={total} pageSize={pageSize} page={page} basePath={basePath} />
        </div>
      )}
    </div>
  );
}
