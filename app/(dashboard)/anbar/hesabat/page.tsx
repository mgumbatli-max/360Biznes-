import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, FileSpreadsheet, Layers, Clock, AlertCircle } from "lucide-react";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { ProductInline } from "@/features/anbar/components/product-inline";
import { BarcodeFix, CostFix, SalePriceFix, ImageFix } from "@/features/anbar/components/quick-fix-cells";
import {
  getCategoryReport,
  getAgingReport,
  getProblemReport,
  type ProblemKind,
  type ProblemFilter,
} from "@/features/anbar/hesabat/queries";
import { getCategoryOptions, getBrandOptions } from "@/features/anbar/queries";
import { ProblemFilters } from "@/features/anbar/hesabat/components/problem-filters";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Anbar hesabatları" };

type SP = {
  mod?: string;
  problem?: string;
  q?: string;
  kateq?: string;
  marka?: string;
  sirala?: string;
};

type ModeOpt = { value: string; label: string };

const PRIMARY_MODES: ModeOpt[] = [
  { value: "kateq",         label: "Kateqoriya üzrə" },
  { value: "aging",         label: "Yaşlanma" },
];

const CHIP_GROUPS: { key: string; label: string; icon: typeof Layers; chips: ModeOpt[] }[] = [
  {
    key: "veziyyet",
    label: "Stok vəziyyəti",
    icon: Layers,
    chips: [
      { value: "stokda",  label: "Stokda" },
      { value: "stoksuz", label: "Stok yoxdur" },
      { value: "az_stok", label: "Az stok" },
      { value: "kritik",  label: "Kritik" },
    ],
  },
  {
    key: "yaslanma",
    label: "Yaşlanma və ölü stok",
    icon: Clock,
    chips: [
      { value: "satilmayan_60", label: "60+ gün satılmır" },
      { value: "olu_stok",      label: "Ölü stok (90+ gün)" },
    ],
  },
  {
    key: "saglamliq",
    label: "Data sağlamlığı",
    icon: AlertCircle,
    chips: [
      { value: "sekilsiz",  label: "Şəkilsiz" },
      { value: "barkodsuz", label: "Barkodsuz" },
      { value: "mayasiz",   label: "Mayasız" },
      { value: "qiymetsiz", label: "Qiymətsiz" },
    ],
  },
];

export default async function HesabatPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { requireAnbarPerm } = await import("@/features/anbar/access-guard");
  await requireAnbarPerm("anbar.hesabat");

  const sp = await searchParams;
  const mod = sp.mod ?? sp.problem ?? "kateq";
  const isProblem = mod !== "kateq" && mod !== "aging";
  const kateqId = sp.kateq ? Number(sp.kateq) : undefined;
  const markaId = sp.marka ? Number(sp.marka) : undefined;
  const problemFilter: ProblemFilter = {
    q: sp.q,
    kateqId: Number.isFinite(kateqId) ? kateqId : undefined,
    markaId: Number.isFinite(markaId) ? markaId : undefined,
    sirala: (sp.sirala as ProblemFilter["sirala"]) ?? "",
  };

  return (
    <div className="mx-auto max-w-7xl">
      <AnbarSubNav active="/anbar/hesabat" />
      <div className="space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart3 className="h-6 w-6 text-primary" />
            Anbar hesabatları
          </h1>
          <a
            href={`/api/anbar/hesabat/export?mod=${mod}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}${sp.kateq ? `&kateq=${sp.kateq}` : ""}${sp.marka ? `&marka=${sp.marka}` : ""}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel ixrac
          </a>
        </header>

        {/* Primary tabs (overall views) */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-secondary/40 p-1">
          {PRIMARY_MODES.map((m) => {
            const isOn = mod === m.value;
            return (
              <Link
                key={m.value}
                href={`/anbar/hesabat?mod=${m.value}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isOn ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </div>

        {/* Filter chip groups */}
        <div className="space-y-2">
          {CHIP_GROUPS.map((g) => (
            <div key={g.key} className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[140px]">
                <g.icon className="h-3 w-3" /> {g.label}
              </span>
              {g.chips.map((c) => {
                const isOn = mod === c.value;
                return (
                  <Link
                    key={c.value}
                    href={`/anbar/hesabat?mod=${c.value}`}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      isOn
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {c.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {isProblem && <ProblemFiltersWrapper mod={mod} />}

        {mod === "kateq" && <CategoryView />}
        {mod === "aging" && <AgingView />}
        {isProblem && <ProblemView tip={mod as ProblemKind} filter={problemFilter} />}
      </div>
    </div>
  );
}

async function ProblemFiltersWrapper({ mod }: { mod: string }) {
  const [categories, brands] = await Promise.all([getCategoryOptions(), getBrandOptions()]);
  return <ProblemFilters mod={mod} categories={categories} brands={brands} />;
}

async function CategoryView() {
  const rows = await getCategoryReport();
  if (rows.length === 0) {
    return <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">Məlumat yoxdur</div>;
  }
  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
      <table className="w-full text-sm" data-sticky-head>
        <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Kateqoriya</th>
            <th className="px-3 py-2 text-right">Məhsul</th>
            <th className="px-3 py-2 text-right">Stok</th>
            <th className="px-3 py-2 text-right">Satış dəyəri</th>
            <th className="px-3 py-2 text-right">Maya dəyəri</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((k) => (
            <tr key={k.id} className="border-b border-border/20 hover:bg-secondary/30">
              <td className="px-3 py-2 font-semibold">{k.ad}</td>
              <td className="px-3 py-2 text-right tabular-nums">{k.mehsul_say}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNumber(k.stok, 0)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-success">{formatNumber(k.satis_deyer, 0)}₼</td>
              <td className="px-3 py-2 text-right tabular-nums text-info">{formatNumber(k.maya_deyer, 0)}₼</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function AgingView() {
  const r = await getAgingReport();
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AgeCard label="Son 30 gün" value={r.son_30} tone="success" />
        <AgeCard label="30-60 gün" value={r.yaslanmis_30_60} />
        <AgeCard label="60-90 gün" value={r.yaslanmis_60_90} tone="warning" />
        <AgeCard label="90+ gün (ölü stok)" value={r.yaslanmis_90} tone="danger" />
      </div>
      <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm">
        ⚠️ Ölü stokda dondurulmuş maya: <strong className="text-danger">{formatNumber(r.olu_maya, 0)}₼</strong>
      </div>
    </div>
  );
}

function AgeCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "danger" }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-2 text-3xl font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

async function ProblemView({ tip, filter }: { tip: ProblemKind; filter: ProblemFilter }) {
  const rows = await getProblemReport(tip, filter);
  if (rows.length === 0) {
    return <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">Bu kateqoriyada məhsul yoxdur</div>;
  }
  const yas = tip === "satilmayan_60" || tip === "olu_stok";
  const azKritik = tip === "az_stok" || tip === "kritik";
  const cemiMaya = rows.reduce((s, x) => s + x.dondurulan_maya, 0);
  const cemiStok = rows.reduce((s, x) => s + x.stok, 0);
  // problem fix sütununu yalnız relevant tip-lərdə göstər
  const fixCol = tip === "sekilsiz" || tip === "barkodsuz" || tip === "mayasiz" || tip === "qiymetsiz";

  return (
    <div>
      <div className={`mb-3 flex flex-wrap gap-4 rounded-xl border p-3 text-sm ${yas ? "border-danger/30 bg-danger/5" : "border-border bg-card/40"}`}>
        <div>Məhsul: <strong>{rows.length}</strong></div>
        {tip !== "stoksuz" && <div>Cəmi stok: <strong>{formatNumber(cemiStok, 0)} ədəd</strong></div>}
        <div>{yas ? "Dondurulmuş maya:" : "Maya dəyəri:"} <strong className={yas ? "text-danger" : ""}>{formatNumber(cemiMaya, 0)}₼</strong></div>
      </div>

      <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
        <div className="overflow-x-auto" data-table-scroll>
          <table className="w-full text-sm" data-sticky-head>
            <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Məhsul</th>
                <th className="px-3 py-2">Marka</th>
                <th className="px-3 py-2 text-right">Stok</th>
                {yas && <><th className="px-3 py-2 text-right">Son satış</th><th className="px-3 py-2 text-right">Gün</th></>}
                {azKritik && <th className="px-3 py-2 text-right">Min/Kritik</th>}
                <th className="px-3 py-2 text-right">Maya (₼)</th>
                <th className="px-3 py-2 text-right">Satış (₼)</th>
                {fixCol && <th className="px-3 py-2 text-center">Düzəliş</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-border/20 hover:bg-secondary/30">
                  <td className="px-3 py-2">
                    <ProductInline
                      id={m.id}
                      ad={m.ad}
                      kod={m.kod ?? null}
                      barkod={m.barkod ?? null}
                      sekil_url={m.sekil_url ?? null}
                      size="xs"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs">{m.marka ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(m.stok, 0)}</td>
                  {yas && (
                    <>
                      <td className="px-3 py-2 text-right text-xs">{m.son_satis ? formatDate(m.son_satis) : <span className="text-muted-foreground">heç vaxt</span>}</td>
                      <td className="px-3 py-2 text-right">
                        {m.gun_evvel != null ? <span className="font-bold text-danger">{m.gun_evvel} gün</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                    </>
                  )}
                  {azKritik && <td className="px-3 py-2 text-right text-warning font-semibold">{m.kritik_stok ?? m.min_stok ?? "—"}</td>}
                  <td className={`px-3 py-2 text-right tabular-nums ${yas ? "text-danger" : ""}`}>{formatNumber(m.dondurulan_maya, 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.satis_qiymeti != null ? formatNumber(m.satis_qiymeti, 0) + "₼" : "—"}</td>
                  {fixCol && (
                    <td className="px-3 py-2 text-center">
                      {tip === "sekilsiz" && (
                        <ImageFix id={m.id} productName={m.ad} current={m.sekil_url ?? null} />
                      )}
                      {tip === "barkodsuz" && (
                        <BarcodeFix id={m.id} current={m.barkod ?? null} compact />
                      )}
                      {tip === "mayasiz" && (
                        <CostFix id={m.id} current={0} />
                      )}
                      {tip === "qiymetsiz" && (
                        <SalePriceFix id={m.id} current={0} />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {rows.length} məhsul tapıldı{rows.length >= 1000 ? " (ilk 1000 göstərilir)" : ""}
      </div>
    </div>
  );
}
