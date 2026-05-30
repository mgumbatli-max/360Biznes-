import type { Metadata } from "next";
import { Receipt, AlertTriangle } from "lucide-react";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { XercQaimeLinkDialog } from "@/features/maliyye/components/xerc-qaime-link-dialog";
import { ExpensesTable } from "@/features/maliyye/components/expenses-table";
import {
  getExpenses,
  getExpenseCategories,
  getExpenseCategoryUsage,
  getRecentPurchases,
} from "@/features/maliyye/queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Xərclər" };

type SearchParams = { link?: string };

export default async function XerclerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const link = sp.link ?? "";
  const [{ items, total }, categories, usage, purchases] = await Promise.all([
    getExpenses({}),
    getExpenseCategories(),
    getExpenseCategoryUsage(),
    getRecentPurchases(90, 200),
  ]);

  // Filter for INVOICE-linked vs free expenses
  const isLinked = (qeyd: string | null) => !!qeyd && /\[INVOICE:[^\]]+\]/.test(qeyd);
  const filtered =
    link === "yes"
      ? items.filter((e) => isLinked(e.qeyd))
      : link === "no"
        ? items.filter((e) => !isLinked(e.qeyd))
        : items;
  const totalFiltered = filtered.length;

  const haveUsage = usage.some((u) => u.istifade > 0 || (u.budce ?? 0) > 0);
  const topUsage = Math.max(1, ...usage.map((u) => u.istifade));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Xərclər</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bütün əməliyyat xərcləri kateqoriya üzrə.
          </p>
        </div>
        <XercQaimeLinkDialog
          categories={categories.map((c) => ({ id: c.id, ad: c.ad }))}
          purchases={purchases}
        />
      </header>

      <MaliyyeSubNav active="/maliyye/xercler" />

      {/* Linked-invoice filter */}
      <form className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card/30 p-2">
        <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
          Qaimə bağı:
        </span>
        <select
          name="link"
          defaultValue={link}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">Hamısı</option>
          <option value="yes">Yalnız qaiməyə bağlı</option>
          <option value="no">Yalnız sərbəst xərclər</option>
        </select>
        <button
          type="submit"
          className="h-8 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground"
        >
          Filtrlə
        </button>
      </form>

      {/* Kateqoriya kartları + büdcə bar */}
      {haveUsage && (
        <section
          data-section="kateqoriya-budce"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
        >
          {usage.map((u) => {
            const barPct = u.budce && u.budce > 0
              ? Math.min(100, u.faiz)
              : Math.min(100, (u.istifade / topUsage) * 100);
            const overPct = u.budce && u.faiz > 100 ? Math.min(50, u.faiz - 100) : 0;
            const tone = u.asib
              ? "border-danger/40 bg-danger/5"
              : u.faiz >= 80
                ? "border-warning/30 bg-warning/5"
                : "border-border bg-card/40";
            const barColor = u.asib
              ? "bg-danger"
              : u.faiz >= 80
                ? "bg-warning"
                : "bg-success";
            return (
              <div
                key={u.id}
                className={`rounded-xl border ${tone} p-3 transition hover:shadow-sm`}
                data-budget-card={u.id}
                data-over-budget={u.asib ? "1" : "0"}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="h-6 w-6 shrink-0 rounded-md text-[10px] font-bold uppercase grid place-items-center text-white"
                    style={{ background: u.reng ?? "#64748b" }}
                  >
                    {u.ad.slice(0, 2)}
                  </div>
                  {u.asib && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-danger/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-danger">
                      <AlertTriangle className="h-2.5 w-2.5" /> Aşıb
                    </span>
                  )}
                </div>
                <div className="mt-1.5 line-clamp-1 text-xs font-semibold" title={u.ad}>{u.ad}</div>
                <div className="mt-1 tabular-nums">
                  <span className={`text-base font-bold ${u.asib ? "text-danger" : ""}`}>{formatMoney(u.istifade)}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                  {u.budce != null
                    ? <>Büdcə {formatMoney(u.budce)} • {u.faiz.toFixed(0)}%</>
                    : <>Bu ay xərc</>}
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
                  <div className={`h-full ${barColor} transition-all`} style={{ width: `${barPct}%` }} />
                  {overPct > 0 && (
                    <div className="-mt-1.5 h-1.5 bg-danger/60" style={{ width: `${overPct}%`, marginLeft: "100%" }} />
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
            <Receipt className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">
            {items.length === 0 ? "Xərc qeydi yoxdur" : "Filterə uyğun xərc yoxdur"}
          </h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {categories.length === 0
              ? "Əvvəlcə xərc kateqoriyası yaradın (Ayarlar)."
              : "Yuxarıdakı 'Yeni xərc' düyməsi ilə başlayın."}
          </p>
        </div>
      ) : (
        <ExpensesTable items={filtered} total={totalFiltered === total ? total : totalFiltered} />
      )}
    </div>
  );
}
