import type { Metadata } from "next";
import Link from "next/link";
import {
  ClipboardList,
  Send,
  CheckCircle2,
  XCircle,
  Pencil,
  Sparkles,
  Search,
  FileSpreadsheet,
  Package,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CreateProposalButton } from "@/features/satinalma/components/create-proposal-button";
import { PlanningTable } from "@/features/satinalma/components/planning-table";
import { AnbarSubNav } from "@/components/anbar-subnav";
import {
  getProposals,
  getProposalStats,
  getPlanningTable,
} from "@/features/satinalma/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Satınalma Planlama" };

type SearchParams = Promise<{ tab?: string; status?: string; search?: string }>;

const STATUS_BADGES: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: "Draft", cls: "text-muted-foreground border-border", icon: Pencil },
  gonderildi: { label: "Göndərildi", cls: "text-primary border-primary/40 bg-primary/5", icon: Send },
  tesdiq: { label: "Təsdiqləndi", cls: "text-emerald-600 border-emerald-500/40 bg-emerald-500/5", icon: CheckCircle2 },
  redd: { label: "Rədd", cls: "text-rose-500 border-rose-500/40 bg-rose-500/5", icon: XCircle },
  legv: { label: "Ləğv", cls: "text-muted-foreground border-border", icon: XCircle },
};

function fmtMoney(n: { toNumber(): number } | number | null | undefined) {
  const num = n == null ? 0 : typeof n === "number" ? n : n.toNumber();
  return new Intl.NumberFormat("az-AZ", { maximumFractionDigits: 2 }).format(num) + " ₼";
}

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("az-AZ", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export default async function SatinalmaPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab = sp.tab ?? "planlama";

  const [planningRows, proposals, stats] = await Promise.all([
    tab === "planlama" ? getPlanningTable() : Promise.resolve([]),
    getProposals({ status: sp.status, search: sp.search }),
    getProposalStats(),
  ]);

  // Quick stats from planning
  const bitib = planningRows.filter((r) => r.durum === "bitib").length;
  const kritik = planningRows.filter((r) => r.durum === "kritik").length;
  const azalir = planningRows.filter((r) => r.durum === "azalir").length;
  const donmus = planningRows.filter((r) => r.durum === "donmus").length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <AnbarSubNav active="/anbar/satinalma" />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Satınalma Planlama</h1>
            <p className="text-sm text-muted-foreground">
              AI tövsiyəsi ilə alış planı · təkliflər · alış qaiməsinə çevirmə
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CreateProposalButton />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Bitib" value={bitib} tone="rose" icon={Package} />
        <Stat label="Kritik" value={kritik} tone="rose" icon={Package} />
        <Stat label="Az qalır" value={azalir} tone="amber" icon={Package} />
        <Stat label="Donmuş" value={donmus} tone="muted" icon={Package} />
        <Stat label="Göndərilən təklif" value={stats.gonderildi} tone="primary" icon={Send} />
        <Stat label="Təsdiqlənən" value={stats.tesdiq} tone="emerald" icon={CheckCircle2} />
      </div>

      {/* Tabs */}
      <nav className="flex items-center gap-1 border-b border-border/40">
        <TabLink
          href="?tab=planlama"
          active={tab === "planlama"}
          icon={Sparkles}
          label="Planlama"
          desc="AI tövsiyəsi"
          count={bitib + kritik + azalir}
        />
        <TabLink
          href="?tab=teklifler"
          active={tab === "teklifler"}
          icon={ClipboardList}
          label="Təkliflər"
          desc={`${proposals.length} təklif`}
          count={stats.draft + stats.gonderildi}
        />
      </nav>

      {tab === "planlama" ? (
        <>
          <Card className="glass border-primary/30 bg-primary/5">
            <CardContent className="py-3">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="text-sm">
                  <p className="font-semibold">Necə işləyir?</p>
                  <p className="text-xs text-muted-foreground">
                    AI bütün məhsullarınızı analiz edir — stok, son satış, sürət. Aşağıdakı cədvəldən{" "}
                    <strong>quş işarəsi</strong> ilə seçim et, miqdarı dəyiş, <strong>«Seçilmişdən alış yarat»</strong>{" "}
                    düyməsi ilə bir kliklə təklif yarat. Təsdiqdən sonra alış qaiməsinə çevrilir.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <PlanningTable rows={planningRows} />
        </>
      ) : (
        <ProposalsListView proposals={proposals} sp={sp} />
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  icon: Icon,
  label,
  desc,
  count,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition",
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      <div className="flex flex-col items-start">
        <span>{label}</span>
        <span className="text-[10px] text-muted-foreground">{desc}</span>
      </div>
      {count > 0 && (
        <Badge variant="outline" className="text-[9px]">{count}</Badge>
      )}
    </Link>
  );
}

function ProposalsListView({
  proposals,
  sp,
}: {
  proposals: Awaited<ReturnType<typeof getProposals>>;
  sp: { status?: string; search?: string };
}) {
  return (
    <>
      <Card className="glass">
        <CardContent className="py-2">
          <form className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input name="search" defaultValue={sp.search ?? ""} placeholder="Kod və ya ad..." className="h-9 pl-8" />
              <input type="hidden" name="tab" value="teklifler" />
            </div>
            <select
              name="status"
              defaultValue={sp.status ?? ""}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Bütün statuslar</option>
              <option value="draft">Draft</option>
              <option value="gonderildi">Göndərildi</option>
              <option value="tesdiq">Təsdiqləndi</option>
              <option value="redd">Rədd</option>
              <option value="legv">Ləğv</option>
            </select>
            <button type="submit" className="h-9 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90">
              Süz
            </button>
            <Link href="/anbar/satinalma?tab=teklifler" className="h-9 rounded-md border border-border bg-secondary px-3 py-2 text-xs hover:bg-secondary/70">
              Sıfırla
            </Link>
          </form>
        </CardContent>
      </Card>

      {proposals.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <h3 className="mt-3 font-semibold">Təklif yoxdur</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              «Planlama» tab-dan AI tövsiyə əsasında və ya «+ Yeni təklif» düyməsi ilə manual yarad.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Link
                href="?tab=planlama"
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                <Sparkles className="h-3.5 w-3.5" /> Planlamaya keç
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="p-0">
            <div className="overflow-x-auto" data-table-scroll>
              <table className="w-full text-sm" data-sticky-head>
                <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/40 text-left">
                    <th className="px-3 py-2">Kod</th>
                    <th className="px-3 py-2">Ad</th>
                    <th className="px-3 py-2">Yaradan</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Sətir</th>
                    <th className="px-3 py-2 text-right">Cəmi məbləğ</th>
                    <th className="px-3 py-2 text-right">Mənfəət</th>
                    <th className="px-3 py-2">Tarix</th>
                    <th className="px-3 py-2 w-10">Excel</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p) => {
                    const st = STATUS_BADGES[p.status] ?? STATUS_BADGES.draft;
                    const Icon = st.icon;
                    const cm = p.cemi_meblegh ? (typeof p.cemi_meblegh === "number" ? p.cemi_meblegh : p.cemi_meblegh.toNumber()) : 0;
                    const cma = p.cemi_maya ? (typeof p.cemi_maya === "number" ? p.cemi_maya : p.cemi_maya.toNumber()) : 0;
                    const mənfeet = cm - cma;
                    return (
                      <tr key={p.id} className="border-b border-border/20 transition hover:bg-secondary/30">
                        <td className="px-3 py-2">
                          <Link href={`/anbar/satinalma/${p.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                            {p.kod}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-sm font-semibold">{p.ad ?? <span className="text-muted-foreground">(adsız)</span>}</div>
                          {p.filial && <div className="text-[11px] text-muted-foreground">{p.filial.ad}</div>}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {p.yaradan?.ad_soyad ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={cn("gap-1 text-[10px]", st.cls)}>
                            <Icon className="h-3 w-3" />
                            {st.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">{p._count.satirlar}</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">{fmtMoney(p.cemi_meblegh)}</td>
                        <td className={cn("px-3 py-2 text-right text-xs font-semibold tabular-nums", mənfeet < 0 ? "text-rose-500" : "text-emerald-600")}>
                          {fmtMoney(mənfeet)}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(p.yaradildi)}</td>
                        <td className="px-3 py-2">
                          <a
                            href={`/api/satinalma/export/${p.id}`}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[10.5px] font-semibold text-emerald-600 hover:bg-emerald-500/20"
                          >
                            <FileSpreadsheet className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: number;
  tone?: "default" | "primary" | "rose" | "amber" | "emerald" | "muted";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const cls =
    tone === "primary"
      ? "text-primary"
      : tone === "rose"
      ? "text-rose-500"
      : tone === "amber"
      ? "text-amber-500"
      : tone === "emerald"
      ? "text-emerald-500"
      : tone === "muted"
      ? "text-muted-foreground"
      : "text-foreground";
  return (
    <div className="glass flex items-center gap-2 rounded-xl border border-border/40 px-3 py-2">
      <Icon className={cn("h-4 w-4 shrink-0", cls)} />
      <div className="min-w-0">
        <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-xl font-bold tabular-nums ${cls}`}>{value}</div>
      </div>
    </div>
  );
}
