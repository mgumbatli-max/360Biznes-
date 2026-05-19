"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Phone, CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney, formatDate } from "@/lib/utils";
import type { FunnelSlice } from "../dashboard-queries";

type DrillRow = {
  id: string;
  ad: string;
  telefon: string | null;
  menecer_ad: string | null;
  budce: number;
  yas_gun: number;
  yaradildi: string | null;
};

type UserOpt = { id: string; ad_soyad: string };

const STAGE_META: Record<string, { label: string; ikon: string; bar: string; text: string }> = {
  yeni: { label: "Yeni", ikon: "🆕", bar: "bg-info/30", text: "text-info" },
  elaqe: { label: "Əlaqədə", ikon: "💬", bar: "bg-primary/30", text: "text-primary-light" },
  muzakire: { label: "Müzakirə", ikon: "🤝", bar: "bg-warning/30", text: "text-warning" },
  teklif: { label: "Təklif", ikon: "📩", bar: "bg-accent/30", text: "text-accent" },
  qazandi: { label: "Qazanıldı", ikon: "✅", bar: "bg-success/30", text: "text-success" },
  itirdi: { label: "İtirildi", ikon: "❌", bar: "bg-danger/30", text: "text-danger" },
};

export function FunnelView({ funnel, users, menbeler }: { funnel: FunnelSlice[]; users: UserOpt[]; menbeler: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [drillStatus, setDrillStatus] = useState<string | null>(null);
  const [drillRows, setDrillRows] = useState<DrillRow[]>([]);
  const [loading, setLoading] = useState(false);

  function setQueryParam(key: string, val: string) {
    const p = new URLSearchParams(sp.toString());
    if (val) p.set(key, val);
    else p.delete(key);
    router.push(`/crm/funnel?${p.toString()}`);
  }

  async function openDrill(status: string) {
    setDrillStatus(status);
    setLoading(true);
    setDrillRows([]);
    try {
      const qs = new URLSearchParams({ status });
      const m = sp.get("menecer");
      const mb = sp.get("menbe");
      const f = sp.get("from");
      const t = sp.get("to");
      if (m) qs.set("menecer", m);
      if (mb) qs.set("menbe", mb);
      if (f) qs.set("from", f);
      if (t) qs.set("to", t);
      const res = await fetch(`/api/crm/funnel-stage?${qs.toString()}`);
      const json = await res.json();
      if (json.ok) setDrillRows(json.items);
    } finally {
      setLoading(false);
    }
  }

  const winStages = funnel.filter((f) => f.status !== "itirdi");
  const maxCount = Math.max(1, ...winStages.map((f) => f.count));
  const totalIn = winStages[0]?.count ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={sp.get("menecer") ?? ""}
          onChange={(e) => setQueryParam("menecer", e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">Bütün məsullar</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.ad_soyad}</option>
          ))}
        </select>

        <select
          value={sp.get("menbe") ?? ""}
          onChange={(e) => setQueryParam("menbe", e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">Bütün mənbələr</option>
          {menbeler.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <Input
          type="date"
          className="h-8 w-[160px] text-xs"
          defaultValue={sp.get("from") ?? ""}
          onChange={(e) => setQueryParam("from", e.target.value)}
        />
        <span className="text-xs text-muted-foreground">→</span>
        <Input
          type="date"
          className="h-8 w-[160px] text-xs"
          defaultValue={sp.get("to") ?? ""}
          onChange={(e) => setQueryParam("to", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {winStages.map((row, i) => {
          const meta = STAGE_META[row.status] ?? STAGE_META.yeni;
          const widthPct = (row.count / maxCount) * 100;
          const prev = winStages[i - 1];
          const convFromPrev = prev && prev.count > 0 ? (row.count / prev.count) * 100 : null;
          const convFromTop = totalIn > 0 ? (row.count / totalIn) * 100 : 0;
          return (
            <button
              type="button"
              key={row.status}
              onClick={() => openDrill(row.status)}
              className="w-full rounded-lg border border-border/50 bg-card/40 p-3 text-left transition hover:border-primary/30 hover:bg-secondary/30"
              title="Bu mərhələdəki lead-lərə bax"
            >
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">{meta.ikon}</span>
                  <span className="font-semibold">{meta.label}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-muted-foreground">
                    <span className={`font-semibold tabular-nums ${meta.text}`}>{row.count}</span> müştəri
                  </span>
                  <span className="text-muted-foreground">
                    Dəyər: <span className="font-semibold text-foreground">{formatMoney(row.value)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Ümumidən: <span className="font-semibold">{convFromTop.toFixed(1)}%</span>
                  </span>
                  {convFromPrev != null && (
                    <span className="text-muted-foreground">
                      Əvvəlkidən: <span className="font-semibold">{convFromPrev.toFixed(1)}%</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary/40">
                <div
                  className={`h-full ${meta.bar} transition-all duration-500`}
                  style={{ width: `${Math.max(2, widthPct)}%` }}
                />
              </div>
            </button>
          );
        })}

        {/* İtirildi - shown separately */}
        {funnel.find((f) => f.status === "itirdi") && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 p-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-base">❌</span>
                <span className="font-semibold text-danger">İtirildi</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-danger">{funnel.find((f) => f.status === "itirdi")?.count ?? 0}</span> müştəri
                {" · "}
                <span>
                  Dəyər: {formatMoney(funnel.find((f) => f.status === "itirdi")?.value ?? 0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={drillStatus !== null} onOpenChange={(o) => { if (!o) setDrillStatus(null); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {drillStatus && (STAGE_META[drillStatus]?.label ?? drillStatus)} — Lead-lər ({drillRows.length})
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Yüklənir...
            </div>
          ) : drillRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Bu mərhələdə lead yoxdur</p>
          ) : (
            <div className="max-h-[500px] overflow-y-auto rounded-md border border-border/40">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary/40 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Ad</th>
                    <th className="px-3 py-2">Telefon</th>
                    <th className="px-3 py-2">Menecer</th>
                    <th className="px-3 py-2 text-right">Büdcə</th>
                    <th className="px-3 py-2 text-right">Yaş</th>
                  </tr>
                </thead>
                <tbody>
                  {drillRows.map((r) => (
                    <tr key={r.id} className="border-b border-border/30 hover:bg-secondary/30">
                      <td className="px-3 py-2">
                        <Link href={`/crm/leadler?q=${encodeURIComponent(r.ad)}`} className="font-medium hover:text-primary-light">
                          {r.ad}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.telefon ? (
                          <a href={`tel:${r.telefon}`} className="inline-flex items-center gap-1 hover:text-primary-light">
                            <Phone className="h-3 w-3" /> {r.telefon}
                          </a>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.menecer_ad ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.budce > 0 ? formatMoney(r.budce) : "—"}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          <CalendarClock className="mr-1 h-2.5 w-2.5" /> {r.yas_gun}d
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
