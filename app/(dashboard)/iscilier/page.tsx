import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  BadgeCheck,
  Plane,
  Wallet,
  CalendarDays,
  UserPlus,
  UserMinus,
  TrendingUp,
  Network,
  Sparkles,
  User,
  Briefcase,
  GraduationCap,
  BarChart3,
  PieChart,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { EmployeeDialog } from "@/features/iscilier/components/employee-dialog";
import { EmployeesTable } from "@/features/iscilier/components/employees-table";
import { Button } from "@/components/ui/button";
import {
  getEmployees,
  getRoleOptions,
  getFilialOptions,
  getVezifeOptions,
} from "@/features/iscilier/queries";
import { getHeadcountStats } from "@/features/iscilier/hr-queries";

export const metadata: Metadata = { title: "Əməkdaşlar" };
export const dynamic = "force-dynamic";

export default async function IscilierPage() {
  const [items, headcount, roles, filiallar, vezifeler] = await Promise.all([
    getEmployees({}),
    getHeadcountStats(),
    getRoleOptions(),
    getFilialOptions(),
    getVezifeOptions(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Əməkdaşlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">HR Core — heyət, onboarding, performance və org chart.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/iscilier/onboarding">
            <Button size="sm" variant="outline">
              <UserPlus className="h-4 w-4" /> Onboarding
            </Button>
          </Link>
          <Link href="/iscilier/menim-profilim">
            <Button size="sm" variant="outline">
              <User className="h-4 w-4" /> Mənim profilim
            </Button>
          </Link>
          <EmployeeDialog roles={roles} filiallar={filiallar} />
        </div>
      </header>

      {/* Headcount strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard icon={Users} label="Cəmi" value={String(headcount.total)} subline={`${headcount.aktiv} aktiv`} />
        <KpiCard icon={BadgeCheck} label="Aktiv" value={String(headcount.aktiv)} subline="Sistemə daxil ola bilən" tone="success" />
        <KpiCard icon={Plane} label="Məzuniyyətdə" value={String(headcount.mezuniyyetde)} subline="Bu gün" tone={headcount.mezuniyyetde > 0 ? "warning" : "neutral"} />
        <KpiCard icon={UserPlus} label="Bu ay yeni" value={String(headcount.bu_ay_yeni)} subline="İşə başlama" tone="info" />
        <KpiCard icon={UserMinus} label="İşdən çıxmış" value={String(headcount.isden_cixmis_90)} subline="Son 90 gün" tone={headcount.isden_cixmis_90 > 0 ? "danger" : "neutral"} />
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <SubLink href="/iscilier/maas" icon={Wallet} title="Maaş" desc="Bordro" />
        <SubLink href="/iscilier/davamiyyet" icon={CalendarDays} title="Davamiyyət" desc="Gəliş-gediş" />
        <SubLink href="/iscilier/mezuniyyet" icon={Plane} title="Məzuniyyət" desc="Ərizələr" />
        <SubLink href="/iscilier/kpi" icon={TrendingUp} title="KPI" desc="Dashboard" />
        <SubLink href="/iscilier/org-chart" icon={Network} title="Org chart" desc="Heyət struktur" />
        <SubLink href="/iscilier/skills" icon={Sparkles} title="Bacarıqlar" desc="Skills matrix" />
        <SubLink href="/iscilier/vakansiya" icon={Briefcase} title="Vakansiya" desc="Recruitment" />
        <SubLink href="/iscilier/treninq" icon={GraduationCap} title="Treninq" desc="Kurslar" />
        <SubLink href="/iscilier/analitika" icon={BarChart3} title="Analitika" desc="HR insight" />
        <SubLink href="/iscilier/budce" icon={PieChart} title="Büdcə" desc="Headcount plan" />
      </div>


      <EmployeesTable items={items} roles={roles} filiallar={filiallar} vezifeler={vezifeler} />
    </div>
  );
}

function SubLink({ href, icon: Icon, title, desc }: { href: string; icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <Link href={href}>
      <Card className="glass transition hover:border-primary/30">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
