import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { isHrPrivileged, canViewSalary } from "@/features/iscilier/access-guard";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmployeeDialog } from "@/features/iscilier/components/employee-dialog";
import { EmployeeDetailTabs } from "@/features/iscilier/components/employee-detail-tabs";
import { getRoleOptions, getFilialOptions, getVezifeOptions } from "@/features/iscilier/queries";
import {
  getEmployeeFullDetail,
  getEmployeeSales,
  getEmployeeAttendance,
  getEmployeeBordroHistory,
  getEmployeeLeaves,
  getEmployeeTasks,
  getEmployeeAuditLog,
  getEmployeeBonusEvents,
} from "@/features/iscilier/detail-queries";
import { getEmployeeDocuments, getEmployeeSchedule } from "@/features/iscilier/documents-queries";
import { getBonusProfil } from "@/features/iscilier/bonus-profile";
import { calculateMonthlyBonus } from "@/features/iscilier/bonus-calc";
import { getCommissionForUser } from "@/features/ticaret/commission-queries";
import { getEmployeeExtras } from "@/features/iscilier/hr-queries";
import type { EmployeeRow } from "@/features/iscilier/types";

export const metadata: Metadata = { title: "İşçi profili" };

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};

  // Critical-path: header + edit dialog + icazə kontekstu.
  // 4 paralel sorğu — istifadəçi əsasları, rol siyahısı, filial siyahısı, auth.
  // Tab data (13 əlavə sorğu) ayrı Suspense-də paralel yüklənir.
  const [e, roles, filiallar, vezifeler, session, icazeler] = await Promise.all([
    getEmployeeFullDetail(id),
    getRoleOptions(),
    getFilialOptions(),
    getVezifeOptions(),
    auth(),
    getRequestPermissions(),
  ]);
  if (!e) notFound();

  const currentUserId = session?.user?.id ?? "";
  const currentRol = session?.user?.rol_id ?? 0;
  const rolAd = (session?.user?.rol_ad ?? "").toLowerCase();
  const isViewingSelf = currentUserId === id;
  const privileged = isHrPrivileged(rolAd);

  // İcaze: özüdür, ya isci.view, ya da privileged
  if (!isViewingSelf && !privileged && !icazeler.includes("isci.view") && !icazeler.includes("hr.view")) {
    redirect("/icaze-yox?kod=isci.view&from=iscilier_detail");
  }

  // Maaş və bank field-lərini görə bilirmi?
  const canSeeSalary = await canViewSalary(id);
  const canEditBonus =
    currentRol === 1 || currentRol === 9 ||
    privileged ||
    icazeler.includes("hr.bonus_idare");

  const initials = e.ad_soyad.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  const employeeRow: EmployeeRow = {
    id: e.id,
    ad_soyad: e.ad_soyad,
    email: e.email,
    telefon: e.telefon,
    rol_id: e.rol_id ?? 0,
    rol_ad: e.roles?.ad ?? "",
    vezife: e.vezife,
    // PII gizli: maaş + bank + FİN yalnız özünə və ya səlahiyyətliyə görsənir
    aylik_maas: canSeeSalary ? Number(e.aylik_maas ?? 0) : 0,
    ise_baslama: e.ise_baslama,
    aktiv: e.aktiv ?? true,
    son_giris: e.son_giris,
    isden_cixdi: e.isden_cixdi,
    fin_kod: canSeeSalary ? e.fin_kod : null,
    dogum_tarixi: e.dogum_tarixi,
    unvan: e.unvan,
    bank_hesab: canSeeSalary ? e.bank_hesab : null,
    bank_ad: canSeeSalary ? e.bank_ad : null,
    default_filial_id: e.default_filial_id,
    default_filial_ad: e.filiallar_istifadeciler_default_filial_idTofiliallar?.ad ?? null,
    profil_sekil: e.profil_sekil,
    status: e.isden_cixdi ? "cixib" : !e.aktiv ? "passiv" : "aktiv",
  };

  const detail = {
    id: e.id,
    ad_soyad: e.ad_soyad,
    email: e.email,
    telefon: e.telefon,
    vezife: e.vezife,
    rol_ad: e.roles?.ad ?? "—",
    ise_baslama: e.ise_baslama,
    son_giris: e.son_giris,
    aktiv: e.aktiv ?? true,
    // 🔒 Maaş/FİN/bank həssasdır — maas.view/self olmayana maskalanır (Profil tabı).
    aylik_maas: canSeeSalary ? Number(e.aylik_maas ?? 0) : 0,
    fin_kod: canSeeSalary ? e.fin_kod : null,
    dogum_tarixi: e.dogum_tarixi,
    unvan: e.unvan,
    bank_ad: canSeeSalary ? e.bank_ad : null,
    bank_hesab: canSeeSalary ? e.bank_hesab : null,
    default_filial_ad: e.filiallar_istifadeciler_default_filial_idTofiliallar?.ad ?? null,
    profil_sekil: e.profil_sekil,
    isden_cixdi: e.isden_cixdi,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
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
              <h1 className="text-2xl font-bold tracking-tight">{e.ad_soyad}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{e.roles?.ad ?? "—"}</Badge>
                {e.vezife && <Badge variant="outline">{e.vezife}</Badge>}
                {e.isden_cixdi ? (
                  <Badge variant="outline" className="border-danger/30 text-danger">İşdən çıxıb</Badge>
                ) : !e.aktiv ? (
                  <Badge variant="outline">passiv</Badge>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        {(privileged || icazeler.includes("isci.idare")) && (
          <EmployeeDialog roles={roles} filiallar={filiallar} vezifeler={vezifeler} initial={employeeRow} trigger="edit" />
        )}
      </header>

      <Suspense fallback={<EmployeeTabsSkeleton />}>
        <EmployeeTabsSection
          id={id}
          detail={detail}
          initialTab={sp.tab}
          canEditBonus={canEditBonus}
          isViewingSelf={isViewingSelf}
        />
      </Suspense>
    </div>
  );
}

function EmployeeTabsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full rounded-md" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

async function EmployeeTabsSection({
  id,
  detail,
  initialTab,
  canEditBonus,
  isViewingSelf,
}: {
  id: string;
  detail: Parameters<typeof EmployeeDetailTabs>[0]["detail"];
  initialTab?: string;
  canEditBonus: boolean;
  isViewingSelf: boolean;
}) {
  const now = new Date();
  // 13 ağır sorğu burada paralel — kritik header dərhal render olunduqdan
  // sonra tablar streaming ilə gəlir. Hamısı eyni `Promise.all`-də ki, ən
  // yavaş sorğu (worst-case) hamısının yeniləndiyi vaxtdır.
  const [
    sales,
    attendance,
    bordro,
    leaves,
    tasks,
    audit,
    bonusEvents,
    commission,
    documents,
    schedule,
    extras,
    bonusProfil,
    bonusCalc,
  ] = await Promise.all([
    getEmployeeSales(id),
    getEmployeeAttendance(id),
    getEmployeeBordroHistory(id),
    getEmployeeLeaves(id),
    getEmployeeTasks(id),
    getEmployeeAuditLog(id),
    getEmployeeBonusEvents(id),
    getCommissionForUser(id, now.getFullYear(), now.getMonth() + 1),
    getEmployeeDocuments(id),
    getEmployeeSchedule(id),
    getEmployeeExtras(id),
    getBonusProfil(id),
    calculateMonthlyBonus(id, now.getFullYear(), now.getMonth() + 1),
  ]);

  return (
    <EmployeeDetailTabs
      detail={detail}
      sales={sales}
      attendance={attendance}
      bordro={bordro}
      leaves={leaves}
      tasks={tasks}
      audit={audit}
      initialTab={initialTab}
      bonusEvents={bonusEvents}
      commission={commission}
      documents={documents}
      schedule={schedule}
      extras={extras}
      bonusProfil={bonusProfil}
      bonusCalc={bonusCalc}
      canEditBonus={canEditBonus}
      isViewingSelf={isViewingSelf}
    />
  );
}
