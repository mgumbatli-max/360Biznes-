"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  ShoppingCart,
  Package,
  Sparkles,
  Eye,
  Plus,
  Minus,
} from "lucide-react";
import { QuickViewTrigger } from "@/features/anbar/components/quick-view-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { bulkCreateProposal } from "../proposal-actions";

type Row = {
  id: string;
  ad: string;
  kod: string | null;
  barkod: string | null;
  marka: string | null;
  kateqoriya: string | null;
  stok: number;
  sale30: number;
  sale70: number;
  sale80: number;
  dailyRate: number;
  daysOfStock: number;
  lastSaleDate: Date | null;
  alish_qiymeti: number;
  satis_qiymeti: number;
  tedarukci_id: string | null;
  kritik_stok: number;
  durum: "bitib" | "kritik" | "azalir" | "donmus" | "passiv" | "normal";
  aiTovsiye: string;
  suggestedQty: number;
};

const DURUM_INFO: Record<string, { label: string; cls: string }> = {
  bitib: { label: "Bitib", cls: "text-rose-500 border-rose-500/40 bg-rose-500/10" },
  kritik: { label: "Kritik", cls: "text-rose-500 border-rose-500/40 bg-rose-500/10" },
  azalir: { label: "Az qalıb", cls: "text-amber-500 border-amber-500/40 bg-amber-500/10" },
  donmus: { label: "Donmuş", cls: "text-muted-foreground border-border bg-secondary/50" },
  passiv: { label: "Passiv", cls: "text-muted-foreground border-border bg-secondary/50" },
  normal: { label: "Normal", cls: "text-emerald-600 border-emerald-500/40 bg-emerald-500/10" },
};

export function PlanningTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Map<string, number>>(new Map());
  const [groupBySupplier, setGroupBySupplier] = useState(false);

  const filtered = useMemo(() => {
    let r = rows;
    if (filter !== "all") r = r.filter((x) => x.durum === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (x) =>
          x.ad.toLowerCase().includes(q) ||
          x.kod?.toLowerCase().includes(q) ||
          x.barkod?.includes(q) ||
          x.marka?.toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, filter, search]);

  function toggleAll(check: boolean) {
    if (!check) return setSelected(new Map());
    const map = new Map(selected);
    for (const r of filtered) {
      if (r.suggestedQty > 0 && !map.has(r.id)) map.set(r.id, r.suggestedQty);
    }
    setSelected(map);
  }

  function toggleOne(r: Row) {
    const map = new Map(selected);
    if (map.has(r.id)) map.delete(r.id);
    else map.set(r.id, r.suggestedQty || 1);
    setSelected(map);
  }

  function setQty(id: string, qty: number) {
    if (qty <= 0) {
      const map = new Map(selected);
      map.delete(id);
      setSelected(map);
      return;
    }
    setSelected(new Map(selected).set(id, qty));
  }

  function adjustQty(id: string, delta: number) {
    const cur = selected.get(id) ?? 0;
    setQty(id, cur + delta);
  }

  function create() {
    if (selected.size === 0) {
      toast.error("Heç bir məhsul seçilməyib");
      return;
    }
    const items = Array.from(selected.entries()).map(([mehsul_id, miqdar]) => ({ mehsul_id, miqdar }));
    const fd = new FormData();
    fd.set("items", JSON.stringify(items));
    if (groupBySupplier) fd.set("grup_by_supplier", "true");
    startTransition(async () => {
      const res = await bulkCreateProposal(fd);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success(`${res.data.ids.length} təklif yaradıldı`);
        setSelected(new Map());
        if (res.data.ids.length === 1) {
          router.replace(`/satinalma/${res.data.ids[0]}`);
        } else {
          router.refresh();
        }
      }
    });
  }

  const totalSelected = Array.from(selected.values()).reduce((s, n) => s + n, 0);
  const totalAmount = Array.from(selected.entries()).reduce((s, [id, qty]) => {
    const r = rows.find((x) => x.id === id);
    return s + (r ? r.alish_qiymeti * qty : 0);
  }, 0);

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <Card className="glass">
        <CardContent className="flex flex-wrap items-center gap-2 py-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Məhsul, kod, marka, barkod..."
              className="h-9 pl-8"
            />
          </div>
          <FilterBtn label="Hamısı" value="all" current={filter} onClick={setFilter} count={rows.length} />
          <FilterBtn
            label="Bitib"
            value="bitib"
            current={filter}
            onClick={setFilter}
            count={rows.filter((r) => r.durum === "bitib").length}
            tone="rose"
          />
          <FilterBtn
            label="Kritik"
            value="kritik"
            current={filter}
            onClick={setFilter}
            count={rows.filter((r) => r.durum === "kritik").length}
            tone="rose"
          />
          <FilterBtn
            label="Az qalıb"
            value="azalir"
            current={filter}
            onClick={setFilter}
            count={rows.filter((r) => r.durum === "azalir").length}
            tone="amber"
          />
          <FilterBtn
            label="Donmuş"
            value="donmus"
            current={filter}
            onClick={setFilter}
            count={rows.filter((r) => r.durum === "donmus").length}
          />
        </CardContent>
      </Card>

      {/* Selection bar (sticky) */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-20 -mx-2">
          <Card className="border-primary/40 bg-primary/5 backdrop-blur">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-2">
              <div className="flex items-center gap-3 text-sm">
                <Badge className="bg-primary text-primary-foreground">
                  {selected.size} məhsul seçilib
                </Badge>
                <span className="text-muted-foreground">·</span>
                <span>
                  <span className="font-semibold">{totalSelected}</span> ədəd
                </span>
                <span className="text-muted-foreground">·</span>
                <span>
                  ~ <span className="font-bold tabular-nums">{totalAmount.toFixed(2)} ₼</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={groupBySupplier}
                    onChange={(e) => setGroupBySupplier(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Təchizatçıya görə qrupla
                </label>
                <button
                  type="button"
                  onClick={() => setSelected(new Map())}
                  className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/70"
                >
                  Ləğv et
                </button>
                <button
                  type="button"
                  onClick={create}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                  Seçilmişdən alış yarat
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card className="glass">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="px-3 py-12 text-center text-sm text-muted-foreground">
              <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              {search || filter !== "all" ? "Filtirə uyğun məhsul yoxdur" : "Məhsul yoxdur"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-wider text-muted-foreground z-10">
                  <tr className="border-b border-border/40">
                    <th className="w-10 px-2 py-2.5">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={(e) => toggleAll(e.target.checked)}
                        className="h-4 w-4 accent-primary"
                        title="Hamısını seç"
                      />
                    </th>
                    <th className="px-2 py-2.5 text-left">Məhsul</th>
                    <th className="w-20 px-2 py-2.5 text-right">Stok</th>
                    <th className="w-20 px-2 py-2.5 text-right">Son 30</th>
                    <th className="w-20 px-2 py-2.5 text-right">Son 70</th>
                    <th className="w-20 px-2 py-2.5 text-right">Bitmə</th>
                    <th className="w-24 px-2 py-2.5">Durum</th>
                    <th className="px-2 py-2.5 text-left">AI tövsiyə</th>
                    <th className="w-40 px-2 py-2.5">Sifariş sayı</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const isSelected = selected.has(r.id);
                    const qty = selected.get(r.id) ?? r.suggestedQty;
                    const info = DURUM_INFO[r.durum];
                    return (
                      <tr
                        key={r.id}
                        className={cn(
                          "border-b border-border/20 transition cursor-pointer",
                          isSelected ? "bg-primary/5" : "hover:bg-secondary/30"
                        )}
                        onClick={() => toggleOne(r)}
                      >
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(r)}
                            className="h-4 w-4 accent-primary"
                          />
                        </td>
                        <td className="px-2 py-2 max-w-md" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground/60">
                              <Package className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <QuickViewTrigger mehsulId={r.id}>
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-sm font-semibold">{r.ad}</span>
                                  <Eye className="h-3 w-3 shrink-0 opacity-60" />
                                </div>
                              </QuickViewTrigger>
                              <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                                {r.kod && <span className="font-mono">{r.kod}</span>}
                                {r.marka && <span>· {r.marka}</span>}
                                {r.alish_qiymeti > 0 && <span>· maya: {r.alish_qiymeti.toFixed(2)}₼</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={cn("px-2 py-2 text-right text-xs tabular-nums", r.stok === 0 && "font-bold text-rose-500")}>
                          {r.stok}
                        </td>
                        <td className="px-2 py-2 text-right text-xs tabular-nums text-muted-foreground">{r.sale30}</td>
                        <td className="px-2 py-2 text-right text-xs tabular-nums text-muted-foreground">{r.sale70}</td>
                        <td className="px-2 py-2 text-right text-xs tabular-nums">
                          {r.daysOfStock < 999 ? `${Math.round(r.daysOfStock)} gün` : "—"}
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className={cn("text-[10px]", info.cls)}>
                            {info.label}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-xs max-w-xs">
                          {(() => {
                            const urgency = r.durum === "bitib" || r.durum === "kritik"
                              ? { dot: "bg-rose-500", text: "İndi al", textCls: "text-rose-600 dark:text-rose-400" }
                              : r.durum === "azalir"
                              ? { dot: "bg-amber-500", text: "Tezliklə", textCls: "text-amber-600 dark:text-amber-400" }
                              : r.durum === "normal"
                              ? { dot: "bg-emerald-500", text: "Stok var", textCls: "text-emerald-600 dark:text-emerald-400" }
                              : { dot: "bg-muted-foreground/40", text: "İzlə", textCls: "text-muted-foreground" };
                            return (
                              <span
                                className="flex items-center gap-1.5"
                                title={r.aiTovsiye}
                              >
                                <span className={cn("h-2 w-2 shrink-0 rounded-full", urgency.dot)} aria-hidden />
                                <span className={cn("text-[11px] font-semibold", urgency.textCls)}>{urgency.text}</span>
                                <span className="line-clamp-1 text-muted-foreground">· {r.aiTovsiye}</span>
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          {isSelected ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => adjustQty(r.id, -1)}
                                className="grid h-7 w-7 place-items-center rounded-md bg-secondary text-muted-foreground hover:text-foreground"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={qty}
                                onChange={(e) => setQty(r.id, Number(e.target.value))}
                                className="h-7 w-16 rounded-md border border-input bg-background px-2 text-center text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => adjustQty(r.id, 1)}
                                className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary hover:bg-primary/15"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleOne(r)}
                              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-[10.5px] font-semibold text-primary hover:bg-primary/15"
                            >
                              <Plus className="h-3 w-3" />
                              {r.suggestedQty > 0 ? `${r.suggestedQty} sifariş et` : "Seç"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterBtn({
  label,
  value,
  current,
  onClick,
  count,
  tone,
}: {
  label: string;
  value: string;
  current: string;
  onClick: (v: string) => void;
  count: number;
  tone?: "rose" | "amber";
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground",
        !active && tone === "rose" && count > 0 && "text-rose-500",
        !active && tone === "amber" && count > 0 && "text-amber-500"
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[9px] tabular-nums",
          active ? "bg-white/20" : "bg-background"
        )}
      >
        {count}
      </span>
    </button>
  );
}
