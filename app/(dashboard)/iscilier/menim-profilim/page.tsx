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
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney } from "@/lib/utils";
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
  // Guard: əgər istifadəçi istifadeciler cədvəlində yoxdursa (məs. silinmiş və ya
  // yeni hesabdırsa) notFound qaytar — sonrakı Promise.all parallel queries-də
  // null myId ilə krash olmasın.
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

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton fallback="/iscilier" className="mt-1" />
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              <AvatarFallback
                className="text-lg font-semibold"
                style={{ background: "var(--brand-gradient)", color: "#fff" }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight">
                <User className="h-5 w-5" /> Mənim profilim
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{me.roles?.ad ?? "—"}</Badge>
                {me.vezife && <Badge variant="outline">{me.vezife}</Badge>}
                <Badge variant="outline">{me.email}</Badge>
              </div>
            </div>
          </div>
        </div>
      </header>

      <Tabs defaultValue="profil">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="maas">Maaş</TabsTrigger>
          <TabsTrigger value="davamiyyet">Davamiyyət</TabsTrigger>
          <TabsTrigger value="mezuniyyet">Məzuniyyət</TabsTrigger>
          <TabsTrigger value="sened">Sənədlər</TabsTrigger>
          <TabsTrigger value="perf">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="pt-3 space-y-3">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Əsas məlumat (oxu)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <Row label="Ad Soyad" value={me.ad_soyad} />
              <Row label="Email" value={me.email} />
              <Row label="FİN" value={me.fin_kod ?? "—"} />
              <Row label="Doğum" value={formatDate(me.dogum_tarixi)} />
              <Row label="Vəzifə" value={me.vezife ?? "—"} />
              <Row
                label="Filial"
                value={me.filiallar_istifadeciler_default_filial_idTofiliallar?.ad ?? "—"}
              />
              <Row label="İşə başlama" value={formatDate(me.ise_baslama)} />
              <Row label="Müqavilə" value={me.kontrakt_nov ?? "—"} />
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

        <TabsContent value="maas" className="pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Mini icon={CircleDollarSign} label="Aylıq əsas" value={formatMoney(Number(me.aylik_maas ?? 0))} />
            <Mini icon={CircleDollarSign} label="Toplam ödəniş" value={formatMoney(bordro.total)} />
            <Mini icon={CircleDollarSign} label="Ortalama" value={formatMoney(bordro.avg)} />
          </div>
          <Card className="glass">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">Dövr</th>
                      <th className="px-3 py-2.5 text-right">Əsas</th>
                      <th className="px-3 py-2.5 text-right">Bonus</th>
                      <th className="px-3 py-2.5 text-right">Cərimə</th>
                      <th className="px-3 py-2.5 text-right">Net</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bordro.rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-muted-foreground">
                          Maaş qeydi yoxdur
                        </td>
                      </tr>
                    ) : (
                      bordro.rows.map((r) => (
                        <tr key={r.id} className="border-b border-border/30">
                          <td className="px-3 py-2 text-xs">
                            {MONTH_LABELS[r.ay - 1]} {r.il}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatMoney(r.esas_maas)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-success">
                            {r.kpi_bonus + r.manual_bonus > 0
                              ? formatMoney(r.kpi_bonus + r.manual_bonus)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-danger">
                            {r.cerime > 0 ? formatMoney(r.cerime) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">
                            {formatMoney(r.son_meblegh)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className={
                                r.status === "odenilib"
                                  ? "border-success/30 text-success text-[10px]"
                                  : "border-warning/30 text-warning text-[10px]"
                              }
                            >
                              {r.status === "odenilib" ? "Ödənilib" : "Çernovik"}
                            </Badge>
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

        <TabsContent value="davamiyyet" className="pt-3 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Mini icon={CalendarDays} label="Bu ay qeyd" value={String(attendance.total)} />
            <Mini icon={CalendarDays} label="Gecikmə" value={String(attendance.gec)} />
            <Mini icon={CalendarDays} label="Qaib" value={String(attendance.qaib)} />
          </div>
          {attendance.rows.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Bu ay qeyd yoxdur
              </CardContent>
            </Card>
          ) : (
            <Card className="glass">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5">Tarix</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Gecikmə</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.rows.slice(0, 31).map((r) => (
                        <tr key={r.id} className="border-b border-border/30">
                          <td className="px-3 py-2 text-xs">{formatDate(r.tarix)}</td>
                          <td className="px-3 py-2 text-xs">{r.status}</td>
                          <td className="px-3 py-2 text-xs">
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

        <TabsContent value="mezuniyyet" className="pt-3 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Mini icon={Plane} label="İllik kvota" value={`${leaves.quota} gün`} />
            <Mini icon={Plane} label="İstifadə" value={`${leaves.used} gün`} />
            <Mini icon={Plane} label="Qalıq" value={`${leaves.remaining} gün`} />
          </div>
          <Card className="glass">
            <CardContent className="py-4 text-center text-sm">
              <Link
                href="/iscilier/mezuniyyet"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white"
              >
                Yeni ərizə ver
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sened" className="pt-3">
          {documents.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" /> Sənəd yoxdur
              </CardContent>
            </Card>
          ) : (
            <Card className="glass">
              <CardContent className="p-0">
                <div className="divide-y divide-border/30">
                  {documents.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between px-4 py-2.5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{d.ad}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {d.kateqoriya ?? "—"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="perf" className="pt-3 space-y-3">
          {extras.perf_reviews.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                <Star className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
                Performance review qeydi yoxdur
              </CardContent>
            </Card>
          ) : (
            extras.perf_reviews.map((r, i) => {
              const avg =
                Object.values(r.scores ?? {}).reduce((s, n) => s + Number(n), 0) /
                Math.max(1, Object.keys(r.scores ?? {}).length);
              return (
                <Card key={i} className="glass">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs">
                      {new Date(r.ts).toLocaleDateString("az-AZ")}
                    </CardTitle>
                    <Badge variant="outline">{avg.toFixed(2)} / 5</Badge>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    {r.manager_comment && (
                      <div>
                        <strong>Manager:</strong> {r.manager_comment}
                      </div>
                    )}
                    {r.self_assessment && (
                      <div>
                        <strong>Öz:</strong> {r.self_assessment}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/30 py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function Mini({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="glass">
      <CardContent className="py-3">
        <div className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3 w-3" /> {label}
        </div>
        <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
