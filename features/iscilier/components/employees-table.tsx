"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Phone, Briefcase, Trash2, ExternalLink, Wallet, CalendarDays, Search } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useColumnToggle, type ColumnDef } from "@/components/ui/column-toggle";
import { EmployeeDialog } from "./employee-dialog";
import { deactivateEmployee } from "../actions";
import { formatMoney, formatDate } from "@/lib/utils";
import type { EmployeeRow, EmployeeStatus, FilialOpt, RoleOpt } from "../types";

const STORAGE_KEY = "iscilier-cols-v1";

const COLUMN_DEFS: ColumnDef[] = [
  { key: "ad_soyad", label: "Ad Soyad", required: true },
  { key: "vezife", label: "Vəzifə" },
  { key: "rol", label: "Rol" },
  { key: "kpi", label: "KPI (bu ay)" },
  { key: "sobe", label: "Şöbə" },
  { key: "filial", label: "Filial" },
  { key: "telefon", label: "Telefon" },
  { key: "email", label: "Email" },
  { key: "ise_baslama", label: "İşə başlama" },
  { key: "maas", label: "Aylıq maaş" },
  { key: "status", label: "Status" },
  { key: "son_giris", label: "Son giriş" },
  { key: "fin_kod", label: "FİN" },
  { key: "dogum", label: "Doğum tarixi" },
  { key: "unvan", label: "Ünvan" },
  { key: "bank", label: "Bank / IBAN" },
  { key: "eml", label: "Əməl", required: true },
];

const DEFAULT_ORDER = COLUMN_DEFS.map((c) => c.key);

const STATUS_BADGE: Record<EmployeeStatus, { label: string; cls: string; dotCls: string }> = {
  aktiv: {
    label: "Aktiv",
    cls: "bg-gradient-to-b from-emerald-500/15 to-emerald-500/[0.06] text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300",
    dotCls: "bg-emerald-500",
  },
  mezuniyyetde: {
    label: "Məzuniyyət",
    cls: "bg-gradient-to-b from-amber-500/15 to-amber-500/[0.06] text-amber-800 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300",
    dotCls: "bg-amber-500",
  },
  cixib: {
    label: "İşdən çıxıb",
    cls: "bg-gradient-to-b from-rose-500/15 to-rose-500/[0.06] text-rose-700 ring-1 ring-inset ring-rose-500/20 line-through decoration-rose-500/40 dark:text-rose-300",
    dotCls: "bg-rose-500",
  },
  passiv: {
    label: "Passiv",
    cls: "bg-gradient-to-b from-slate-500/15 to-slate-500/[0.06] text-slate-700 ring-1 ring-inset ring-slate-500/20 dark:text-slate-300",
    dotCls: "bg-slate-500",
  },
};

export function EmployeesTable({
  items,
  roles,
  filiallar = [],
  vezifeler = [],
  canEdit = false,
}: {
  items: EmployeeRow[];
  roles: RoleOpt[];
  filiallar?: FilialOpt[];
  vezifeler?: string[];
  canEdit?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const cols = useColumnToggle(STORAGE_KEY, COLUMN_DEFS, DEFAULT_ORDER);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | "all">("all");
  const [vezifeFilter, setVezifeFilter] = useState<string>("all");
  const [filialFilter, setFilialFilter] = useState<string>("all");
  const [rolFilter, setRolFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return items.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (vezifeFilter !== "all" && (e.vezife ?? "") !== vezifeFilter) return false;
      if (filialFilter !== "all" && String(e.default_filial_id ?? "") !== filialFilter) return false;
      if (rolFilter !== "all" && String(e.rol_id) !== rolFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [
          e.ad_soyad,
          e.email,
          e.telefon,
          e.vezife,
          e.fin_kod,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, statusFilter, vezifeFilter, filialFilter, rolFilter]);

  function onDeactivate(id: string, ad: string) {
    if (!confirm(`"${ad}" əməliyyatdan çıxarılsın?`)) return;
    startTransition(async () => {
      const res = await deactivateEmployee(id);
      if (res.ok) toast.success("Əməliyyatdan çıxarıldı");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Axtar (ad, email, telefon, FİN)..."
            className="h-9 pl-8"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as EmployeeStatus | "all")}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="all">Bütün statuslar</option>
          <option value="aktiv">Aktiv</option>
          <option value="mezuniyyetde">Məzuniyyətdə</option>
          <option value="cixib">İşdən çıxıb</option>
          <option value="passiv">Passiv</option>
        </select>
        <select
          value={vezifeFilter}
          onChange={(e) => setVezifeFilter(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="all">Bütün vəzifələr</option>
          {vezifeler.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select
          value={filialFilter}
          onChange={(e) => setFilialFilter(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="all">Bütün filiallar</option>
          {filiallar.map((f) => (
            <option key={f.id} value={String(f.id)}>{f.ad}</option>
          ))}
        </select>
        <select
          value={rolFilter}
          onChange={(e) => setRolFilter(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="all">Bütün rollar</option>
          {roles.map((r) => (
            <option key={r.id} value={String(r.id)}>{r.ad}</option>
          ))}
        </select>
        {cols.render()}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Heç bir işçi tapılmadı</h3>
          <p className="mt-1 text-sm text-muted-foreground">Filtri yumşaldın və ya yeni işçi əlavə edin.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/40">
          <div className="overflow-x-auto" data-h-scroll-hint>
            <table className="w-full text-sm" data-stack-on-mobile>
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  {cols.order.map((key) => {
                    if (!cols.isVisible(key)) return null;
                    const def = COLUMN_DEFS.find((c) => c.key === key);
                    if (!def) return null;
                    const align = key === "maas" ? "text-right" : key === "eml" ? "text-right w-32" : "";
                    return (
                      <th key={key} className={`px-3 py-2.5 ${align}`}>
                        {def.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const s = STATUS_BADGE[e.status];
                  return (
                    <tr key={e.id} className={`border-b border-border/30 transition hover:bg-secondary/40 ${e.status === "passiv" || e.status === "cixib" ? "opacity-60" : ""}`}>
                      {cols.order.map((key) => {
                        if (!cols.isVisible(key)) return null;
                        // Hər td üçün label — data-stack-on-mobile mobile-da göstərir
                        const _label = COLUMN_DEFS.find((c) => c.key === key)?.label;
                        switch (key) {
                          case "ad_soyad":
                            return (
                              <td key={key} data-label={_label} className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-secondary text-xs font-semibold">
                                      {e.ad_soyad.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <Link href={`/iscilier/${e.id}`} className="font-medium hover:underline">{e.ad_soyad}</Link>
                                    <div className="text-xs text-muted-foreground">{e.email}</div>
                                  </div>
                                </div>
                              </td>
                            );
                          case "vezife":
                            return <td key={key} data-label={_label} className="px-3 py-2.5">{e.vezife ?? "—"}</td>;
                          case "rol":
                            return (
                              <td key={key} data-label={_label} className="px-3 py-2.5">
                                <Badge variant="outline" className="text-[10px]">{e.rol_ad}</Badge>
                              </td>
                            );
                          case "kpi": {
                            const sales = e.month_sales ?? 0;
                            const att = e.attendance_pct ?? 0;
                            const tgt = e.target_pct;
                            return (
                              <td key={key} data-label={_label} className="px-3 py-2.5">
                                <div className="flex flex-wrap items-center gap-1">
                                  {sales > 0 && (
                                    <Badge variant="outline" className="border-success/30 text-success text-[10px]">
                                      {formatMoney(sales)}
                                    </Badge>
                                  )}
                                  {tgt != null && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] ${tgt >= 100 ? "border-success/30 text-success" : tgt >= 60 ? "border-warning/30 text-warning" : "border-danger/30 text-danger"}`}
                                    >
                                      Hədəf {tgt}%
                                    </Badge>
                                  )}
                                  {att > 0 && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] ${att >= 90 ? "border-success/30 text-success" : att >= 70 ? "border-warning/30 text-warning" : "border-danger/30 text-danger"}`}
                                    >
                                      Davam. {att}%
                                    </Badge>
                                  )}
                                  {sales === 0 && att === 0 && (
                                    <span className="text-[10px] text-muted-foreground">—</span>
                                  )}
                                </div>
                              </td>
                            );
                          }
                          case "sobe":
                            return <td key={key} data-label={_label} className="px-3 py-2.5 text-xs text-muted-foreground">—</td>;
                          case "filial":
                            return <td key={key} data-label={_label} className="px-3 py-2.5 text-xs">{e.default_filial_ad ?? "—"}</td>;
                          case "telefon":
                            return (
                              <td key={key} data-label={_label} className="px-3 py-2.5 text-xs text-muted-foreground">
                                {e.telefon ? (
                                  <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{e.telefon}</span>
                                ) : "—"}
                              </td>
                            );
                          case "email":
                            return <td key={key} data-label={_label} className="px-3 py-2.5 text-xs">{e.email}</td>;
                          case "ise_baslama":
                            return <td key={key} data-label={_label} className="px-3 py-2.5 text-xs text-muted-foreground">{e.ise_baslama ? formatDate(e.ise_baslama) : "—"}</td>;
                          case "maas":
                            return <td key={key} data-label={_label} className="px-3 py-2.5 text-right tabular-nums">{e.aylik_maas > 0 ? formatMoney(e.aylik_maas) : "—"}</td>;
                          case "status":
                            return (
                              <td key={key} data-label={_label} className="px-3 py-2.5">
                                <span className={"inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold leading-none shadow-sm shadow-black/[0.02] dark:shadow-black/20 " + s.cls}>
                                  <span aria-hidden className={"h-1.5 w-1.5 shrink-0 rounded-full " + s.dotCls} />
                                  {s.label}
                                </span>
                              </td>
                            );
                          case "son_giris":
                            return <td key={key} data-label={_label} className="px-3 py-2.5 text-xs text-muted-foreground">{e.son_giris ? formatDate(e.son_giris) : "—"}</td>;
                          case "fin_kod":
                            return <td key={key} data-label={_label} className="px-3 py-2.5 text-xs">{e.fin_kod ?? "—"}</td>;
                          case "dogum":
                            return <td key={key} data-label={_label} className="px-3 py-2.5 text-xs">{e.dogum_tarixi ? formatDate(e.dogum_tarixi) : "—"}</td>;
                          case "unvan":
                            return <td key={key} data-label={_label} className="px-3 py-2.5 text-xs text-muted-foreground max-w-xs truncate">{e.unvan ?? "—"}</td>;
                          case "bank":
                            return (
                              <td key={key} data-label={_label} className="px-3 py-2.5 text-xs">
                                {e.bank_ad || e.bank_hesab ? (
                                  <div>
                                    {e.bank_ad && <div>{e.bank_ad}</div>}
                                    {e.bank_hesab && <div className="font-mono text-[10px] text-muted-foreground">{e.bank_hesab}</div>}
                                  </div>
                                ) : "—"}
                              </td>
                            );
                          case "eml":
                            return (
                              <td key={key} data-label={_label} className="px-3 py-2.5">
                                <div className="flex items-center justify-end gap-0.5">
                                  <Link href={`/iscilier/${e.id}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground" title="Profil">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Link>
                                  <Link href={`/iscilier/${e.id}?tab=maas`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground" title="Maaş bordrosu">
                                    <Wallet className="h-3.5 w-3.5" />
                                  </Link>
                                  <Link href={`/iscilier/${e.id}?tab=davamiyyet`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground" title="Davamiyyət">
                                    <CalendarDays className="h-3.5 w-3.5" />
                                  </Link>
                                  {canEdit && <EmployeeDialog roles={roles} filiallar={filiallar} vezifeler={vezifeler} initial={e} trigger="edit" />}
                                  {canEdit && e.aktiv && (
                                    <Button size="icon-sm" variant="ghost" title="Əməliyyatdan çıxar" disabled={pending} onClick={() => onDeactivate(e.id, e.ad_soyad)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
