"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X, Loader2, Plane, Calendar, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { saveLeaveRequest, decideLeaveRequest } from "../mezuniyyet-actions";
import { LEAVE_TYPES, LEAVE_STATUS_LABEL } from "../types";
import { formatDate } from "@/lib/utils";

type Row = {
  id: number;
  istifadeci_id: string;
  istifadeci_ad: string;
  nov: string;
  baslama: Date;
  bitme: Date;
  gun_sayi: number;
  sebeb: string | null;
  status: string | null;
  tesdiq_eden: string | null;
  yaradildi: Date | null;
};

type Employee = { id: string; ad_soyad: string };

type Balances = Record<string, { tesdiq: number; gozleyir: number; red: number }>;

type Props = {
  rows: Row[];
  employees: Employee[];
  balances: Balances;
  filters: { status?: string; month?: string };
};

const MONTH_LABELS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

function parseSebeb(s: string | null): { text: string | null; evezleyici_id: string | null } {
  if (!s) return { text: null, evezleyici_id: null };
  try {
    const v = JSON.parse(s);
    if (typeof v === "object" && v) return { text: v.text ?? null, evezleyici_id: v.evezleyici_id ?? null };
  } catch {
    /* legacy string */
  }
  return { text: s, evezleyici_id: null };
}

export function MezuniyyetPanel({ rows, employees, balances, filters }: Props) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "calendar" | "balance">("list");

  function setFilter(key: "status" | "month", val: string) {
    const sp = new URLSearchParams();
    if (key === "status") {
      if (val) sp.set("status", val);
      if (filters.month) sp.set("month", filters.month);
    } else {
      if (val) sp.set("month", val);
      if (filters.status) sp.set("status", filters.status);
    }
    router.push(`/iscilier/mezuniyyet?${sp.toString()}`);
  }

  const monthOptions = (() => {
    const opts: { value: string; label: string }[] = [{ value: "", label: "Bütün aylar" }];
    const now = new Date();
    for (let i = -1; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      opts.push({ value: val, label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}` });
    }
    return opts;
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.status ?? ""}
          onChange={(e) => setFilter("status", e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">Bütün statuslar</option>
          <option value="gozleyir">Gözləyir</option>
          <option value="tesdiq">Təsdiqlənib</option>
          <option value="red">Rədd</option>
          <option value="legv">Ləğv</option>
        </select>
        <select
          value={filters.month ?? ""}
          onChange={(e) => setFilter("month", e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div className="ml-auto flex gap-2">
          <div className="flex rounded-md border border-border bg-background p-0.5">
            <button onClick={() => setView("list")} className={`px-2 py-1 text-xs rounded ${view === "list" ? "bg-secondary" : ""}`}>Siyahı</button>
            <button onClick={() => setView("calendar")} className={`px-2 py-1 text-xs rounded ${view === "calendar" ? "bg-secondary" : ""}`}>Kalendar</button>
            <button onClick={() => setView("balance")} className={`px-2 py-1 text-xs rounded ${view === "balance" ? "bg-secondary" : ""}`}>Balans</button>
          </div>
          <NewLeaveDialog employees={employees} />
        </div>
      </div>

      {view === "list" ? (
        rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <Plane className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <h3 className="font-semibold">Məzuniyyət ərizəsi yoxdur</h3>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <LeaveCard key={r.id} row={r} employees={employees} />
            ))}
          </div>
        )
      ) : view === "calendar" ? (
        <CalendarView rows={rows} month={filters.month} />
      ) : (
        <BalanceView balances={balances} />
      )}
    </div>
  );
}

function BalanceView({ balances }: { balances: Balances }) {
  return (
    <Card className="glass">
      <CardHeader className="pb-2"><CardTitle className="text-base">İllik balans (cari il)</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Növ</th>
                <th className="px-3 py-2.5 text-right">Norma / il</th>
                <th className="px-3 py-2.5 text-right">Təsdiqlənib</th>
                <th className="px-3 py-2.5 text-right">Gözləyir</th>
                <th className="px-3 py-2.5 text-right">Rədd</th>
              </tr>
            </thead>
            <tbody>
              {LEAVE_TYPES.map((t) => {
                const b = balances[t.value];
                return (
                  <tr key={t.value} className="border-b border-border/30">
                    <td className="px-3 py-2.5">{t.label}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{t.balance} gün</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-success">{b?.tesdiq ?? 0}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-warning">{b?.gozleyir ?? 0}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-danger">{b?.red ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function LeaveCard({ row, employees }: { row: Row; employees: Employee[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const s = LEAVE_STATUS_LABEL[row.status ?? "gozleyir"] ?? LEAVE_STATUS_LABEL.gozleyir;
  const typeLabel = LEAVE_TYPES.find((t) => t.value === row.nov)?.label ?? row.nov;
  const parsed = parseSebeb(row.sebeb);
  const evezleyici = parsed.evezleyici_id ? employees.find((e) => e.id === parsed.evezleyici_id) : null;

  function decide(decision: "tesdiq" | "red") {
    const note = decision === "red" ? prompt("Rədd səbəbi:") : null;
    if (decision === "red" && note === null) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", String(row.id));
      fd.set("decision", decision);
      if (note) fd.set("qeyd", note);
      const res = await decideLeaveRequest(fd);
      if (res.ok) toast.success(decision === "tesdiq" ? "Təsdiqləndi" : "Rədd edildi");
      else toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <Card className="glass">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-secondary text-xs font-semibold">
              {row.istifadeci_ad.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{row.istifadeci_ad}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">{typeLabel}</Badge>
              <span>{formatDate(row.baslama)} → {formatDate(row.bitme)}</span>
              <span>·</span>
              <span>{row.gun_sayi} gün</span>
              {row.tesdiq_eden && <span className="text-[10px]">(təsdiq: {row.tesdiq_eden})</span>}
              {evezleyici && (
                <span className="flex items-center gap-1 text-[10px]">
                  <ArrowRight className="h-3 w-3" /> Əvəzləyici: {evezleyici.ad_soyad}
                </span>
              )}
            </div>
            {parsed.text && <p className="mt-1 text-xs text-muted-foreground">{parsed.text}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={s.cls}>{s.label}</Badge>
          {row.status === "gozleyir" && (
            <>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => decide("tesdiq")} className="border-success/30 text-success">
                <Check className="h-3.5 w-3.5" /> Təsdiq
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => decide("red")} className="border-danger/30 text-danger">
                <X className="h-3.5 w-3.5" /> Rədd
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NewLeaveDialog({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);
  const [istifadeciId, setIstifadeciId] = useState("");
  const [nov, setNov] = useState("illik");
  const [baslama, setBaslama] = useState("");
  const [bitme, setBitme] = useState("");
  const [sebeb, setSebeb] = useState("");
  const [evezleyici, setEvezleyici] = useState("");
  const [faylUrl, setFaylUrl] = useState("");

  function reset() {
    setStep(1);
    setIstifadeciId("");
    setNov("illik");
    setBaslama("");
    setBitme("");
    setSebeb("");
    setEvezleyici("");
    setFaylUrl("");
  }

  const days = (() => {
    if (!baslama || !bitme) return 0;
    const a = new Date(baslama);
    const b = new Date(bitme);
    if (b < a) return 0;
    return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  })();

  function onSubmit() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("istifadeci_id", istifadeciId);
      fd.set("nov", nov);
      fd.set("baslama", baslama);
      fd.set("bitme", bitme);
      fd.set("sebeb", sebeb);
      if (evezleyici) fd.set("evezleyici_id", evezleyici);
      if (faylUrl) fd.set("fayl_url", faylUrl);
      const res = await saveLeaveRequest(fd);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Ərizə yaradıldı");
        setOpen(false);
        reset();
        router.refresh();
      }
    });
  }

  function close(o: boolean) {
    setOpen(o);
    if (!o) reset();
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Yeni ərizə
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Məzuniyyət ərizəsi · Addım {step}/4</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Növ *</Label>
              <select
                value={nov}
                onChange={(e) => setNov(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label} ({t.balance > 0 ? `${t.balance} gün/il` : "limitsiz"})
                  </option>
                ))}
              </select>
            </div>
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
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="baslama">Başlama *</Label>
                <Input id="baslama" type="date" required value={baslama} onChange={(e) => setBaslama(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bitme">Bitmə *</Label>
                <Input id="bitme" type="date" required value={bitme} onChange={(e) => setBitme(e.target.value)} />
              </div>
            </div>
            {days > 0 && (
              <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm">
                Cəmi: <b>{days} gün</b>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sebeb">Səbəb / Qeyd</Label>
              <Input id="sebeb" maxLength={500} value={sebeb} onChange={(e) => setSebeb(e.target.value)} />
            </div>
            {(nov === "xestelik" || nov === "dogum") && (
              <div className="space-y-2">
                <Label htmlFor="fayl_url">Sənəd URL (xəstə qeydiyyatı)</Label>
                <Input id="fayl_url" maxLength={500} value={faylUrl} onChange={(e) => setFaylUrl(e.target.value)} placeholder="https://..." />
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Əvəzləyici işçi</Label>
              <Combobox
                options={employees.filter((e) => e.id !== istifadeciId).map<ComboOption>((e) => ({ value: e.id, label: e.ad_soyad }))}
                value={evezleyici}
                onChange={setEvezleyici}
                placeholder="— Seç (opsional) —"
                searchPlaceholder="Axtar..."
                emptyText="Tapılmadı"
              />
              <p className="text-[11px] text-muted-foreground">Sistem avtomatik konflikt yoxlayır — bu tarixdə əvəzləyici özü məzuniyyətdədirsə xəta verir.</p>
            </div>
            <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs">
              <div><b>Növ:</b> {LEAVE_TYPES.find((t) => t.value === nov)?.label}</div>
              <div><b>Tarix:</b> {baslama} → {bitme} ({days} gün)</div>
              <div><b>İşçi:</b> {employees.find((e) => e.id === istifadeciId)?.ad_soyad ?? "—"}</div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => close(false)} disabled={pending}>İmtina</Button>
          {step > 1 && (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={pending}>
              ← Geri
            </Button>
          )}
          {step < 4 ? (
            <Button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={
                pending ||
                (step === 1 && !istifadeciId) ||
                (step === 2 && (!baslama || !bitme || days <= 0))
              }
            >
              İrəli →
            </Button>
          ) : (
            <Button type="button" onClick={onSubmit} disabled={pending || !istifadeciId || !baslama || !bitme}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yarat
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CalendarView({ rows, month }: { rows: Row[]; month?: string }) {
  const now = new Date();
  let il = now.getFullYear();
  let ay = now.getMonth() + 1;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    if (y && m) {
      il = y;
      ay = m;
    }
  }
  const daysInMonth = new Date(il, ay, 0).getDate();
  const firstDay = new Date(il, ay - 1, 1).getDay();
  const monthStart = new Date(il, ay - 1, 1);
  const monthEnd = new Date(il, ay, 1);

  const dayMap = new Map<number, string[]>();
  for (const r of rows) {
    if (r.status !== "tesdiq") continue;
    const start = new Date(r.baslama);
    const end = new Date(r.bitme);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d >= monthStart && d < monthEnd) {
        const day = d.getDate();
        const arr = dayMap.get(day) ?? [];
        if (!arr.includes(r.istifadeci_ad)) arr.push(r.istifadeci_ad);
        dayMap.set(day, arr);
      }
    }
  }

  const cells: Array<{ day?: number; names: string[] }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ names: [] });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, names: dayMap.get(d) ?? [] });

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {MONTH_LABELS[ay - 1]} {il}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {["B", "Be", "Çə", "Ç", "Ca", "C", "Ş"].map((d) => (
            <div key={d} className="py-1 text-center font-semibold text-muted-foreground">{d}</div>
          ))}
          {cells.map((c, i) => (
            <div
              key={i}
              className={`min-h-[60px] rounded border p-1 ${c.day ? "border-border/40" : "border-transparent"}`}
            >
              {c.day && (
                <>
                  <div className="text-[10px] text-muted-foreground">{c.day}</div>
                  {c.names.slice(0, 3).map((n, idx) => (
                    <div key={idx} className="mt-0.5 truncate rounded bg-info/20 px-1 text-[10px] text-info" title={n}>
                      {n}
                    </div>
                  ))}
                  {c.names.length > 3 && (
                    <div className="text-[10px] text-muted-foreground">+{c.names.length - 3}</div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
