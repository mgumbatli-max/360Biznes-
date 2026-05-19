import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, TrendingUp, AlertTriangle, ClipboardCheck, Briefcase, Users, Coins,
  Search, Filter, Download, Info, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { getKpiDashboard, type SortKey, type SortDir } from "@/features/iscilier/kpi-dashboard-queries";
import { KpiDashboardTable } from "@/features/iscilier/components/kpi-dashboard-table";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "KPI Dashboard" };
export const dynamic = "force-dynamic";

const MONTH_LABELS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun",
  "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];

type SP = {
  month?: string;
  search?: string;
  vezife?: string;
  sort?: string;
  dir?: string;
};

function isValidSortKey(s: string | undefined): s is SortKey {
  return !!s && [
    "ad", "vezife", "maas", "bonus", "cerime", "net",
    "davamiyyet", "tapsiriq", "sehv", "satis", "performans",
  ].includes(s);
}

export default async function KpiDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};
  const sortKey: SortKey = isValidSortKey(sp.sort) ? sp.sort : "performans";
  const sortDir: SortDir = sp.dir === "asc" ? "asc" : "desc";

  const { month, rows, summary, vezifeOptions } = await getKpiDashboard({
    monthStr: sp.month,
    search: sp.search,
    vezifeFilter: sp.vezife,
    sortBy: sortKey,
    sortDir,
  });
  const monthLabel = `${MONTH_LABELS[month.ay - 1]} ${month.il}`;

  // Ay seçimi
  const now = new Date();
  const monthOptions: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthOptions.push({ value: v, label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}` });
  }

  // Sort link builder
  function buildSortHref(newSort: SortKey): string {
    const newDir: SortDir = sortKey === newSort && sortDir === "desc" ? "asc" : "desc";
    const params = new URLSearchParams();
    if (sp.month) params.set("month", sp.month);
    if (sp.search) params.set("search", sp.search);
    if (sp.vezife) params.set("vezife", sp.vezife);
    params.set("sort", newSort);
    params.set("dir", newDir);
    return `?${params.toString()}`;
  }

  // Eksport URL
  const exportParams = new URLSearchParams();
  if (sp.month) exportParams.set("month", sp.month);
  if (sp.search) exportParams.set("search", sp.search);
  if (sp.vezife) exportParams.set("vezife", sp.vezife);
  exportParams.set("sort", sortKey);
  exportParams.set("dir", sortDir);
  const exportHref = `/api/iscilier/kpi-export?${exportParams.toString()}`;

  // Diqqət lazım sayı
  const diqqetCount = rows.filter((r) => r.performans_skoru < 50).length;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/iscilier"
            className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              KPI Dashboard
              <Link
                href="/ai"
                title="AI Mərkəzində sistem haqda sual ver — KPI, bonus, satış"
                className="inline-flex items-center gap-0.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-500/20"
              >
                <Sparkles className="h-2.5 w-2.5" />
                AI köməkçi
              </Link>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {monthLabel} · {summary.cemi_emekdas} əməkdaş — bonus, davamiyyət, tapşırıq, səhv
            </p>
          </div>
        </div>
      </header>

      {/* İzahedici giriş — yeni istifadəçi anlasın */}
      <Card className="glass border-sky-500/30 bg-sky-500/5">
        <CardContent className="flex items-start gap-3 py-3 text-[11px]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <div className="space-y-1">
            <p>
              <strong className="text-foreground">Bu nədir?</strong>{" "}
              Bütün əməkdaşların aylıq performans göstəriciləri bir cədvəldə. Hər sütun başlığının üzərinə{" "}
              <strong>?</strong> ikonuna baxsan, izah görəcəksən. Başlığa kliklə isə həmin sütuna görə sıralanır.
              Hər sətrə klik isə həmin əməkdaşın fərdi bonus səhifəsini açır.
            </p>
            <p className="text-muted-foreground">
              Top 3 əməkdaşa 🥇🥈🥉 medalı qoyulur. Performans skoru &lt;50 olanlar{" "}
              <span className="font-semibold text-rose-600">«Diqqət»</span> bayrağı alır.
              Sütunlarda ▲▼ trend — keçən ayla müqayisədir.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Mündəricat — 6 KPI kartı */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          icon={Users}
          label="Əməkdaş"
          value={String(summary.cemi_emekdas)}
          subline={diqqetCount > 0 ? `${diqqetCount} diqqət lazım` : "Hamısı yaxşı"}
          tone={diqqetCount > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          icon={Briefcase}
          label="Cəmi maaş"
          value={formatMoney(summary.cemi_maas)}
          subline={`Aylıq · ${monthLabel}`}
        />
        <KpiCard
          icon={Coins}
          label="Cəmi bonus"
          value={formatMoney(summary.cemi_bonus)}
          subline="Bu ay qazanılan"
          tone="success"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Cəmi cərimə"
          value={formatMoney(summary.cemi_cerime)}
          subline="Bu ay"
          tone={summary.cemi_cerime > 0 ? "danger" : "neutral"}
        />
        <KpiCard
          icon={ClipboardCheck}
          label="Davamiyyət"
          value={`${summary.ortalama_davamiyyet.toFixed(0)}%`}
          subline="Komanda ortalaması"
          tone={
            summary.ortalama_davamiyyet >= 90 ? "success"
              : summary.ortalama_davamiyyet >= 70 ? "warning" : "danger"
          }
        />
        <KpiCard
          icon={TrendingUp}
          label="Satış"
          value={formatMoney(summary.cemi_satis)}
          subline={`${rows.reduce((s, r) => s + r.satis_sayi, 0)} sifariş`}
          tone="success"
        />
      </section>

      {/* Filter zolaq — axtarış + vəzifə + ay + eksport */}
      <Card className="glass">
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <form className="flex flex-1 flex-wrap items-center gap-2 min-w-[300px]">
            {/* Axtarış */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                name="search"
                type="text"
                defaultValue={sp.search ?? ""}
                placeholder="Ad, vəzifə, rol axtar..."
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm"
              />
            </div>
            {/* Vəzifə */}
            <select
              name="vezife"
              defaultValue={sp.vezife ?? ""}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              title="Vəzifəyə görə süz"
            >
              <option value="">Bütün vəzifələr</option>
              {vezifeOptions.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            {/* Ay */}
            <select
              name="month"
              defaultValue={sp.month ?? monthOptions[0].value}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              title="Hesabat ayı"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1 rounded-md bg-foreground px-3 text-xs font-bold text-background hover:opacity-90"
              title="Süzgəci tətbiq et"
            >
              <Filter className="h-3 w-3" />
              Süz
            </button>
            {(sp.search || sp.vezife) && (
              <Link
                href={`?${sp.month ? `month=${sp.month}` : ""}`}
                className="text-xs text-primary hover:underline"
                title="Bütün süzgəcləri təmizlə"
              >
                Təmizlə
              </Link>
            )}
          </form>
          {/* Eksport */}
          <a
            href={exportHref}
            className="inline-flex h-9 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
            title="Cari görünüşü Excel/CSV faylına yüklə"
          >
            <Download className="h-3 w-3" />
            Excel-ə yüklə
          </a>
        </CardContent>
      </Card>

      {/* Əsas cədvəl */}
      <KpiDashboardTable
        rows={rows}
        buildSortHref={buildSortHref}
        currentSort={sortKey}
        currentDir={sortDir}
      />

      {/* Alt izah — necə istifadə */}
      <Card className="glass">
        <CardContent className="grid grid-cols-1 gap-3 py-3 text-[10.5px] text-muted-foreground md:grid-cols-3">
          <div>
            <strong className="text-foreground">💡 Cədvəl ilə işləmək</strong>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>Sütun başlığına klik — sıralama dəyişir</li>
              <li>Eyni başlığa təkrar klik — istiqaməti dəyişir</li>
              <li>Sətrə klik — fərdi bonus paneli</li>
            </ul>
          </div>
          <div>
            <strong className="text-foreground">🎨 Rəng kodu</strong>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li><span className="text-emerald-600">Yaşıl</span> ≥90% — Əla</li>
              <li><span className="text-amber-600">Sarı</span> 70-89% — Orta</li>
              <li><span className="text-rose-600">Qırmızı</span> &lt;70% — Zəif</li>
              <li>Səhv sütunu tərs — 0% yaşıl</li>
            </ul>
          </div>
          <div>
            <strong className="text-foreground">📊 Performans skoru necə hesablanır?</strong>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>Bonus nailiyyəti: 30%</li>
              <li>Davamiyyət: 25%</li>
              <li>Tapşırıq vaxtında: 25%</li>
              <li>Səhvsizlik: 20%</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
