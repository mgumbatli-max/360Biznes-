"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, Loader2, CalendarDays, LogIn, LogOut, AlertTriangle, FileDown, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { formatDate } from "@/lib/utils";
import { saveAttendance, markAllPresentToday, quickMarkAttendance } from "../davamiyyet-actions";

const MONTH_LABELS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

const STATUS_COLOR = {
  present: { bg: "bg-success/30", label: "Gəlib" },
  late: { bg: "bg-warning/40", label: "Gec" },
  absent: { bg: "bg-danger/30", label: "Qaib" },
  off: { bg: "bg-slate-500/15", label: "İstirahət" },
  leave: { bg: "bg-info/30", label: "Məzuniyyət" },
  future: { bg: "bg-secondary/30", label: "—" },
} as const;

const SHIFT_LABEL: Record<string, string> = {
  seher: "Səhər",
  axsam: "Axşam",
  gece: "Gecə",
};

type Row = {
  id: string;
  tarix: Date;
  istifadeci_id: string;
  istifadeci_ad: string;
  vezife: string | null;
  giris: Date | null;
  cixis: Date | null;
  gozlenen_giris: Date | null;
  gozlenen_cixis: Date | null;
  gec_dq: number;
  ish_saatlari: number | null;
  status: string;
  qeyd: string | null;
  shift: string | null;
  fasile_dq: number;
  overtime_dq: number;
};

type Employee = { id: string; ad_soyad: string; vezife: string | null };

type GridRow = {
  istifadeci_id: string;
  ad_soyad: string;
  vezife: string | null;
  days: Array<{ d: number; status: keyof typeof STATUS_COLOR }>;
};

type ReportRow = {
  istifadeci_id: string;
  ad_soyad: string;
  vezife: string | null;
  ish_gun: number;
  qaib_gun: number;
  gec_dq: number;
  overtime_dq: number;
  fasile_dq: number;
  ish_saat: number;
};

type Props = {
  month: { il: number; ay: number; daysInMonth: number };
  rows: Row[];
  employees: Employee[];
  grid: GridRow[];
  kpi: { total_qeyd: number; gec: number; qaib: number; vaxtinda: number };
  report: ReportRow[];
  currentFilters: { istifadeci_id?: string; status?: string };
};

function formatTime(d: Date | null): string {
  if (!d) return "—";
  return formatDate(d, { hour: "2-digit", minute: "2-digit" });
}

export function DavamiyyetPanel({ month, rows, employees, grid, kpi, report, currentFilters }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<"grid" | "list" | "report">("grid");
  const [selectedMonth, setSelectedMonth] = useState(`${month.il}-${String(month.ay).padStart(2, "0")}`);

  function updateMonth(m: string) {
    setSelectedMonth(m);
    const sp = new URLSearchParams();
    sp.set("month", m);
    if (currentFilters.istifadeci_id) sp.set("istifadeci_id", currentFilters.istifadeci_id);
    if (currentFilters.status) sp.set("status", currentFilters.status);
    router.push(`/iscilier/davamiyyet?${sp.toString()}`);
  }

  function setFilter(key: "istifadeci_id" | "status", val: string) {
    const sp = new URLSearchParams();
    sp.set("month", `${month.il}-${String(month.ay).padStart(2, "0")}`);
    if (key === "istifadeci_id") {
      if (val) sp.set("istifadeci_id", val);
      if (currentFilters.status) sp.set("status", currentFilters.status);
    }
    if (key === "status") {
      if (val) sp.set("status", val);
      if (currentFilters.istifadeci_id) sp.set("istifadeci_id", currentFilters.istifadeci_id);
    }
    router.push(`/iscilier/davamiyyet?${sp.toString()}`);
  }

  function onMarkAll() {
    if (!confirm("Bütün aktiv işçilər bu gün gəldiyini qeyd etsin?")) return;
    startTransition(async () => {
      const res = await markAllPresentToday();
      if (res.ok) toast.success(`${res.count ?? 0} işçi qeyd edildi`);
      else toast.error(res.error);
      router.refresh();
    });
  }

  function onExportExcel() {
    const url = `/api/iscilier/davamiyyet/export?month=${selectedMonth}`;
    window.location.href = url;
  }

  const monthOptions = (() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      opts.push({ value: val, label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}` });
    }
    return opts;
  })();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={CalendarDays} label="Bu ay qeyd" value={String(kpi.total_qeyd)} subline="Davamiyyət qeydi" />
        <KpiCard icon={LogIn} label="Vaxtında" value={String(kpi.vaxtinda)} subline="Vaxtında gələn" tone="success" />
        <KpiCard icon={AlertTriangle} label="Gecikən" value={String(kpi.gec)} subline="Gözlənəndən gec" tone={kpi.gec > 0 ? "warning" : "neutral"} />
        <KpiCard icon={LogOut} label="Qaib" value={String(kpi.qaib)} subline="Gəlməyən" tone={kpi.qaib > 0 ? "danger" : "neutral"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedMonth}
          onChange={(e) => updateMonth(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={currentFilters.istifadeci_id ?? ""}
          onChange={(e) => setFilter("istifadeci_id", e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">Bütün işçilər</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.ad_soyad}</option>
          ))}
        </select>
        <select
          value={currentFilters.status ?? ""}
          onChange={(e) => setFilter("status", e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">Bütün statuslar</option>
          <option value="qaydasinda">Qaydasında</option>
          <option value="gecikib">Gecikib</option>
          <option value="qaib">Qaib</option>
          <option value="istirahet">İstirahət</option>
          <option value="mezuniyyet">Məzuniyyət</option>
        </select>

        <div className="ml-auto flex gap-2">
          <div className="flex rounded-md border border-border bg-background p-0.5">
            <button onClick={() => setView("grid")} className={`px-2 py-1 text-xs rounded ${view === "grid" ? "bg-secondary" : ""}`}>Grid</button>
            <button onClick={() => setView("list")} className={`px-2 py-1 text-xs rounded ${view === "list" ? "bg-secondary" : ""}`}>Siyahı</button>
            <button onClick={() => setView("report")} className={`px-2 py-1 text-xs rounded ${view === "report" ? "bg-secondary" : ""}`}>Aylıq</button>
          </div>
          <Button variant="outline" size="sm" onClick={onExportExcel}>
            <FileDown className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={onMarkAll} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Bütün işçilər bu gün gəlib
          </Button>
          <ManualEntryDialog employees={employees} />
        </div>
      </div>

      {view === "grid" && (
        <QuickToday employees={employees} grid={grid} />
      )}

      {view === "grid" ? (
        <Card className="glass">
          <CardContent className="p-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">İşçi</th>
                    {Array.from({ length: month.daysInMonth }, (_, i) => i + 1).map((d) => (
                      <th key={d} className="px-1 py-2 text-center text-[10px] text-muted-foreground tabular-nums">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.length === 0 ? (
                    <tr>
                      <td colSpan={month.daysInMonth + 1} className="py-8 text-center text-sm text-muted-foreground">
                        Aktiv işçi yoxdur
                      </td>
                    </tr>
                  ) : grid.map((g) => (
                    <tr key={g.istifadeci_id} className="border-b border-border/30">
                      <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-secondary text-[10px]">
                              {g.ad_soyad.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs">{g.ad_soyad}</span>
                        </div>
                      </td>
                      {g.days.map((day) => {
                        const c = STATUS_COLOR[day.status];
                        return (
                          <td key={day.d} className="px-0.5 py-1.5 text-center">
                            <div className={`mx-auto h-5 w-5 rounded ${c.bg}`} title={`Gün ${day.d}: ${c.label}`} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 px-2 pb-1 text-[10.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-success/30" /> Gəlib</span>
              <span className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-warning/40" /> Gec</span>
              <span className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-danger/30" /> Qaib</span>
              <span className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-info/30" /> Məzuniyyət</span>
              <span className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-slate-500/15" /> İstirahət</span>
              <span className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-secondary/30" /> Gələcək</span>
            </div>
          </CardContent>
        </Card>
      ) : view === "list" ? (
        rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <CalendarDays className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <h3 className="font-semibold">Davamiyyət qeydi yoxdur</h3>
          </div>
        ) : (
          <Card className="glass">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">Tarix</th>
                      <th className="px-3 py-2.5">İşçi</th>
                      <th className="px-3 py-2.5">Növbə</th>
                      <th className="px-3 py-2.5">Giriş</th>
                      <th className="px-3 py-2.5">Çıxış</th>
                      <th className="px-3 py-2.5">Fasilə</th>
                      <th className="px-3 py-2.5">İş saat</th>
                      <th className="px-3 py-2.5">Gecikmə</th>
                      <th className="px-3 py-2.5">Overtime</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-border/30">
                        <td className="px-3 py-2 text-xs">{formatDate(r.tarix)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="bg-secondary text-[10px]">
                                {r.istifadeci_ad.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{r.istifadeci_ad}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">{r.shift ? SHIFT_LABEL[r.shift] : "—"}</td>
                        <td className="px-3 py-2 tabular-nums font-medium">{formatTime(r.giris)}</td>
                        <td className="px-3 py-2 text-xs tabular-nums">{formatTime(r.cixis)}</td>
                        <td className="px-3 py-2 text-xs">{r.fasile_dq > 0 ? `${r.fasile_dq} dq` : "—"}</td>
                        <td className="px-3 py-2 text-xs tabular-nums">{r.ish_saatlari ? `${r.ish_saatlari}s` : "—"}</td>
                        <td className="px-3 py-2 text-xs">{r.gec_dq > 0 ? `${r.gec_dq} dq` : "—"}</td>
                        <td className="px-3 py-2 text-xs">{r.overtime_dq > 0 ? `${r.overtime_dq} dq` : "—"}</td>
                        <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-base">Aylıq rapor</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">İşçi</th>
                    <th className="px-3 py-2.5 text-right">İş günü</th>
                    <th className="px-3 py-2.5 text-right">Qaib</th>
                    <th className="px-3 py-2.5 text-right">Gecikmə (dq)</th>
                    <th className="px-3 py-2.5 text-right">Overtime (dq)</th>
                    <th className="px-3 py-2.5 text-right">Fasilə (dq)</th>
                    <th className="px-3 py-2.5 text-right">İş saat</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((r) => (
                    <tr key={r.istifadeci_id} className="border-b border-border/30">
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.ad_soyad}</div>
                        <div className="text-xs text-muted-foreground">{r.vezife ?? "—"}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.ish_gun}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-danger">{r.qaib_gun || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-warning">{r.gec_dq || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-success">{r.overtime_dq || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.fasile_dq || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.ish_saat.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    qaydasinda: { label: "OK", cls: "border-success/30 text-success" },
    gecikib: { label: "Gecikib", cls: "border-warning/30 text-warning" },
    qaib: { label: "Qaib", cls: "border-danger/30 text-danger" },
    istirahet: { label: "İstirahət", cls: "border-border text-muted-foreground" },
    mezuniyyet: { label: "Məzuniyyət", cls: "border-info/30 text-info" },
  };
  const s = map[status] ?? map.qaydasinda;
  return <Badge variant="outline" className={s.cls + " text-[10px]"}>{s.label}</Badge>;
}

function QuickToday({ employees, grid }: { employees: Employee[]; grid: GridRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const day = today.getDate();

  // Build "current status today" map from grid
  const statusToday = new Map<string, "present" | "late" | "absent" | "off" | "future" | "leave" | "none">();
  for (const g of grid) {
    const cell = g.days.find((dd) => dd.d === day);
    statusToday.set(g.istifadeci_id, cell?.status ?? "none");
  }

  function quick(istifadeci_id: string, status: "qaydasinda" | "gecikib" | "qaib", gec_dq?: number) {
    setPendingId(istifadeci_id + ":" + status);
    const fd = new FormData();
    fd.set("istifadeci_id", istifadeci_id);
    fd.set("tarix", todayStr);
    fd.set("status", status);
    if (typeof gec_dq === "number") fd.set("gec_dq", String(gec_dq));
    startTransition(async () => {
      const res = await quickMarkAttendance(fd);
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success("Qeyd edildi");
      router.refresh();
    });
  }

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Check className="h-4 w-4 text-primary" />
          Bu gün ({formatDate(today)}) — sürətli qeyd
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-96 overflow-y-auto p-2">
        {employees.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground text-center">Aktiv işçi yoxdur</p>
        ) : (
          employees.map((e) => {
            const st = statusToday.get(e.id) ?? "none";
            const isP = pending && pendingId?.startsWith(e.id);
            return (
              <div
                key={e.id}
                className="flex items-center gap-2 rounded-md border border-border/40 px-2.5 py-1.5 hover:bg-secondary/40"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-secondary text-[10px]">
                    {e.ad_soyad.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{e.ad_soyad}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{e.vezife ?? "—"}</div>
                </div>
                <Badge variant="outline" className={`text-[10px] ${badgeCls(st)}`}>{badgeLabel(st)}</Badge>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={!!isP}
                    onClick={() => quick(e.id, "qaydasinda")}
                    className="inline-flex items-center gap-1 rounded border border-success/30 px-2 py-1 text-[11px] text-success hover:bg-success/10 disabled:opacity-50"
                    title="Gəldi"
                  >
                    <Check className="h-3 w-3" /> Gəldi
                  </button>
                  <LateButton onPick={(min) => quick(e.id, "gecikib", min)} disabled={!!isP} />
                  <button
                    type="button"
                    disabled={!!isP}
                    onClick={() => quick(e.id, "qaib")}
                    className="inline-flex items-center gap-1 rounded border border-danger/30 px-2 py-1 text-[11px] text-danger hover:bg-danger/10 disabled:opacity-50"
                    title="Qaib"
                  >
                    <X className="h-3 w-3" /> Qaib
                  </button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function LateButton({ onPick, disabled }: { onPick: (min: number) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(15);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded border border-warning/40 px-2 py-1 text-[11px] text-warning hover:bg-warning/10 disabled:opacity-50"
        title="Gecikdi"
      >
        <Clock className="h-3 w-3" /> Gec
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 flex items-center gap-1 rounded-md border border-border bg-card p-1 shadow-md">
          <input
            type="number"
            min={1}
            max={600}
            value={min}
            onChange={(e) => setMin(Math.max(1, Number(e.target.value) || 0))}
            className="h-7 w-14 rounded border border-border bg-background px-1.5 text-xs"
          />
          <span className="text-[10px] text-muted-foreground">dq</span>
          <Button
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              setOpen(false);
              onPick(min);
            }}
          >
            Yadda saxla
          </Button>
        </div>
      )}
    </div>
  );
}

function badgeCls(st: "present" | "late" | "absent" | "off" | "future" | "leave" | "none"): string {
  switch (st) {
    case "present":
      return "border-success/30 text-success";
    case "late":
      return "border-warning/30 text-warning";
    case "absent":
      return "border-danger/30 text-danger";
    case "leave":
      return "border-info/30 text-info";
    case "off":
      return "border-border text-muted-foreground";
    default:
      return "border-border text-muted-foreground";
  }
}

function badgeLabel(st: "present" | "late" | "absent" | "off" | "future" | "leave" | "none"): string {
  switch (st) {
    case "present":
      return "Gəlib";
    case "late":
      return "Gec";
    case "absent":
      return "Qaib";
    case "leave":
      return "Məzuniyyət";
    case "off":
      return "İstirahət";
    default:
      return "Qeyd yoxdur";
  }
}

function ManualEntryDialog({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [istifadeciId, setIstifadeciId] = useState("");
  const [status, setStatus] = useState("qaydasinda");
  const [shift, setShift] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("istifadeci_id", istifadeciId);
    fd.set("status", status);
    fd.set("shift", shift);
    startTransition(async () => {
      const res = await saveAttendance(fd);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success("Yadda saxlanıldı");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Manual yaz
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader><DialogTitle>Davamiyyət əlavə et</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>İşçi *</Label>
            <Combobox
              options={employees.map<ComboOption>((e) => ({ value: e.id, label: e.ad_soyad }))}
              value={istifadeciId}
              onChange={setIstifadeciId}
              placeholder="— İşçi seçin —"
              searchPlaceholder="Axtar..."
              emptyText="Tapılmadı"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tarix">Tarix *</Label>
            <Input id="tarix" name="tarix" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="space-y-2">
            <Label>Növbə</Label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">— Standart (09:00) —</option>
              <option value="seher">Səhər (08–16)</option>
              <option value="axsam">Axşam (16–24)</option>
              <option value="gece">Gecə (00–08)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="giris">Giriş</Label>
              <Input id="giris" name="giris" type="time" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cixis">Çıxış</Label>
              <Input id="cixis" name="cixis" type="time" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fasile_dq">Fasilə (dq)</Label>
              <Input id="fasile_dq" name="fasile_dq" type="number" min="0" max="600" defaultValue="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="overtime_dq">Overtime (dq)</Label>
              <Input id="overtime_dq" name="overtime_dq" type="number" min="0" max="600" defaultValue="0" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="qaydasinda">Qaydasında</option>
              <option value="gecikib">Gecikib</option>
              <option value="qaib">Qaib</option>
              <option value="istirahet">İstirahət</option>
              <option value="mezuniyyet">Məzuniyyət</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qeyd">Qeyd</Label>
            <Input id="qeyd" name="qeyd" maxLength={500} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending || !istifadeciId}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yadda saxla
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
