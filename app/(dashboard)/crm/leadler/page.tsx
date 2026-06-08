import type { Metadata } from "next";
import { CrmSubNav } from "@/components/crm-subnav";
import { LeadDialog } from "@/features/crm/components/lead-dialog";
import { LeadsView } from "@/features/crm/components/leads-view";
import { getLeadsByStage, getLeadsListRows, getActiveUsers } from "@/features/crm/leadler-queries";
import type { LeadStatus } from "@/features/crm/types";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { isCrmPrivileged } from "@/features/crm/access-guard";

export const metadata: Metadata = { title: "Leadlər" };

type SearchParams = Promise<{
  view?: string;
  q?: string;
  status?: string;
  menecer?: string;
  menbe?: string;
}>;

export default async function LeadlerPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filter = {
    menecer_id: sp.menecer || null,
    menbe: sp.menbe || null,
  };
  const [stages, listRows, users, session, icazeler] = await Promise.all([
    getLeadsByStage(filter),
    getLeadsListRows({
      q: sp.q,
      status: (sp.status as LeadStatus) || null,
      menecer_id: filter.menecer_id,
      menbe: filter.menbe,
    }),
    getActiveUsers(),
    auth(),
    getRequestPermissions(),
  ]);
  const privileged = isCrmPrivileged(session?.user?.rol_ad ?? null);
  const canEdit = privileged || icazeler.includes("lead.idare");
  const canConvert = privileged || icazeler.includes("lead.idare") || icazeler.includes("satis.yarat");
  const canDelete = privileged || icazeler.includes("lead.sil") || icazeler.includes("lead.idare");

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <CrmSubNav active="/crm/leadler" />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">Yeni → Əlaqə → Müzakirə → Təklif → Qazanıldı/İtirildi</p>
        </div>
        <LeadDialog users={users} />
      </header>

      <LeadsView
        stages={stages}
        listRows={listRows}
        users={users}
        canEdit={canEdit}
        canConvert={canConvert}
        canDelete={canDelete}
      />
    </div>
  );
}
