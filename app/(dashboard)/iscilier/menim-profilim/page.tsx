import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CircleDollarSign,
  CalendarDays,
  Plane,
  FileText,
  Star,
  User,
  Briefcase,
  Mail,
  Phone,
  MapPin,
  CalendarCheck,
  Award,
  Sparkles,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney, cn } from "@/lib/utils";
import { SelfServiceForm } from "@/features/iscilier/components/self-service-form";
import { getMyProfile, getMyId, getEmployeeExtras } from "@/features/iscilier/hr-queries";
import {
  getEmployeeBordroHistory,
  getEmployeeAttendance,
  getEmployeeLeaves,
} from "@/features/iscilier/detail-queries";
import { getEmployeeDocuments } from "@/features/iscilier/documents-queries";

export const metadata: Metadata = { title: "Mənim profilim" };

const MONTH_LABELS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun",
  "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];

export default async function MyProfilePage() {
  const myId = await getMyId();
  if (!myId) notFound();
  const [me, extras, bordro, attendance, leaves, documents] = await Promise.all([
    getMyProfile(),
    getEmployeeExtras(myId),
    getEmployeeBordroHistory(myId, 12),
    getEmployeeAttendance(myId),
    getEmployeeLeaves(myId),
    getEmployeeDocuments(myId),
  ]);
  if (!me) notFound();

  const initials = me.ad_soyad
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const tenureMonths = me.ise_baslama
    ? Math.max(0, Math.floor((Date.now() - new Date(me.ise_baslama).getTime()) / (30 * 24 * 3600 * 1000)))
    : 0;
  const tenureLabel =
    tenureMonths >= 12
      ? `${Math.floor(tenureMonths / 12)} il ${tenureMonths % 12} ay`
      : `${tenureMonths} ay`;

  const lastPerfAvg = extras.perf_reviews[0]
    ? Object.values(extras.perf_reviews[0].scores ?? {}).reduce((s, n) => s + Number(n), 0) /
      Math.max(1, Object.keys(extras.perf_reviews[0].scores ?? {}).length)
    : null;

  const attendanceScore = attendance.total > 0
    ? Math.round(((attendance.total - attendance.gec - attendance.qaib) / attendance.total) * 100)
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center gap-2">
        <BackButton fallback="/iscilier" />
        <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
          HR · Mənim profilim
        </span>
      </div>

      {/* Hero card — gradient brand background */}
      <Card className="relative overflow-hidden border-0">
        <div
          className="absolute inset-0 opacity-95"
          style={{ background: "var(--brand-gradient)" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_50%)]" />
        <CardContent className="relative z-10 p-5 text-white sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <Avatar className="h-20 w-20 ring-4 ring-white/30 shadow-xl">
              <AvatarFallback className="text-2xl font-bold bg-white/15 text-white backdrop-blur">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.12em] text-white/70">
                <Sparkles className="h-3 w-3" /> Profil
              </div>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">
                {me.ad_soyad}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {me.vezife && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-2.5 py-1 text-[11px] font-medium">
                    <Briefcase className="h-3 w-3" /> {me.vezife}
                  </span>
                )}
                {me.roles?.ad && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-2.5 py-1 text-[11px] font-medium">
                    <Award className="h-3 w-3" /> {me.roles.ad}
                  </span>
                )}
                {me.filiallar_istifadeciler_default_filial_idTofiliallar?.ad && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-2.5 py-1 text-[11px] font-medium">
                    <MapPin className="h-3 w-3" /> {me.filiallar_istifadeciler_default_filial_idTofiliallar.ad}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/85">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> {me.email}
                </span>
                {me.telefon && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> {me.telefon}
                  </span>
                )}
                {me.ise_baslama && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarCheck className="h-3 w-3" /> {tenureLabel} ərzində
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modern KPI grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={CircleDollarSign}
          label="Aylıq əsas maaş"
          value={formatMoney(Number(me.aylik_maas ?? 0))}
          tone="success"
          subline={bordro.total > 0 ? `Toplam ödəniş ${formatMoney(bordro.total)}` : "Hələ ödəniş yox"}
        />
        <KpiCard
          icon={Plane}
          label="Məzuniyyət qalıq"
          value={`${leaves.remaining} gün`}
          tone="info"
          subline={`${leaves.used} / ${leaves.quota} istifadə`}
        />
        <KpiCard
          icon={attendanceScore !== null && attendanceScore >= 90 ? CheckCircle2 : Clock}
          label="Davamiyyət (bu ay)"
          value={attendanceScore !== null ? `${attendanceScore}%` : "—"}
          tone={attendanceScore === null ? "neutral" : attendanceScore >= 90 ? "success" : attendanceScore >= 75 ? "warning" : "danger"}
          subline={attendance.gec || attendance.qaib ? `${attendance.gec} gec · ${attendance.qaib} qaib` : "Mükəmməl"}
        />
        <KpiCard
          icon={TrendingUp}
          label="Son performans"
          value={lastPerfAvg !== null ? `${lastPerfAvg.toFixed(1)}/5` : "—"}
          tone={lastPerfAvg === null ? "neutral" : lastPerfAvg >= 4 ? "success" : lastPerfAvg >= 3 ? "info" : "warning"}
          subline={lastPerfAvg !== null ? "Son review skoru" : "Review yoxdur"}
        />
      </div>

      <Tabs defaultValue="profil">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="profil" className="gap-1.5">
            <User className="h-3.5 w-3.5" /> Profil
          </TabsTrigger>
          <TabsTrigger value="maas" className="gap-1.5">
            <CircleDollarSign className="h-3.5 w-3.5" /> Maaş
          </TabsTrigger>
          <TabsTrigger value="davamiyyet" className="gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> Davamiyyət
          </TabsTrigger>
          <TabsTrigger value="mezuniyyet" className="gap-1.5">
            <Plane className="h-3.5 w-3.5" /> Məzuniyyət
          </TabsTrigger>
          <TabsTrigger value="sened" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Sənədlər
          </TabsTrigger>
          <TabsTrigger value="perf" className="gap-1.5">
            <Star className="h-3.5 w-3.5" /> Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="space-y-4 pt-4">
          <Card className="glass">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                <User className="h-3 w-3" /> Əsas məlumat
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm md:grid-cols-2">
                <InfoRow label="Ad Soyad" value={me.ad_soyad} />
                <InfoRow label="Email" value={me.email} />
                <InfoRow label="FİN kod" value={me.fin_kod ?? "—"} mono />
                <InfoRow label="Doğum tarixi" value={formatDate(me.dogum_tarixi)} />
                <InfoRow label="Vəzifə" value={me.vezife ?? "—"} />
                <InfoRow
                  label="Filial"
                  value={me.filiallar_istifadeciler_default_filial_idTofiliallar?.ad ?? "—"}
                />
                <InfoRow label="İşə başlama" value={formatDate(me.ise_baslama)} />
                <InfoRow label="Müqavilə növü" value={me.kontrakt_nov ?? "—"} />
              </div>
            </CardContent>
          </Card>

          <SelfServiceForm
            telefon={me.telefon ?? ""}
            unvan={me.unvan ?? ""}
            dil={me.dil ?? "az"}
            qohumAd={me.qohum_ad ?? ""}
            qohumTelefon={me.qohum_telefon ?? ""}
            qohumMunasibet={me.qohum_munasibet ?? ""}
          />
        </TabsContent>

        <TabsContent value="maas" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <MiniStat
              label="Aylıq əsas"
              value={formatMoney(Number(me.aylik_maas ?? 0))}
              accent="emerald"
            />
            <MiniStat
              label={`Son ${Math.min(12, bordro.rows.length)} ay toplam`}
              value={formatMoney(bordro.total)}
              accent="indigo"
            />
            <MiniStat
              label="Aylıq ortalama"
              value={formatMoney(bordro.avg)}
              accent="sky"
            />
          </div>

          <Card className="glass overflow-hidden">
            <div className="border-b border-border/40 px-4 py-2.5 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
              Bordro tarixçəsi
            </div>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5">Dövr</th>
                      <th className="px-4 py-2.5 text-right">Əsas</th>
                      <th className="px-4 py-2.5 text-right">Bonus</th>
                      <th className="px-4 py-2.5 text-right">Cərimə</th>
                      <th className="px-4 py-2.5 text-right">Net</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bordro.rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-muted-foreground">
                          <CircleDollarSign className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
                          Maaş qeydi yoxdur
                        </td>
                      </tr>
                    ) : (
                      bordro.rows.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-border/30 transition-colors hover:bg-secondary/20"
                        >
                          <td className="px-4 py-2.5 text-xs font-medium">
                            {MONTH_LABELS[r.ay - 1]} {r.il}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {formatMoney(r.esas_maas)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-success">
                            {r.kpi_bonus + r.manual_bonus > 0
                              ? `+${formatMoney(r.kpi_bonus + r.manual_bonus)}`
                              : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-danger">
                            {r.cerime > 0 ? `−${formatMoney(r.cerime)}` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold">
                            {formatMoney(r.son_meblegh)}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusPill
                              variant={r.status === "odenilib" ? "success" : "warning"}
                              label={r.status === "odenilib" ? "Ödənilib" : "Çernovik"}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="davamiyyet" className="space-y-4 pt-4">
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Bu ay qeyd" value={String(attendance.total)} accent="sky" />
            <MiniStat
              label="Gecikmə"
              value={String(attendance.gec)}
              accent={attendance.gec > 0 ? "amber" : "slate"}
            />
            <MiniStat
              label="Qaib"
              value={String(attendance.qaib)}
              accent={attendance.qaib > 0 ? "rose" : "slate"}
            />
          </div>
          {attendance.rows.length === 0 ? (
            <Card className="glass border-dashed">
              <CardContent className="py-10 text-center">
                <Clock className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Bu ay qeyd yoxdur</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5">Tarix</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Gecikmə</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.rows.slice(0, 31).map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-border/30 transition-colors hover:bg-secondary/20"
                        >
                          <td className="px-4 py-2.5 text-xs font-medium">{formatDate(r.tarix)}</td>
                          <td className="px-4 py-2.5 text-xs capitalize">{r.status}</td>
                          <td className="px-4 py-2.5 text-right text-xs text-amber-600 dark:text-amber-400">
                            {r.gec_dq > 0 ? `${r.gec_dq} dəq` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mezuniyyet" className="space-y-4 pt-4">
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="İllik kvota" value={`${leaves.quota} gün`} accent="sky" />
            <MiniStat label="İstifadə" value={`${leaves.used} gün`} accent="indigo" />
            <MiniStat
              label="Qalıq"
              value={`${leaves.remaining} gün`}
              accent={leaves.remaining <= 3 ? "rose" : "emerald"}
            />
          </div>
          <Card className="glass">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="text-sm">
                <div className="font-semibold">Məzuniyyət ərizəsi</div>
                <p className="text-xs text-muted-foreground">
                  İllik və xəstəlik məzuniyyəti üçün ərizə yarat
                </p>
              </div>
              <Link
                href="/iscilier/mezuniyyet"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-white shadow-md transition-transform hover:scale-105"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Plane className="h-3.5 w-3.5" /> Yeni ərizə
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sened" className="space-y-4 pt-4">
          {documents.length === 0 ? (
            <Card className="glass border-dashed">
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Sənəd yoxdur</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass">
              <CardContent className="p-0">
                <ul className="divide-y divide-border/30">
                  {documents.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-secondary/20"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                          <FileText className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate font-medium">{d.ad}</span>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {d.kateqoriya ?? "—"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="perf" className="space-y-3 pt-4">
          {extras.perf_reviews.length === 0 ? (
            <Card className="glass border-dashed">
              <CardContent className="py-12 text-center">
                <Star className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Performance review qeydi yoxdur</p>
              </CardContent>
            </Card>
          ) : (
            extras.perf_reviews.map((r, i) => {
              const avg =
                Object.values(r.scores ?? {}).reduce((s, n) => s + Number(n), 0) /
                Math.max(1, Object.keys(r.scores ?? {}).length);
              const tone = avg >= 4 ? "success" : avg >= 3 ? "info" : "warning";
              return (
                <Card key={i} className="glass">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        {new Date(r.ts).toLocaleDateString("az-AZ", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                      <StatusPill variant={tone} label={`${avg.toFixed(2)} / 5`} icon={Star} />
                    </div>
                    {(r.manager_comment || r.self_assessment) && (
                      <div className="mt-3 space-y-2 text-sm">
                        {r.manager_comment && (
                          <div className="rounded-md bg-secondary/40 p-3">
                            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                              Manager qiyməti
                            </div>
                            <p className="text-sm">{r.manager_comment}</p>
                          </div>
                        )}
                        {r.self_assessment && (
                          <div className="rounded-md bg-secondary/40 p-3">
                            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                              Öz qiymət
                            </div>
                            <p className="text-sm">{r.self_assessment}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border/30 pb-2 last:border-b-0">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn("text-right text-sm font-medium", mono && "font-mono")}>{value}</span>
    </div>
  );
}

const KPI_TONE: Record<
  "success" | "info" | "warning" | "danger" | "neutral",
  { ring: string; iconBg: string; iconColor: string }
> = {
  success: {
    ring: "ring-emerald-400/20",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  info: {
    ring: "ring-sky-400/20",
    iconBg: "bg-sky-500/15",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
  warning: {
    ring: "ring-amber-400/20",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  danger: {
    ring: "ring-rose-400/20",
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  neutral: {
    ring: "ring-slate-400/20",
    iconBg: "bg-slate-500/15",
    iconColor: "text-slate-600 dark:text-slate-400",
  },
};

function KpiCard({
  icon: Icon,
  label,
  value,
  subline,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subline?: string;
  tone?: keyof typeof KPI_TONE;
}) {
  const t = KPI_TONE[tone];
  return (
    <Card className={cn("glass ring-1 ring-inset transition-transform hover:scale-[1.02]", t.ring)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
              {label}
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
            {subline && (
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{subline}</div>
            )}
          </div>
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", t.iconBg)}>
            <Icon className={cn("h-4 w-4", t.iconColor)} />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

const ACCENT: Record<string, { dot: string; text: string }> = {
  emerald: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  indigo: { dot: "bg-indigo-500", text: "text-indigo-600 dark:text-indigo-400" },
  sky: { dot: "bg-sky-500", text: "text-sky-600 dark:text-sky-400" },
  amber: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  rose: { dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
  slate: { dot: "bg-slate-400", text: "text-slate-600 dark:text-slate-400" },
};

function MiniStat({
  label,
  value,
  accent = "slate",
}: {
  label: string;
  value: string;
  accent?: keyof typeof ACCENT;
}) {
  const a = ACCENT[accent];
  return (
    <Card className="glass">
      <CardContent className="py-3">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", a.dot)} />
          <span className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </span>
        </div>
        <div className={cn("mt-1 text-lg font-semibold tabular-nums", a.text)}>{value}</div>
      </CardContent>
    </Card>
  );
}

const STATUS_PILL: Record<
  "success" | "info" | "warning" | "danger",
  { gradient: string; dot: string; pulse: boolean }
> = {
  success: {
    gradient: "bg-gradient-to-b from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-300 border-emerald-400/30",
    dot: "bg-emerald-500",
    pulse: false,
  },
  info: {
    gradient: "bg-gradient-to-b from-sky-500/15 to-sky-500/5 text-sky-700 dark:text-sky-300 border-sky-400/30",
    dot: "bg-sky-500",
    pulse: false,
  },
  warning: {
    gradient: "bg-gradient-to-b from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-300 border-amber-400/30",
    dot: "bg-amber-500",
    pulse: true,
  },
  danger: {
    gradient: "bg-gradient-to-b from-rose-500/15 to-rose-500/5 text-rose-700 dark:text-rose-300 border-rose-400/30",
    dot: "bg-rose-500",
    pulse: true,
  },
};

function StatusPill({
  variant,
  label,
  icon: Icon,
}: {
  variant: keyof typeof STATUS_PILL;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const s = STATUS_PILL[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
        s.gradient,
      )}
    >
      {Icon ? (
        <Icon className="h-3 w-3" />
      ) : (
        <span className="relative flex h-1.5 w-1.5">
          {s.pulse && (
            <span
              className={cn(
                "absolute inset-0 inline-flex h-full w-full animate-ping rounded-full opacity-75",
                s.dot,
              )}
            />
          )}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", s.dot)} />
        </span>
      )}
      {label}
    </span>
  );
}
