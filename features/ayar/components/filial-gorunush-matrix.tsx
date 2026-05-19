"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  Eye,
  Loader2,
  CheckSquare,
  Square,
  Wallet,
  Boxes,
  Users,
  Truck,
  TrendingDown,
  Package,
  BadgeDollarSign,
  ShoppingCart,
  UserCog,
  FileBarChart,
  Wrench,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toggleFilialGorunush, bulkSetFilialGorunush } from "../actions";

type Filial = {
  id: number;
  ad: string;
  kod: string | null;
  tip: string | null;
  aktiv: boolean | null;
  seh_r: string | null;
};

type Gorunush = {
  kassa_gor: boolean;
  anbar_gor: boolean;
  stok_gor: boolean;
  musteri_gor: boolean;
  techizatci_gor: boolean;
  borc_gor: boolean;
  mehsul_gor: boolean;
  satis_gor: boolean;
  alis_gor: boolean;
  emekdas_gor: boolean;
  hesabat_gor: boolean;
  servis_gor: boolean;
};

type Row = { target: Filial; gorunush: Gorunush };

const RESOURCES: Array<{
  key: keyof Gorunush;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  hint: string;
}> = [
  { key: "kassa_gor", label: "Kassa", icon: Wallet, tone: "text-emerald-500", hint: "Açıq POS sessiyaları və balanslar" },
  { key: "anbar_gor", label: "Anbar", icon: Boxes, tone: "text-orange-500", hint: "Anbar siyahısı və ümumi məlumat" },
  { key: "stok_gor", label: "Stok", icon: Package, tone: "text-amber-500", hint: "Məhsul stok qalıqları və hərəkəti" },
  { key: "mehsul_gor", label: "Məhsul", icon: Package, tone: "text-indigo-500", hint: "Məhsul kataloqu və qiymətlər" },
  { key: "musteri_gor", label: "Müştəri", icon: Users, tone: "text-sky-500", hint: "Müştəri bazası" },
  { key: "techizatci_gor", label: "Təchizatçı", icon: Truck, tone: "text-amber-600", hint: "Təchizatçı bazası" },
  { key: "borc_gor", label: "Borc", icon: TrendingDown, tone: "text-rose-500", hint: "Debitor/kreditor borcları" },
  { key: "satis_gor", label: "Satış", icon: BadgeDollarSign, tone: "text-emerald-600", hint: "Satış qaimələri və əməliyyatları" },
  { key: "alis_gor", label: "Alış", icon: ShoppingCart, tone: "text-violet-500", hint: "Alış qaimələri" },
  { key: "emekdas_gor", label: "Əməkdaş", icon: UserCog, tone: "text-teal-500", hint: "İşçi siyahısı və davamiyyət" },
  { key: "hesabat_gor", label: "Hesabat", icon: FileBarChart, tone: "text-primary", hint: "Hesabatlar və analitika" },
  { key: "servis_gor", label: "Servis", icon: Wrench, tone: "text-fuchsia-500", hint: "Servis sifarişləri" },
];

export function FilialGorunushMatrix({
  sourceFilial,
  rows,
}: {
  sourceFilial: { id: number; ad: string; kod: string | null };
  rows: Row[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  function toggle(targetId: number, field: keyof Gorunush, current: boolean) {
    const key = `${targetId}-${field}`;
    setPendingKey(key);
    const fd = new FormData();
    fd.set("source_filial_id", String(sourceFilial.id));
    fd.set("target_filial_id", String(targetId));
    fd.set("field", field);
    fd.set("value", String(!current));
    startTransition(async () => {
      const res = await toggleFilialGorunush(fd);
      setPendingKey(null);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Görünüş yeniləndi");
        router.refresh();
      }
    });
  }

  function bulkSet(targetId: number, mode: "all" | "none" | "view-only") {
    const fd = new FormData();
    fd.set("source_filial_id", String(sourceFilial.id));
    fd.set("target_filial_id", String(targetId));
    fd.set("mode", mode);
    startTransition(async () => {
      const res = await bulkSetFilialGorunush(fd);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(
          mode === "all"
            ? "Tam görünüş açıldı"
            : mode === "none"
            ? "Bütün görünüşlər söndürüldü"
            : "Yalnız-oxuma rejimi tətbiq edildi"
        );
        router.refresh();
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        Başqa filial yoxdur — görünüş qaydası qurmaq üçün ən az 2 filial olmalıdır
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold">Filiallar arası görünüş matrisi</p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">«{sourceFilial.ad}»</strong> filialının digər filialların məlumatlarını nə dərəcədə görəcəyini təyin edin.
                İstiqamətlidir — yəni «Mərkəz Nefçilərə baxır» demək «Nefçilər Mərkəzə baxır» demək deyil.
                Hər filial üçün ayrıca tənzimləməyə baxın.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === MATRIX === */}
      <Card>
        <CardContent className="p-0">
          <div className="max-w-full overflow-x-auto">
            <table className="min-w-[760px] text-sm">
              <thead className="bg-card">
                <tr className="border-b border-border/60">
                  <th className="sticky left-0 z-10 min-w-[180px] bg-card px-3 py-3 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Hədəf filial
                  </th>
                  {RESOURCES.map((r) => {
                    const Icon = r.icon;
                    return (
                      <th
                        key={r.key}
                        title={r.hint}
                        className="px-1 py-3 text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <Icon className={cn("h-3.5 w-3.5", r.tone)} />
                          <span className="hidden xl:inline">{r.label}</span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="sticky right-0 z-10 min-w-[180px] bg-card px-3 py-3 text-right text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Toplu
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ target, gorunush }) => {
                  const allOn = RESOURCES.every((r) => gorunush[r.key]);
                  const allOff = RESOURCES.every((r) => !gorunush[r.key]);

                  return (
                    <tr key={target.id} className="border-b border-border/30 transition hover:bg-secondary/30">
                      <td className="sticky left-0 z-10 bg-card px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center rounded-md text-white text-[10px] font-bold",
                              !target.aktiv && "opacity-50"
                            )}
                            style={{ background: "var(--brand-gradient)" }}
                          >
                            {(target.kod ?? target.ad).slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold">{target.ad}</span>
                              {target.kod && <Badge variant="outline" className="text-[9px]">{target.kod}</Badge>}
                              {!target.aktiv && <Badge variant="outline" className="text-[9px] text-amber-500">passiv</Badge>}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {target.tip ?? "mağaza"} · {target.seh_r ?? "—"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {RESOURCES.map((r) => {
                        const enabled = gorunush[r.key];
                        const key = `${target.id}-${r.key}`;
                        const loading = pendingKey === key;
                        return (
                          <td key={r.key} className="px-1 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggle(target.id, r.key, enabled)}
                              disabled={pending}
                              title={`${r.label}: ${enabled ? "Görür" : "Görmür"}`}
                              className={cn(
                                "grid h-7 w-7 place-items-center rounded-md transition",
                                enabled
                                  ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25"
                                  : "bg-muted/40 text-muted-foreground hover:bg-muted",
                                pending && "cursor-wait opacity-60"
                              )}
                            >
                              {loading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : enabled ? (
                                <CheckSquare className="h-3.5 w-3.5" />
                              ) : (
                                <Square className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </td>
                        );
                      })}

                      <td className="sticky right-0 z-10 bg-card px-3 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => bulkSet(target.id, "view-only")}
                            disabled={pending}
                            title="Yalnız oxuma: anbar/stok/məhsul/müştəri/təchizatçı/hesabat"
                            className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-600 hover:bg-sky-500/20"
                          >
                            <Eye className="inline h-3 w-3" /> Baxış
                          </button>
                          <button
                            type="button"
                            onClick={() => bulkSet(target.id, "all")}
                            disabled={pending || allOn}
                            className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-40"
                          >
                            Hamısı
                          </button>
                          <button
                            type="button"
                            onClick={() => bulkSet(target.id, "none")}
                            disabled={pending || allOff}
                            className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-500 hover:bg-rose-500/20 disabled:opacity-40"
                          >
                            Heç biri
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* === LEGEND === */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Resurs təsviri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {RESOURCES.map((r) => {
              const Icon = r.icon;
              return (
                <div key={r.key} className="flex items-start gap-2 text-xs">
                  <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", r.tone)} />
                  <div>
                    <span className="font-semibold">{r.label}</span>
                    <span className="text-muted-foreground"> — {r.hint}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
