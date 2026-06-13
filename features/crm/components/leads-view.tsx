"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Phone, Mail, CalendarClock, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LeadCardItem } from "./lead-card";
import { LeadRowActions } from "./lead-row-actions";
import { LeadStatusBadge, LeadPriorityBadge } from "./lead-status-badge";
import { changeLeadStage } from "../actions";
import { bulkChangeLeadStage } from "../leadler-actions";
import { LEAD_STAGES, LEAD_PRIORITY, LEAD_SOURCES, type LeadCard, type LeadListRow, type LeadStatus } from "../types";
import { cn, formatMoney, formatDate } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { az } from "date-fns/locale";

type UserOption = { id: string; ad_soyad: string };

type Props = {
  stages: Record<LeadStatus, LeadCard[]>;
  listRows: LeadListRow[];
  users: UserOption[];
  canEdit?: boolean;
  canConvert?: boolean;
  canDelete?: boolean;
};

export function LeadsView({
  stages,
  listRows,
  users,
  canEdit = false,
  canConvert = false,
  canDelete = false,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const view = (sp.get("view") as "kanban" | "list") || "kanban";

  const menecer = sp.get("menecer") ?? "";
  const menbe = sp.get("menbe") ?? "";
  const statusSel = sp.get("status") ?? "";
  const tarixDan = sp.get("tarix_dan") ?? "";
  const tarixaDek = sp.get("tarixa_dek") ?? "";
  const q = sp.get("q") ?? "";
  const hasFilter = !!(q || menecer || menbe || statusSel || tarixDan || tarixaDek);

  function setQueryParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/crm/leadler?${params.toString()}`);
  }

  function resetFilters() {
    const params = new URLSearchParams();
    // Yalnız görünüş rejimini saxla, qalan filtrləri sıfırla
    if (view) params.set("view", view);
    router.push(`/crm/leadler?${params.toString()}`);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-secondary/30 p-0.5">
          <button
            type="button"
            onClick={() => setQueryParam("view", "kanban")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition",
              view === "kanban" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
          </button>
          <button
            type="button"
            onClick={() => setQueryParam("view", "list")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition",
              view === "list" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"
            )}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
        </div>

        <Input
          placeholder="Axtarış: ad, telefon, email..."
          defaultValue={q}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setQueryParam("q", (e.target as HTMLInputElement).value);
            }
          }}
          className="h-8 w-full max-w-[260px]"
        />

        <select
          value={menecer}
          onChange={(e) => setQueryParam("menecer", e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">Bütün məsullar</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.ad_soyad}
            </option>
          ))}
        </select>

        <select
          value={menbe}
          onChange={(e) => setQueryParam("menbe", e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">Bütün mənbələr</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {view === "list" && (
          <select
            value={statusSel}
            onChange={(e) => setQueryParam("status", e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">Bütün statuslar</option>
            {LEAD_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}

        {/* Tarix aralığı — yaradılma tarixinə görə (yaradildi) */}
        <div className="inline-flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="date"
            value={tarixDan}
            max={tarixaDek || undefined}
            onChange={(e) => setQueryParam("tarix_dan", e.target.value)}
            aria-label="Tarixdən"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <input
            type="date"
            value={tarixaDek}
            min={tarixDan || undefined}
            onChange={(e) => setQueryParam("tarixa_dek", e.target.value)}
            aria-label="Tarixə dək"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground"
          />
        </div>

        {hasFilter && (
          <Button size="sm" variant="ghost" onClick={resetFilters} className="ml-auto h-8">
            <X className="h-3.5 w-3.5" /> Sıfırla
          </Button>
        )}
      </div>

      {view === "kanban" ? (
        <KanbanView stages={stages} />
      ) : (
        <ListView rows={listRows} canEdit={canEdit} canConvert={canConvert} canDelete={canDelete} />
      )}
    </>
  );
}

function KanbanView({ stages }: { stages: Record<LeadStatus, LeadCard[]> }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {LEAD_STAGES.map((stage) => {
        const items = stages[stage.value] ?? [];
        const totalValue = items.reduce((s, l) => s + l.budce, 0);
        return (
          <div key={stage.value} className={cn("rounded-xl border p-2", stage.cls)}>
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider">{stage.label}</h3>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-medium">{items.length}</span>
            </div>
            {totalValue > 0 && (
              <div className="mb-2 px-1 text-[10px] text-muted-foreground">{formatMoney(totalValue)}</div>
            )}
            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/40 py-6 text-center text-[10.5px] text-muted-foreground">
                  Boşdur
                </div>
              ) : (
                items.map((lead) => <LeadCardItem key={lead.id} lead={lead} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({
  rows,
  canEdit,
  canConvert,
  canDelete,
}: {
  rows: LeadListRow[];
  canEdit: boolean;
  canConvert: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<LeadStatus | "">("");
  const [bulkReason, setBulkReason] = useState("");

  const allSelected = useMemo(() => rows.length > 0 && rows.every((r) => selected.has(r.id)), [rows, selected]);
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }
  function toggleOne(id: string) {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  }
  function clear() { setSelected(new Set()); }

  function moveStage(id: string, s: LeadStatus) {
    startTransition(async () => {
      const res = await changeLeadStage(id, s);
      if (res.ok) toast.success("Mərhələ dəyişdi");
      else toast.error("Alınmadı");
    });
  }

  function doBulk() {
    if (!bulkStatus) {
      toast.error("Status seçin");
      return;
    }
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (bulkStatus === "itirdi" && !bulkReason.trim()) {
      toast.error("İtirildi statusu üçün səbəb daxil edin");
      return;
    }
    startTransition(async () => {
      const res = await bulkChangeLeadStage(ids, bulkStatus, bulkReason.trim() || undefined);
      if (res.ok) {
        toast.success(`${res.count} lead-in statusu dəyişdi`);
        clear();
        setBulkStatus("");
        setBulkReason("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        Lead tapılmadı
      </div>
    );
  }
  return (
    <div className={cn("rounded-xl border border-border overflow-x-auto", pending && "opacity-60")}>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-secondary/30 px-3 py-2">
          <span className="text-xs font-semibold">{selected.size} seçilib</span>
          <Button size="sm" variant="ghost" onClick={clear}><X className="h-3.5 w-3.5" /></Button>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as LeadStatus)}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">Yeni status seç...</option>
            {LEAD_STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {bulkStatus === "itirdi" && (
            <Input
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder="İtirilmə səbəbi..."
              className="h-7 w-44 text-xs"
            />
          )}
          <Button size="sm" onClick={doBulk} disabled={pending || !bulkStatus}>
            Dəyişdir
          </Button>
        </div>
      )}
      <table className="w-full text-xs">
        <thead className="bg-secondary/40">
          <tr className="text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
            <th className="w-8 px-2 py-2">
              <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={allSelected} onChange={toggleAll} />
            </th>
            <th className="px-3 py-2">Ad</th>
            <th className="px-3 py-2">Əlaqə</th>
            <th className="px-3 py-2">Mənbə</th>
            <th className="px-3 py-2">Məsul</th>
            <th className="px-3 py-2">Prioritet</th>
            <th className="px-3 py-2 text-right">Büdcə</th>
            <th className="px-3 py-2 text-right">%</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Növbəti</th>
            <th className="px-3 py-2 text-right">Tarix</th>
            <th className="px-3 py-2 text-right w-12">Əməl</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((r) => {
            const isCancelled = r.status === "itirdi";
            return (
            <tr
              key={r.id}
              className={`hover:bg-secondary/30 ${
                isCancelled
                  ? "bg-destructive/[0.04] text-muted-foreground line-through decoration-destructive/40"
                  : ""
              }`}
            >
              <td className="w-8 px-2 py-2">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={selected.has(r.id)}
                  onChange={() => toggleOne(r.id)}
                />
              </td>
              <td className="px-3 py-2 font-medium">{r.ad}</td>
              <td className="px-3 py-2">
                {r.telefon && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-2.5 w-2.5" /> <span>{r.telefon}</span>
                  </div>
                )}
                {r.email && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-2.5 w-2.5" /> <span className="truncate max-w-[160px]">{r.email}</span>
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{r.menbe ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.menecer_ad ?? "—"}</td>
              <td className="px-3 py-2">
                <LeadPriorityBadge value={r.prioritet} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{r.budce > 0 ? formatMoney(r.budce) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.ehtimal}%</td>
              <td className="px-3 py-2">
                <select
                  value={r.status}
                  onChange={(e) => moveStage(r.id, e.target.value as LeadStatus)}
                  className="rounded-md border border-input bg-background px-2 py-0.5 text-[10.5px]"
                  disabled={pending}
                >
                  {LEAD_STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.novbeti_elaqe ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-2.5 w-2.5" />
                    {formatDistanceToNow(r.novbeti_elaqe, { addSuffix: true, locale: az })}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground">{r.yaradildi ? formatDate(r.yaradildi) : "—"}</td>
              <td className="px-3 py-2 text-right no-underline [text-decoration:none]">
                <LeadRowActions
                  lead={r as unknown as LeadCard}
                  canEdit={canEdit}
                  canConvert={canConvert}
                  canDelete={canDelete}
                />
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
