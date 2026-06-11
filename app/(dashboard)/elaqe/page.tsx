import type { Metadata } from "next";
import { getModuleEntry } from "@/lib/lite/config";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users,
  AlertCircle,
  UserCheck,
  CalendarClock,
  Copy as CopyIcon,
  BarChart3,
  Crown,
  AlertTriangle,
  Target,
  PhoneCall,
  Cake,
  Moon,
  UserX,
  CreditCard,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactDialog } from "@/features/elaqe/components/contact-dialog";
import { ContactSearch } from "@/features/elaqe/components/contact-search";
import { ContactsTable } from "@/features/elaqe/components/contacts-table";
// QA #11: ayrıca import dialoqu çıxarıldı — idxal yalnız Ayarlar > İnteqrasiyada
import {
  getContacts,
  getManagers,
  getElaqeDashboard,
  type ContactFilter,
  type SortKey,
} from "@/features/elaqe/queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Əlaqələr — bütün kontragentlər" };

type SearchParams = {
  q?: string;
  borc?: string;
  tip?: string;
  qiymet?: string;
  status?: string;
  menecer?: string;
  olke?: string;
  sheher?: string;
  sort?: string;
  dir?: string;
  yatmis?: string;
  dogum_ay?: string;
  vip?: string;
  qara?: string;
  yeni?: string;
  filter?: string;
};

export default async function ElaqeHubPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Modul Giriş Sistemi: icmal (modulun öz dashboardu) HƏR İKİ rejimdə yalnız
  // ayar AÇIQ + rolda icazə (icmal.elaqe) olduqda görünür; əks halda modul
  // birbaşa iş səhifəsinə (ayarlardan seçilən landing) açılır.
  {
    const __entry = await getModuleEntry("elaqe");
    if (!__entry.icmalOn) redirect(__entry.landing);
  }

  const { requireElaqePerm } = await import("@/features/elaqe/access-guard");
  await requireElaqePerm();

  const sp = await searchParams;
  const f = (sp.filter ?? "").toLowerCase();
  const filter: ContactFilter = {
    nov: (sp.tip as ContactFilter["nov"]) ?? "any",
    search: sp.q,
    borc: (sp.borc as ContactFilter["borc"]) ?? (f === "borclu" ? "var" : "any"),
    qiymet_tipi: sp.qiymet,
    status: (sp.status as ContactFilter["status"]) ?? "aktiv",
    menecer_id: sp.menecer,
    olke: sp.olke,
    sheher: sp.sheher,
    sort: (sp.sort as SortKey) ?? "yaradildi",
    dir: (sp.dir as "asc" | "desc") ?? "desc",
    yatmis: sp.yatmis === "1" || f === "yatmis",
    dogum_ay: sp.dogum_ay === "1" || f === "dogum",
    vip: sp.vip === "1" || f === "vip",
    qara_siyahi: sp.qara === "1" || f === "qara",
    yeni: sp.yeni === "1" || f === "yeni",
  };

  const [data, managers, dash] = await Promise.all([
    getContacts(filter),
    getManagers(),
    getElaqeDashboard(),
  ]);
  const { items, total } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Əlaqələr</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bütün müştəri, təchizatçı və partnyorlar bir yerdə.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* İmport mərkəzləşdirildi → Ayarlar > İnteqrasiya (#11) */}
          <Link href="/ayarlar/inteqrasiya?key=musteri">
            <Button variant="outline" size="sm">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel idxal
            </Button>
          </Link>
          <ContactDialog defaultNov="musteri" managers={managers} />
        </div>
      </header>

      <nav className="flex flex-wrap items-center gap-1.5 text-sm">
        <SubLink href="/elaqe" label="Hamısı" icon={Users} />
        <SubLink href="/elaqe/musteriler" label="Müştərilər" icon={UserCheck} />
        <SubLink href="/elaqe/techizatcilar" label="Təchizatçılar" icon={Users} />
        <SubLink href="/elaqe/borclar" label="Borc mərkəzi" icon={CreditCard} />
        <SubLink href="/elaqe/dogum-gunu" label="Doğum günləri" icon={Cake} />
        <SubLink href="/elaqe/inaktiv" label="İnaktiv müştərilər" icon={UserX} />
        <SubLink href="/elaqe/dublikat" label="Dublikat" icon={CopyIcon} />
        <SubLink href="/elaqe/followup" label="Follow-up" icon={CalendarClock} />
        <SubLink href="/elaqe/hesabat" label="Hesabat" icon={BarChart3} />
      </nav>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Cəmi əlaqə"
          value={String(dash.cemi)}
          subline={`${dash.musteri} müştəri · ${dash.techizatci} təchizatçı`}
        />
        <KpiCard
          icon={AlertCircle}
          label="Borclu"
          value={String(dash.borclu_say)}
          subline={formatMoney(dash.borc_cemi)}
          tone={dash.borclu_say > 0 ? "warning" : "neutral"}
          href="/elaqe/borclar"
        />
        <KpiCard
          icon={PhoneCall}
          label="Bugünkü follow-up"
          value={String(dash.followup_bugun)}
          subline={dash.followup_gecikmis > 0 ? `${dash.followup_gecikmis} gecikmiş` : "Aktiv"}
          tone={dash.followup_gecikmis > 0 ? "danger" : dash.followup_bugun > 0 ? "warning" : "neutral"}
          href="/elaqe/followup"
        />
        <KpiCard
          icon={Target}
          label="Aktiv lead"
          value={String(dash.lead_aktiv)}
          subline="CRM pipeline"
          href="/crm/leadler"
        />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={AlertTriangle}
          label="Gecikmiş borc"
          value={String(dash.gec_borc_say)}
          subline="30+ gün"
          tone={dash.gec_borc_say > 0 ? "danger" : "neutral"}
        />
        <KpiCard
          icon={UserX}
          label="Qara siyahı"
          value={String(dash.qara_siyahi)}
          subline="Bloklananlar"
          tone={dash.qara_siyahi > 0 ? "danger" : "neutral"}
        />
        <KpiCard
          icon={Moon}
          label="Yatmış müştəri"
          value={String(dash.yatmis_say)}
          subline="90+ gün hərəkət yox"
          tone={dash.yatmis_say > 0 ? "warning" : "neutral"}
          href="/elaqe/musteriler?yatmis=1"
        />
        <KpiCard
          icon={Cake}
          label="Doğum bu ay"
          value={String(dash.dogum_bu_ay)}
          subline="Salamlama fürsəti"
          tone={dash.dogum_bu_ay > 0 ? "info" : "neutral"}
          href="/elaqe/musteriler?dogum_ay=1"
        />
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4 text-warning" /> Top müştərilər (90 gün)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {dash.top_musteri.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Hələ satış yoxdur</p>
            ) : (
              <ul className="divide-y divide-border/30">
                {dash.top_musteri.map((m, i) => (
                  <li key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <Link
                      href={`/elaqe/musteriler/${m.id}`}
                      className="min-w-0 flex-1 truncate hover:text-primary-light"
                    >
                      <span className="mr-2 inline-block w-5 text-[10.5px] text-muted-foreground">
                        #{i + 1}
                      </span>
                      {m.ad}
                      <span className="ml-2 text-[10.5px] text-muted-foreground">
                        ({m.satis_say} satış)
                      </span>
                    </Link>
                    <span className="tabular-nums font-semibold text-success">
                      {formatMoney(m.dovriyye)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-danger" /> Risk müştərilər (gecikən borc)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {dash.risk_musteri.length === 0 ? (
              <p className="py-6 text-center text-sm text-success">Risk müştəri yoxdur</p>
            ) : (
              <ul className="divide-y divide-border/30">
                {dash.risk_musteri.map((m) => (
                  <li key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <Link
                      href={`/elaqe/musteriler/${m.id}`}
                      className="min-w-0 flex-1 truncate hover:text-primary-light"
                    >
                      {m.ad}
                      <span className="ml-2 text-[10.5px] text-muted-foreground">
                        ({m.gun} gün)
                      </span>
                    </Link>
                    <span className="tabular-nums font-semibold text-danger">
                      {formatMoney(m.borc)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <ContactSearch basePath="/elaqe" showTip managers={managers} />

      <ContactsTable items={items} total={total} defaultNov="any" managers={managers} />
    </div>
  );
}

function SubLink({
  href, label, icon: Icon,
}: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
