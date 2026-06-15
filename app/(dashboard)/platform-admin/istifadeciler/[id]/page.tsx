import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  User as UserIcon,
  Mail,
  Building2,
  ShieldCheck,
  Clock,
  Calendar,
  CheckCircle2,
  MinusCircle,
  Trash2,
  Activity,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/lib/platform-admin/guard";
import { getGlobalUserDetail, getUserAuditLog } from "@/features/platform-admin/queries";
import { AuditList } from "@/features/platform-admin/components/audit-list";
import { UserAdminActions } from "@/features/platform-admin/components/user-admin-actions";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "İstifadəçi detayı" };

export default async function IstifadeciDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;

  const user = await getGlobalUserDetail(id);
  if (!user) notFound();

  const userAudit = await getUserAuditLog(id, 80);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton fallback="/platform-admin/istifadeciler" className="mt-1" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <UserIcon className="h-5 w-5 text-primary-light" />
              <h1 className="text-2xl font-bold tracking-tight">{user.ad_soyad}</h1>
              <StatusBadge aktiv={user.aktiv} deletedAt={user.deleted_at} />
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> {user.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UserAdminActions
            user={{
              id: user.id,
              ad_soyad: user.ad_soyad,
              aktiv: user.aktiv,
              deleted_at: user.deleted_at,
            }}
          />
        </div>
      </header>

      {/* Qısa məlumat */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
            Məlumat
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
          <Row icon={Building2} label="Şirkət">
            <Link
              href={`/platform-admin/tenantlar/${user.tenant_id}`}
              className="text-primary-light transition hover:underline"
            >
              {user.tenant_ad}
            </Link>
          </Row>
          <Row icon={ShieldCheck} label="Rol">
            {user.rol_ad}
          </Row>
          <Row icon={Clock} label="Son giriş">
            {user.son_giris
              ? formatDate(user.son_giris, { dateStyle: "short", timeStyle: "short" })
              : "heç vaxt"}
          </Row>
          <Row icon={Calendar} label="Yaradıldı">
            {formatDate(user.yaradildi, { dateStyle: "short", timeStyle: "short" })}
          </Row>
          {user.telefon ? (
            <Row icon={UserIcon} label="Telefon">
              {user.telefon}
            </Row>
          ) : null}
        </CardContent>
      </Card>

      {/* Fəaliyyət tarixçəsi (audit) */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary-light" /> Fəaliyyət tarixçəsi (audit)
          </CardTitle>
          <Badge variant="outline">{userAudit.length}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <AuditList
            rows={userAudit}
            showUser={false}
            emptyText="Bu istifadəçinin qeydi yoxdur"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ aktiv, deletedAt }: { aktiv: boolean; deletedAt: Date | null }) {
  if (deletedAt) {
    return (
      <Badge variant="outline" className="gap-1 border-danger/30 bg-danger/15 text-danger text-[10px]">
        <Trash2 className="h-3 w-3" /> Silinmiş
      </Badge>
    );
  }
  if (aktiv) {
    return (
      <Badge variant="outline" className="gap-1 border-success/30 bg-success/15 text-success text-[10px]">
        <CheckCircle2 className="h-3 w-3" /> Aktiv
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-border bg-secondary text-muted-foreground text-[10px]">
      <MinusCircle className="h-3 w-3" /> Deaktiv
    </Badge>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="flex-1 font-medium">{children}</span>
    </div>
  );
}
