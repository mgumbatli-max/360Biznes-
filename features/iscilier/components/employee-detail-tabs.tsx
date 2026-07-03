"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail, Phone, Briefcase, Calendar, Building2, MapPin, IdCard, CreditCard,
  ShoppingCart, CalendarDays, Plane, ListTodo, History, CircleDollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney, formatDate } from "@/lib/utils";
import { BonusForm } from "./bonus-form";
import { BordroDetailRow } from "./bordro-detail-modal";
import { DocumentsPanel } from "./documents-panel";
import { SchedulePanel } from "./schedule-panel";
import { ProfileExtrasEditor } from "./profile-extras";
import { PerfReviewForm } from "./perf-review-form";
import { DisciplinaryForm } from "./disciplinary-form";
import { TerminationDialog } from "./termination-dialog";
import { Gift, FileText, Clock } from "lucide-react";
import type { EmployeeDocument, WorkScheduleRow } from "../documents-queries";
import type { ProfileExtras } from "../hr-types";
import type { BonusProfil } from "../bonus-profile";
import type { BonusHesablama } from "../bonus-calc";
import { BonusOverview } from "./bonus-overview";
import { BonusProfileCard } from "./bonus-profile-card";

type Detail = {
  id: string;
  ad_soyad: string;
  email: string;
  telefon: string | null;
  vezife: string | null;
  rol_ad: string;
  ise_baslama: Date | null;
  son_giris: Date | null;
  aktiv: boolean;
  aylik_maas: number;
  fin_kod: string | null;
  dogum_tarixi: Date | null;
  unvan: string | null;
  bank_ad: string | null;
  bank_hesab: string | null;
  default_filial_ad: string | null;
  profil_sekil: string | null;
  isden_cixdi: Date | null;
};

type SalesData = {
  total_count: number;
  total_amount: number;
  month_count: number;
  month_amount: number;
  tenant_month_avg: number;
  employee_avg_ticket: number;
  recent: Array<{ id: string; nomre: string; tarix: Date; son_mebleg: number; musteri: string | null }>;
};

type AttendanceData = {
  total: number;
  gec: number;
  qaib: number;
  rows: Array<{
    id: string; tarix: Date; giris: Date | null; cixis: Date | null;
    gozlenen_giris: Date | null; gec_dq: number; status: string; qeyd: string | null;
  }>;
};

type BordroData = {
  total: number;
  avg: number;
  bonus: number;
  cerime: number;
  rows: Array<{
    id: number; il: number; ay: number; esas_maas: number; son_meblegh: number;
    kpi_bonus: number; manual_bonus: number; cerime: number; status: string;
    odenish_tarixi: Date | null;
    prorata_maas?: number; avans?: number;
    ish_gun_norma?: number | null; ish_gun_faktiki?: number | null;
    qaib_gun?: number | null; mezuniyyet_gun?: number | null;
    detal?: {
      satis_komisyon?: number; vergi?: number; sosial_sigorta?: number; gross?: number;
      events?: Array<{ ts?: string; nov?: string; meblegh?: number; sebeb?: string }>;
    } | null;
  }>;
};

type LeavesData = {
  quota: number;
  used: number;
  remaining: number;
  past: Array<{ id: number; nov: string; baslama: Date; bitme: Date; gun_sayi: number; status: string | null }>;
  upcoming: Array<{ id: number; nov: string; baslama: Date; bitme: Date; gun_sayi: number; status: string | null }>;
};

type Task = {
  id: string; basliq: string; status: string | null; prioritet: string | null;
  deadline: Date | null; tamamlandi_de: Date | null;
};

type AuditEntry = {
  id: string; emeliyyat: string; resurs_nov: string; resurs_id: string | null;
  url: string | null; metod: string | null; status: string | null; yaradildi: Date | null;
};

type BonusEvent = {
  ts: Date; nov: "bonus" | "cerime"; meblegh: number; sebeb: string;
  bordro_id: number; il: number; ay: number;
};

type CommissionInfo = {
  satis_mebleg: number;
  satis_say: number;
  commission_mebleg: number;
  bonus_mebleg: number;
  yekun: number;
  hedef: number | null;
  hedefe_catdi: boolean;
};

const MONTH_LABELS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

function formatTime(d: Date | null): string {
  if (!d) return "—";
  return formatDate(d, { hour: "2-digit", minute: "2-digit" });
}

export function EmployeeDetailTabs({
  detail,
  sales,
  attendance,
  bordro,
  leaves,
  tasks,
  audit,
  initialTab,
  bonusEvents = [],
  commission = null,
  documents = [],
  schedule = [],
  extras,
  bonusProfil,
  bonusCalc,
  canEditBonus = false,
  isViewingSelf = false,
}: {
  detail: Detail;
  sales: SalesData;
  attendance: AttendanceData;
  bordro: BordroData;
  leaves: LeavesData;
  tasks: Task[];
  audit: AuditEntry[];
  initialTab?: string;
  bonusEvents?: BonusEvent[];
  commission?: CommissionInfo | null;
  documents?: EmployeeDocument[];
  schedule?: WorkScheduleRow[];
  extras: ProfileExtras;
  bonusProfil?: BonusProfil;
  bonusCalc?: BonusHesablama | null;
  canEditBonus?: boolean;
  isViewingSelf?: boolean;
}) {
  const [tab, setTab] = useState(initialTab ?? "profil");

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="flex w-full flex-wrap">
        <TabsTrigger value="profil">Profil</TabsTrigger>
        <TabsTrigger value="davamiyyet">Davamiyyət</TabsTrigger>
        <TabsTrigger value="maas">Maaş</TabsTrigger>
        <TabsTrigger value="mezuniyyet">Məzuniyyət</TabsTrigger>
        <TabsTrigger value="bonus">Bonus & Cərimə</TabsTrigger>
        <TabsTrigger value="perf">Performans</TabsTrigger>
        <TabsTrigger value="intizam">İntizam</TabsTrigger>
        <TabsTrigger value="kpi">KPI</TabsTrigger>
        <TabsTrigger value="tapshiriq">Tapşırıq</TabsTrigger>
        <TabsTrigger value="qrafik">Qrafik</TabsTrigger>
        <TabsTrigger value="sened">Sənəd</TabsTrigger>
        <TabsTrigger value="audit">Audit</TabsTrigger>
      </TabsList>

      <TabsContent value="profil" className="pt-3 space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Şəxsi məlumat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row icon={Mail} value={detail.email} />
              {detail.telefon && <Row icon={Phone} value={detail.telefon} />}
              {detail.fin_kod && <Row icon={IdCard} label="FİN" value={detail.fin_kod} />}
              {detail.dogum_tarixi && <Row icon={Calendar} label="Doğum" value={formatDate(detail.dogum_tarixi)} />}
              {detail.unvan && <Row icon={MapPin} value={detail.unvan} />}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">İş məlumatı</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {detail.vezife && <Row icon={Briefcase} label="Vəzifə" value={detail.vezife} />}
              <Row icon={Briefcase} label="Rol" value={detail.rol_ad} />
              {detail.default_filial_ad && <Row icon={Building2} label="Filial" value={detail.default_filial_ad} />}
              {detail.ise_baslama && <Row icon={Calendar} label="İşə başlama" value={formatDate(detail.ise_baslama)} />}
              <Row icon={CircleDollarSign} label="Aylıq maaş" value={formatMoney(detail.aylik_maas)} />
              {detail.son_giris && <Row icon={Calendar} label="Son giriş" value={formatDate(detail.son_giris, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} />}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Bank & Çıxış</CardTitle>
              {!detail.isden_cixdi && (
                <TerminationDialog istifadeciId={detail.id} adSoyad={detail.ad_soyad} />
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {detail.bank_ad || detail.bank_hesab ? (
                <>
                  {detail.bank_ad && <Row icon={CreditCard} label="Bank" value={detail.bank_ad} />}
                  {detail.bank_hesab && <Row icon={CreditCard} label="IBAN" value={detail.bank_hesab} />}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Bank məlumatı qeyd olunmayıb.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <ProfileExtrasEditor istifadeciId={detail.id} initial={extras} />
      </TabsContent>

      <TabsContent value="davamiyyet" className="pt-3">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <MiniStat label="Bu ay qeyd" value={String(attendance.total)} />
          <MiniStat label="Gecikmə" value={String(attendance.gec)} tone={attendance.gec > 0 ? "warning" : "neutral"} />
          <MiniStat label="Qaib" value={String(attendance.qaib)} tone={attendance.qaib > 0 ? "danger" : "neutral"} />
        </div>
        {attendance.rows.length === 0 ? (
          <EmptyBox icon={CalendarDays} label="Bu ay davamiyyət qeydi yoxdur" />
        ) : (
          <Card className="glass">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">Tarix</th>
                      <th className="px-3 py-2.5">Giriş</th>
                      <th className="px-3 py-2.5">Çıxış</th>
                      <th className="px-3 py-2.5">Gecikmə</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.rows.map((r) => (
                      <tr key={r.id} className="border-b border-border/30">
                        <td className="px-3 py-2 text-xs">{formatDate(r.tarix)}</td>
                        <td className="px-3 py-2 tabular-nums">{formatTime(r.giris)}</td>
                        <td className="px-3 py-2 tabular-nums">{formatTime(r.cixis)}</td>
                        <td className="px-3 py-2 text-xs">{r.gec_dq > 0 ? `${r.gec_dq} dəq` : "—"}</td>
                        <td className="px-3 py-2"><AttBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="maas" className="pt-3">
        <div className="grid grid-cols-2 gap-3 mb-4 lg:grid-cols-4">
          <MiniStat label="Toplam ödəniş" value={formatMoney(bordro.total)} />
          <MiniStat label="Ortalama" value={formatMoney(bordro.avg)} />
          <MiniStat label="Bonus toplam" value={formatMoney(bordro.bonus)} tone="success" />
          <MiniStat label="Cərimə toplam" value={formatMoney(bordro.cerime)} tone={bordro.cerime > 0 ? "danger" : "neutral"} />
        </div>
        {bordro.rows.length === 0 ? (
          <EmptyBox icon={CircleDollarSign} label="Bordro qeydi yoxdur" />
        ) : (
          <Card className="glass">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">Dövr</th>
                      <th className="px-3 py-2.5 text-right">Əsas maaş</th>
                      <th className="px-3 py-2.5 text-right">Bonus</th>
                      <th className="px-3 py-2.5 text-right">Cərimə</th>
                      <th className="px-3 py-2.5 text-right">Net</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bordro.rows.map((r) => (
                      <BordroDetailRow key={r.id} row={r} printHrefBase={`/iscilier/${detail.id}/bordro-print`}>
                        <td className="px-3 py-2 text-xs">{MONTH_LABELS[r.ay - 1]} {r.il}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.esas_maas)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-success">{r.kpi_bonus + r.manual_bonus > 0 ? formatMoney(r.kpi_bonus + r.manual_bonus) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-danger">{r.cerime > 0 ? formatMoney(r.cerime) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(r.son_meblegh)}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-[10px] ${r.status === "odenilib" ? "border-success/30 text-success" : "border-warning/30 text-warning"}`}>
                            {r.status === "odenilib" ? "Ödənilib" : "Çernovik"}
                          </Badge>
                        </td>
                      </BordroDetailRow>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="mezuniyyet" className="pt-3">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <MiniStat label="İllik kvota" value={`${leaves.quota} gün`} />
          <MiniStat label="İstifadə olunub" value={`${leaves.used} gün`} tone={leaves.used > leaves.quota * 0.7 ? "warning" : "neutral"} />
          <MiniStat label="Qalıq" value={`${leaves.remaining} gün`} tone="success" />
        </div>
        {leaves.upcoming.length > 0 && (
          <Card className="glass mb-3">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Gələcək ərizələr</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {leaves.upcoming.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-md border border-border/40 p-2 text-sm">
                  <div>
                    <div>{l.nov}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(l.baslama)} → {formatDate(l.bitme)} · {l.gun_sayi} gün</div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{l.status ?? "—"}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {leaves.past.length === 0 ? (
          <EmptyBox icon={Plane} label="Keçmiş məzuniyyət qeydi yoxdur" />
        ) : (
          <Card className="glass">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Keçmiş məzuniyyətlər</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {leaves.past.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-md border border-border/40 p-2 text-sm">
                  <div>
                    <div>{l.nov}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(l.baslama)} → {formatDate(l.bitme)} · {l.gun_sayi} gün</div>
                  </div>
                  <Badge variant="outline" className="border-success/30 text-success text-[10px]">Tamamlanıb</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="bonus" className="pt-3 space-y-4">
        {/* Ana bonus paneli — hero + paylanma tək kartda
            canEdit yalnız admin/sahibkar/icazəli şəxslər üçün — adi əməkdaş
            yalnız read-only görür. */}
        {bonusProfil && bonusCalc !== undefined && (
          <BonusOverview
            istifadeciId={detail.id}
            profile={bonusProfil}
            result={bonusCalc ?? null}
            canEdit={canEditBonus}
          />
        )}

        {/* Bonus profil tam konfiqurasiya — pool metodu, paylanma, müştəri filtri,
            İstisna müştərilər (kpi/bonus hesablanmasın). Yalnız admin/sahibkar redaktə edir. */}
        {bonusProfil && canEditBonus && (
          <BonusProfileCard istifadeciId={detail.id} initial={bonusProfil} />
        )}

        {/* Bordro xülasə + əl-ilə düzəliş — kompakt 2 sütun */}
        <div className={`grid grid-cols-1 gap-3 ${canEditBonus ? "lg:grid-cols-3" : ""}`}>
          {/* Sol: bordro mini-stats — hər kəs görür */}
          <Card className={`glass ${canEditBonus ? "lg:col-span-1" : ""}`}>
            <CardContent className="space-y-2.5 py-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Bordro · {MONTH_LABELS[new Date().getMonth()]} {new Date().getFullYear()}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Bonus toplam</span>
                <span className="text-base font-bold tabular-nums text-emerald-600">{formatMoney(bordro.bonus)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Cərimə toplam</span>
                <span className={`text-base font-bold tabular-nums ${bordro.cerime > 0 ? "text-rose-500" : "text-muted-foreground"}`}>
                  {formatMoney(bordro.cerime)}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t border-border/40 pt-2">
                <span className="text-xs font-semibold">Net təsir</span>
                <span className={`text-lg font-bold tabular-nums ${bordro.bonus - bordro.cerime >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                  {formatMoney(bordro.bonus - bordro.cerime)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Sağ: əl-ilə düzəliş forması — yalnız icazəlilər */}
          {canEditBonus && (
            <Card className="glass lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  Əl-ilə bonus / cərimə əlavə et
                </CardTitle>
                <p className="text-[10.5px] text-muted-foreground">
                  Avtomatik KPI hesabından kənar — birdəfəlik mükafat və ya cəza
                </p>
              </CardHeader>
              <CardContent>
                <BonusForm istifadeciId={detail.id} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Read-only vəziyyətdə açıqlayıcı banner */}
        {!canEditBonus && isViewingSelf && (
          <Card className="glass border-sky-500/30 bg-sky-500/5">
            <CardContent className="flex items-start gap-2 py-3 text-[11px]">
              <span className="text-sky-600">ℹ</span>
              <p className="text-muted-foreground">
                Bonus qaydaları yalnız sahibkar / admin tərəfindən dəyişdirilə bilər.
                Yuxarıdakı hesabat bu ay sənin qazandığını göstərir — real performansa görə avtomatik yenilənir.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tarixçə — yığcam, accordion stilli */}
        {bonusEvents.length > 0 && (
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3 w-3" />
                Bonus tarixçəsi ({bonusEvents.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/30 max-h-72 overflow-y-auto">
                {bonusEvents.map((ev, i) => {
                  const isBonus = ev.nov === "bonus";
                  return (
                    <div key={`${ev.bordro_id}-${i}`} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-secondary/20">
                      <div className="flex items-center gap-2">
                        <Gift className={`h-3 w-3 ${isBonus ? "text-emerald-500" : "text-rose-500"}`} />
                        <div>
                          <div className="text-xs font-medium">{ev.sebeb}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatDate(ev.ts)} · {MONTH_LABELS[ev.ay - 1]} {ev.il}
                          </div>
                        </div>
                      </div>
                      <div className={`tabular-nums text-sm font-bold ${isBonus ? "text-emerald-600" : "text-rose-500"}`}>
                        {isBonus ? "+" : "−"}{formatMoney(ev.meblegh)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="perf" className="pt-3">
        <PerfReviewForm
          istifadeciId={detail.id}
          history={extras.perf_reviews}
          oneOnOnes={extras.one_on_ones}
        />
      </TabsContent>

      <TabsContent value="intizam" className="pt-3">
        <DisciplinaryForm
          istifadeciId={detail.id}
          history={extras.disciplinary}
        />
      </TabsContent>

      <TabsContent value="kpi" className="pt-3">
        <div className="grid grid-cols-2 gap-3 mb-4 lg:grid-cols-4">
          <MiniStat label="Bu ay satış" value={formatMoney(sales.month_amount)} tone="success" />
          <MiniStat label="Bu ay say" value={String(sales.month_count)} />
          <MiniStat label="Cəmi satış" value={formatMoney(sales.total_amount)} />
          <MiniStat label="Ortalama çek" value={formatMoney(sales.employee_avg_ticket)} />
        </div>
        {commission && (
          <Card className="glass mb-3 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                <CircleDollarSign className="h-3.5 w-3.5 text-primary-light" />
                Bu ay komissiya
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MiniStat label="Komissiya bazası" value={formatMoney(commission.satis_mebleg)} />
              <MiniStat
                label="Komissiya"
                value={formatMoney(commission.commission_mebleg)}
                tone="success"
              />
              <MiniStat
                label="Hədəf bonusu"
                value={commission.hedefe_catdi ? formatMoney(commission.bonus_mebleg) : "—"}
                tone={commission.hedefe_catdi ? "success" : "neutral"}
              />
              <MiniStat label="Yekun" value={formatMoney(commission.yekun)} tone="success" />
            </CardContent>
          </Card>
        )}
        <Card className="glass mb-3">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Hədəfə qarşı (bu ay)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Compare label="İşçinin ortalama çeki" me={sales.employee_avg_ticket} reference={sales.tenant_month_avg} refLabel="Mağaza orta" />
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Son satışlar</CardTitle></CardHeader>
          <CardContent className="p-0">
            {sales.recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Satış yoxdur</p>
            ) : (
              <div className="divide-y divide-border/40 max-h-[400px] overflow-y-auto">
                {sales.recent.map((s) => (
                  <Link key={s.id} href={`/ticaret/satislar/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-secondary/40">
                    <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs font-medium">{s.nomre}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(s.tarix)}{s.musteri && ` · ${s.musteri}`}</div>
                    </div>
                    <div className="tabular-nums font-semibold">{formatMoney(s.son_mebleg)}</div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tapshiriq" className="pt-3">
        {tasks.length === 0 ? (
          <EmptyBox icon={ListTodo} label="Bu işçiyə təyin edilmiş tapşırıq yoxdur" />
        ) : (
          <Card className="glass">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">Başlıq</th>
                      <th className="px-3 py-2.5">Prioritet</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Deadline</th>
                      <th className="px-3 py-2.5">Tamamlanıb</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t.id} className="border-b border-border/30">
                        <td className="px-3 py-2 text-xs">
                          <Link href={`/tapshiriqlar/${t.id}`} className="hover:underline">{t.basliq}</Link>
                        </td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{t.prioritet ?? "—"}</Badge></td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{t.status ?? "—"}</Badge></td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{t.deadline ? formatDate(t.deadline) : "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{t.tamamlandi_de ? formatDate(t.tamamlandi_de) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="qrafik" className="pt-3">
        {schedule.length === 0 ? (
          <EmptyBox icon={Clock} label="Qrafik məlumatı yoxdur" />
        ) : (
          <SchedulePanel istifadeciId={detail.id} initial={schedule} />
        )}
      </TabsContent>

      <TabsContent value="sened" className="pt-3">
        {detail.id ? (
          <DocumentsPanel istifadeciId={detail.id} documents={documents} />
        ) : (
          <EmptyBox icon={FileText} label="Sənəd yoxdur" />
        )}
      </TabsContent>

      <TabsContent value="audit" className="pt-3">
        {audit.length === 0 ? (
          <EmptyBox icon={History} label="Audit qeydi yoxdur" />
        ) : (
          <Card className="glass">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">Tarix</th>
                      <th className="px-3 py-2.5">Əməliyyat</th>
                      <th className="px-3 py-2.5">Resurs</th>
                      <th className="px-3 py-2.5">Metod</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id} className="border-b border-border/30">
                        <td className="px-3 py-2 text-xs">{a.yaradildi ? formatDate(a.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                        <td className="px-3 py-2 text-xs">{a.emeliyyat}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{a.resurs_nov}{a.resurs_id ? ` · ${a.resurs_id.slice(0, 8)}` : ""}</td>
                        <td className="px-3 py-2 text-xs"><Badge variant="outline" className="text-[10px]">{a.metod ?? "—"}</Badge></td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-[10px] ${a.status === "ugur" ? "border-success/30 text-success" : "border-danger/30 text-danger"}`}>
                            {a.status ?? "—"}
                          </Badge>
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
    </Tabs>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label?: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      {label && <span className="text-xs text-muted-foreground">{label}:</span>}
      <span className="flex-1 break-words">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const toneCls = {
    neutral: "",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];
  return (
    <Card className="glass">
      <CardContent className="py-3">
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-lg font-semibold tabular-nums ${toneCls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyBox({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
      <Icon className="mb-2 h-7 w-7 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function AttBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    qaydasinda: { label: "OK", cls: "border-success/30 text-success" },
    gecikib: { label: "Gecikib", cls: "border-warning/30 text-warning" },
    qaib: { label: "Qaib", cls: "border-danger/30 text-danger" },
    istirahet: { label: "İstirahət", cls: "border-border text-muted-foreground" },
    mezuniyyet: { label: "Məzuniyyət", cls: "border-info/30 text-info" },
  };
  const s = map[status] ?? map.qaydasinda;
  return <Badge variant="outline" className={s.cls + " text-[10px]"}>{s.label}</Badge>;
}

function Compare({ label, me, reference, refLabel }: { label: string; me: number; reference: number; refLabel: string }) {
  const pct = reference > 0 ? Math.min(200, Math.round((me / reference) * 100)) : 0;
  const diff = me - reference;
  const tone = diff >= 0 ? "text-success" : "text-danger";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={"tabular-nums " + tone}>
          {formatMoney(me)} ({pct}% vs {refLabel})
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary">
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${Math.min(100, pct)}%`, background: "var(--brand-gradient)" }}
        />
      </div>
      <div className="text-[10.5px] text-muted-foreground">{refLabel}: {formatMoney(reference)}</div>
    </div>
  );
}

