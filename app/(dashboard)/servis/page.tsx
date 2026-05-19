import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Wrench,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  PackageSearch,
  CircleDollarSign,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ServisDialog } from "@/features/servis/components/servis-dialog";
import { ServisTable } from "@/features/servis/components/servis-table";
import { ServisKanban } from "@/features/servis/components/servis-kanban";
import { ViewToggle } from "@/features/servis/components/view-toggle";
import { StatusKpiStrip } from "@/features/servis/components/status-kpi-strip";
import { ServisDetailModalRouter } from "@/features/servis/components/servis-detail-modal";
import {
  getServisRequests,
  getServisStats,
  getFiliallar,
  getTexnikiUsers,
  getMehsulOptionsForServis,
  getMusteriOptionsForServis,
  getMaliyeAccountsForServis,
  getMarkaOptionsForServis,
  getKateqoriyaOptionsForServis,
  getDefektKategoriyalar,
  getServisDashboardWidgets,
  getDailyServisCounts,
  getHourlyHeatmap,
  type ServisListFilter,
} from "@/features/servis/queries";
import { ServisDashboardWidgets } from "@/features/servis/components/dashboard-widgets";
import { DailyServisChart, HourlyHeatmap } from "@/features/servis/components/extra-charts";
import { TechnicianLeaderboard } from "@/features/servis/components/technician-leaderboard";
import { getTechnicianLeaderboard } from "@/features/maliyye/queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Servis" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function pickStr(sp: SP, key: string): string | undefined {
  const v = sp[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

function pickInt(sp: SP, key: string): number | undefined {
  const v = pickStr(sp, key);
  if (v == null || v === "") return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

export default async function ServisPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp: SP = (await searchParams) ?? {};

  // URL → filter
  const filter: ServisListFilter = {};
  const status = pickStr(sp, "status");
  const prioritet = pickStr(sp, "prioritet");
  const iscisi = pickStr(sp, "iscisi");
  const q = pickStr(sp, "q");
  const fromKey = pickStr(sp, "from");
  const to = parseDate(pickStr(sp, "to"));
  const gecikme = pickStr(sp, "gecikme") === "1";
  const ay = pickStr(sp, "ay");
  const odenilmis = pickStr(sp, "odenilmis") === "1";
  const zemanet = pickStr(sp, "zemanet") === "1";
  const filialId = pickInt(sp, "filial");
  const markaId = pickInt(sp, "marka");
  const kateqoriyaId = pickInt(sp, "kateqoriya");

  if (q) filter.q = q;
  if (status === "acig") filter.acig_only = true;
  else if (status) filter.status = status;
  if (prioritet) filter.prioritet = prioritet;
  if (iscisi) filter.iscisi_id = iscisi;
  if (gecikme) filter.gecikme_only = true;
  if (odenilmis) filter.odenilmis_only = true;
  if (zemanet) filter.zemanet_only = true;
  if (filialId != null) filter.filial_id = filialId;
  if (markaId != null) filter.marka_id = markaId;
  if (kateqoriyaId != null) filter.kateqoriya_id = kateqoriyaId;
  if (to) filter.to = to;

  if (fromKey === "7d") {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    filter.from = d;
  } else if (fromKey === "30d") {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    filter.from = d;
  } else {
    const parsed = parseDate(fromKey);
    if (parsed) filter.from = parsed;
  }
  if (ay === "current") {
    filter.from = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  }

  const view = pickStr(sp, "view") === "kanban" ? "kanban" : "list";

  const [rows, stats, filiallar, texniki, mehsullar, musteriler, hesablar, markalar, kateqoriyalar, defektKateq, widgets, daily, heatmap, leaderboard] = await Promise.all([
    getServisRequests(filter),
    getServisStats(),
    getFiliallar(),
    getTexnikiUsers(),
    getMehsulOptionsForServis(),
    getMusteriOptionsForServis(),
    getMaliyeAccountsForServis(),
    getMarkaOptionsForServis(),
    getKateqoriyaOptionsForServis(),
    getDefektKategoriyalar(),
    getServisDashboardWidgets(),
    getDailyServisCounts(),
    getHourlyHeatmap(),
    getTechnicianLeaderboard(30, 10),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Servis</h1>
          <p className="mt-1 text-sm text-muted-foreground">Müştəri servis sifarişləri və status izi.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/servis/problemli-mehsullar"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 text-sm hover:bg-secondary"
          >
            <PackageSearch className="h-3.5 w-3.5" /> Problemli məhsullar
          </Link>
          <Link
            href="/servis/hesabat"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 text-sm hover:bg-secondary"
          >
            <BarChart3 className="h-3.5 w-3.5" /> Hesabat
          </Link>
          <Link
            href="/servis/sla"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 text-sm hover:bg-secondary"
          >
            <AlertTriangle className="h-3.5 w-3.5" /> SLA
          </Link>
          <Link
            href="/servis/zemanet"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 text-sm hover:bg-secondary"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Zəmanətlər
          </Link>
          <ServisDialog
            filiallar={filiallar.map((f) => ({ id: f.id, label: f.ad }))}
            texniki={texniki.map((t) => ({ id: t.id, label: t.ad_soyad }))}
            mehsullar={mehsullar.map((m) => ({ id: m.id, ad: m.ad, kod: m.kod ?? null, barkod: m.barkod ?? null }))}
            musteriler={musteriler.map((m) => ({ id: m.id, ad: m.ad, telefon: m.telefon ?? null }))}
            hesablar={hesablar.map((h) => ({ id: h.id, ad: h.ad, nov: h.nov ?? null }))}
            defektKateq={defektKateq.map((k) => ({
              id: k.id,
              ad: k.ad,
              qrup: k.qrup ?? null,
              default: !!k.default_kateq,
            }))}
          />
        </div>
      </header>

      {/* C1: Yeni dashboard widget strip (KPI-dan əvvəl) */}
      <ServisDashboardWidgets
        cycle_avg={widgets.cycle_avg}
        sla_breach={widgets.sla_breach}
        month_profit={widgets.month_profit}
        rating_avg={widgets.rating_avg}
        rating_count={widgets.rating_count}
      />

      {/* Status mərhələləri — 8 KPI strip (köhnə ERP screenshot-larına uyğun) */}
      <StatusKpiStrip counts={stats.by_status} activeStatus={status ?? undefined} />

      {/* Əlavə alt-bilgilər: gecikmə, gəlir cəmi */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href="/servis?gecikme=1"
          className={`glass block rounded-lg border bg-card/40 p-3 transition hover:border-rose-400/60 ${gecikme ? "ring-1 ring-rose-400/60" : ""}`}
        >
          <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" /> Gecikən
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums text-rose-400">{stats.late}</div>
        </Link>
        <div className="glass rounded-lg border bg-card/40 p-3">
          <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" /> Orta təmir günü
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums">{stats.avg_days}</div>
        </div>
        <Link
          href="/servis?ay=current"
          className={`glass block rounded-lg border bg-card/40 p-3 transition hover:border-emerald-400/60 ${ay === "current" ? "ring-1 ring-emerald-400/60" : ""}`}
        >
          <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            <CircleDollarSign className="h-3.5 w-3.5" /> Bu ay gəlir
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums text-emerald-400">{formatMoney(stats.month_revenue)}</div>
        </Link>
        <Link
          href="/servis?from=7d"
          className={`glass block rounded-lg border bg-card/40 p-3 transition hover:border-sky-400/60 ${fromKey === "7d" ? "ring-1 ring-sky-400/60" : ""}`}
        >
          <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" /> Son 7 gün qəbul
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums">{stats.week_in}</div>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Link href="/servis/problemli-mehsullar" className="block">
          <Card className="glass transition hover:border-primary/30">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-muted-foreground">
                  <PackageSearch className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold">Problemli məhsullar</div>
                  <div className="text-xs text-muted-foreground">Məhsul-əsaslı servis qruplama</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/servis/zemanet" className="block">
          <Card className="glass transition hover:border-primary/30">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold">Zəmanətlər</div>
                  <div className="text-xs text-muted-foreground">Talon idarəetməsi, QR & public view</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/servis/hesabat" className="block">
          <Card className="glass transition hover:border-primary/30">
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold">Bu ay servis hesabatı</div>
                  <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Aktiv: <span className="font-medium text-foreground">{stats.acig}</span></span>
                    <span>Hazır: <span className="font-medium text-success">{stats.hazir}</span></span>
                    <span>Gəlir: <span className="font-medium text-foreground">{formatMoney(stats.month_revenue)}</span></span>
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Cəmi: <span className="font-medium text-foreground">{rows.length}</span> sifariş
        </div>
        <ViewToggle current={view} />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Wrench className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Servis sifarişi tapılmadı</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{`Filtrləri sıfırlayın və ya "Yeni servis qəbul" düyməsi ilə başlayın.`}</p>
        </div>
      ) : view === "kanban" ? (
        <ServisKanban rows={rows} />
      ) : (
        <ServisTable
          rows={rows}
          filiallar={filiallar.map((f) => ({ id: f.id, ad: f.ad }))}
          markalar={markalar.map((m) => ({ id: m.id, ad: m.ad }))}
          kateqoriyalar={kateqoriyalar.map((k) => ({ id: k.id, ad: k.ad }))}
          initial={{
            q: q ?? "",
            status: status ?? "",
            prioritet: prioritet ?? "",
            zemanet,
            gecikme,
            odenilmis,
            filial: filialId != null ? String(filialId) : "",
            marka: markaId != null ? String(markaId) : "",
            kateqoriya: kateqoriyaId != null ? String(kateqoriyaId) : "",
            from: pickStr(sp, "from") ?? "",
            to: pickStr(sp, "to") ?? "",
          }}
        />
      )}

      {/* C2: Daily charts + hourly heatmap */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="glass rounded-lg border border-border bg-card/40 p-3">
          <div className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            Daily qəbul / təhvil (son 30 gün)
          </div>
          <DailyServisChart data={daily} />
        </div>
        <div className="glass overflow-hidden rounded-lg border border-border bg-card/40 p-3">
          <div className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            Saatlıq heatmap (qəbul tezliyi, son 90 gün)
          </div>
          <HourlyHeatmap data={heatmap} />
        </div>
      </div>

      {/* Texnik liderbordu (NEW) */}
      <TechnicianLeaderboard rows={leaderboard} />

      {/* Modal pəncərə — URL `?detail=<id>` parametri ilə açılır */}
      <Suspense fallback={null}>
        <ServisDetailModalRouter />
      </Suspense>
    </div>
  );
}
