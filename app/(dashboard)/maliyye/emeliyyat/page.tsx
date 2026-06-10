import type { Metadata } from "next";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { OperationsTable } from "@/features/maliyye/components/operations-table";
import { QuickOpDialog } from "@/features/maliyye/components/quick-op-dialog";
import { getOperations, getOperationsSummary, type OperationFilter } from "@/features/maliyye/operations-queries";
import { getQuickRefs } from "@/features/maliyye/queries";
import { formatMoney } from "@/lib/utils";
import { RecordStatusFilter } from "@/components/ui/record-status-filter";
import { liteGate } from "@/lib/lite/config";

export const metadata: Metadata = { title: "Maliyyə əməliyyatları" };

type SearchParams = {
  q?: string;
  qrup?: string;
  yon?: string;
  status?: string;
  from?: string;
  to?: string;
  min?: string;
  max?: string;
};

export default async function EmeliyyatPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { requireMaliyyePerm } = await import("@/features/maliyye/access-guard");
  const { icazeler, isOwnerOrAdmin } = await requireMaliyyePerm();
  const canApprove =
    isOwnerOrAdmin || icazeler.includes("fin_op.tesdiq") || icazeler.includes("maliyye.idare");
  const canCancel =
    isOwnerOrAdmin || icazeler.includes("fin_op.legv") || icazeler.includes("fin_op.idare") || icazeler.includes("maliyye.idare");

  const sp = await searchParams;
  const { readRecordStatusFromSearch } = await import("@/lib/soft-delete/record-filter");
  const { filter: recordStatus, canSeeDeleted } = await readRecordStatusFromSearch(
    sp as Record<string, string | string[] | undefined>,
  );
  const filter: OperationFilter = {
    search: sp.q,
    qrup: sp.qrup,
    yon: sp.yon,
    status: sp.status,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
    min: sp.min ? Number(sp.min) : undefined,
    max: sp.max ? Number(sp.max) : undefined,
    recordStatus,
  };

  const [{ items, total }, refs, summary] = await Promise.all([
    getOperations(filter, 1, 100),
    getQuickRefs(),
    getOperationsSummary(filter),
  ]);

  // Quick-range href helper (build URL preserving other params)
  const buildHref = (b?: string, e?: string) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.qrup) params.set("qrup", sp.qrup);
    if (sp.yon) params.set("yon", sp.yon);
    if (sp.status) params.set("status", sp.status);
    if (b) params.set("from", b);
    if (e) params.set("to", e);
    return `/maliyye/emeliyyat${params.toString() ? `?${params.toString()}` : ""}`;
  };

  const today = new Date();
  const ts = (d: Date) => d.toISOString().slice(0, 10);
  const todayStr = ts(today);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const lite = await liteGate("maliyye"); // Lite-da bloklar config-ə görə

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Maliyyə əməliyyatları</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bütün maliyyə hərəkətlərinin vahid jurnalı — satış ödənişi, alış ödənişi, xərc, transfer, komissiya, vergi.
          </p>
        </div>
        <RecordStatusFilter canSeeDeleted={canSeeDeleted} />
      </header>

      <MaliyyeSubNav active="/maliyye/emeliyyat" />

      {/* Filters — 3 row strukturu */}
      <form className="space-y-3 rounded-xl border border-border bg-card/30 p-3">
        {/* Row 1: axtarış + tarix aralığı + quick-range */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
            <input
              type="text"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Qeyd, sənəd, qaimə, müştəri, telefon, VÖEN..."
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm"
            />
          </div>

          <div className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 text-xs">
            <span className="text-muted-foreground">📅</span>
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ""}
              className="h-9 bg-transparent text-sm focus:outline-none"
              aria-label="Başlama tarixi"
            />
            <span className="text-muted-foreground">–</span>
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ""}
              className="h-9 bg-transparent text-sm focus:outline-none"
              aria-label="Bitmə tarixi"
            />
          </div>

          <div className="inline-flex gap-0.5 rounded-md border border-border bg-secondary/40 p-0.5">
            <a
              href={buildHref(todayStr, todayStr)}
              className="inline-flex h-8 items-center rounded px-2 text-[11px] font-semibold hover:bg-background"
            >
              Bu gün
            </a>
            <a
              href={buildHref(ts(weekStart), todayStr)}
              className="inline-flex h-8 items-center rounded px-2 text-[11px] font-semibold hover:bg-background"
            >
              Həftə
            </a>
            <a
              href={buildHref(ts(monthStart), todayStr)}
              className="inline-flex h-8 items-center rounded px-2 text-[11px] font-semibold hover:bg-background"
            >
              Ay
            </a>
          </div>

          <button
            type="submit"
            className="h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
          >
            Filtrlə
          </button>
          {(sp.q || sp.qrup || sp.yon || sp.from || sp.to || sp.min || sp.max) && (
            <a
              href="/maliyye/emeliyyat"
              className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] text-muted-foreground hover:bg-secondary"
              title="Sıfırla"
            >
              ↺ Sıfırla
            </a>
          )}
        </div>

        {/* Row 2: növ pill-ləri (qrup + yön + status) */}
        <div className="space-y-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <span className="min-w-[60px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Qrup</span>
            {[
              { v: "", l: "Hamısı" },
              { v: "satis", l: "Satış" },
              { v: "borc", l: "Borclar" },
              { v: "xerc", l: "Xərclər" },
              { v: "maas", l: "Maaş" },
              { v: "kassa", l: "Kassa/Bank" },
              { v: "transfer", l: "Transfer" },
              { v: "vergi", l: "Vergi" },
              { v: "sahibkar", l: "Sahibkar" },
              { v: "marketplace", l: "Marketplace" },
            ].map((p) => {
              const on = (sp.qrup ?? "") === p.v;
              const href = (() => {
                const params = new URLSearchParams(Object.entries(sp).filter(([, val]) => val) as [string, string][]);
                if (p.v) params.set("qrup", p.v);
                else params.delete("qrup");
                return `/maliyye/emeliyyat${params.toString() ? `?${params.toString()}` : ""}`;
              })();
              return (
                <a
                  key={p.v || "all"}
                  href={href}
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium transition ${
                    on
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {p.l}
                </a>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <span className="min-w-[60px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Yön</span>
            {[
              { v: "", l: "Hamısı" },
              { v: "daxil", l: "Mədaxil" },
              { v: "xaric", l: "Məxaric" },
              { v: "transfer", l: "Transfer" },
              { v: "neutral", l: "Düzəliş" },
            ].map((p) => {
              const on = (sp.yon ?? "") === p.v;
              const href = (() => {
                const params = new URLSearchParams(Object.entries(sp).filter(([, val]) => val) as [string, string][]);
                if (p.v) params.set("yon", p.v);
                else params.delete("yon");
                return `/maliyye/emeliyyat${params.toString() ? `?${params.toString()}` : ""}`;
              })();
              const tone =
                p.v === "daxil"
                  ? on ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600" : ""
                  : p.v === "xaric"
                  ? on ? "border-rose-500/40 bg-rose-500/15 text-rose-600" : ""
                  : on ? "border-primary/40 bg-primary/15 text-primary" : "";
              return (
                <a
                  key={p.v || "all"}
                  href={href}
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium transition ${
                    tone || "border-border bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {p.l}
                </a>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <span className="min-w-[60px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
            {[
              { v: "aktiv", l: "Aktiv" },
              { v: "", l: "Hamısı" },
              { v: "gozleyen_tesdiq", l: "Təsdiq gözləyir" },
              { v: "legv", l: "Ləğv" },
              { v: "redd", l: "Rədd" },
            ].map((p) => {
              const cur = sp.status ?? "aktiv";
              const on = cur === p.v;
              const href = (() => {
                const params = new URLSearchParams(Object.entries(sp).filter(([, val]) => val) as [string, string][]);
                if (p.v) params.set("status", p.v);
                else params.delete("status");
                return `/maliyye/emeliyyat${params.toString() ? `?${params.toString()}` : ""}`;
              })();
              return (
                <a
                  key={p.v || "all"}
                  href={href}
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium transition ${
                    on
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {p.l}
                </a>
              );
            })}
          </div>
        </div>

        {/* Row 3: məbləğ aralığı */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Məbləğ aralığı (AZN)</span>
          <input
            type="number"
            step="0.01"
            name="min"
            defaultValue={sp.min ?? ""}
            placeholder="Min"
            className="h-8 w-28 rounded-md border border-input bg-background px-2 text-sm"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number"
            step="0.01"
            name="max"
            defaultValue={sp.max ?? ""}
            placeholder="Max"
            className="h-8 w-28 rounded-md border border-input bg-background px-2 text-sm"
          />
        </div>
      </form>

      {/* Stat pills (Lite: ozet bloku) */}
      {lite("ozet") && (
        <section className="grid grid-cols-2 gap-0 rounded-xl border-y border-border bg-card/30 md:grid-cols-4">
          <Pill label="Cəmi əməliyyat" value={String(summary.cemi)} />
          <Pill label="Mədaxil" value={`+${formatMoney(summary.daxil)}`} tone="success" />
          <Pill label="Məxaric" value={`−${formatMoney(summary.xaric)}`} tone="danger" />
          <Pill label="Net" value={`${summary.net >= 0 ? "+" : "−"}${formatMoney(Math.abs(summary.net))}`} tone={summary.net >= 0 ? "info" : "danger"} />
        </section>
      )}

      <OperationsTable items={items} total={total} canApprove={canApprove} canCancel={canCancel} />

      <QuickOpDialog
        hesablar={refs.hesablar}
        iscilier={refs.iscilier}
        kontragentler={refs.kontragentler}
      />
    </div>
  );
}

function Pill({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "success" | "danger" | "warning" | "info" | "neutral" }) {
  const cls =
    tone === "success" ? "text-success" :
    tone === "danger" ? "text-danger" :
    tone === "warning" ? "text-warning" :
    tone === "info" ? "text-info" : "";
  return (
    <div className="border-r border-border/40 px-4 py-3 last:border-r-0">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
