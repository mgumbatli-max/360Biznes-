import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users, CheckSquare, UserPlus, Lock } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SettingsTopNav } from "@/features/ayar/components/settings-top-nav";
import {
  RoleEditDialog,
  RoleCloneDialog,
  RoleDeleteButton,
} from "@/features/ayar/components/role-dialogs";
import { UserCreateDialog } from "@/features/ayar/components/user-create-dialog";
import { getRoleDetail, getAllPermissionsGrouped, getRoles } from "@/features/ayar/queries";
import { RoleEditor } from "@/features/ayar/components/role-editor";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export const metadata: Metadata = { title: "Rol detalı" };

async function getFiliallar() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.filiallar.findMany({
      where: { sahibkar_id: sahibkarId, aktiv: true },
      select: { id: true, ad: true },
      orderBy: { ad: "asc" },
    });
  });
}

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rolId = Number(id);
  if (!Number.isFinite(rolId) || rolId <= 0) notFound();

  const [rol, groups, allRoles, filiallar] = await Promise.all([
    getRoleDetail(rolId),
    getAllPermissionsGrouped(),
    getRoles(),
    getFiliallar(),
  ]);
  if (!rol) notFound();

  const activeUsers = rol.istifadeciler.filter((u) => u.aktiv).length;
  const rolesForCreate = allRoles.map((r) => ({ id: r.id, ad: r.ad, reng: r.reng, sistem: r.sistem }));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackButton fallback="/ayarlar/rollar" label="Rollar" />

      {/* Premium role header — color tape + identity + action stack */}
      <header className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-sm">
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ background: rol.reng ?? "var(--brand-gradient)" }}
        />
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 pl-7 md:p-6 md:pl-8">
          <div className="flex items-start gap-4">
            <div
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-base font-bold text-white shadow-md"
              style={{ background: rol.reng ?? "var(--brand-gradient)" }}
            >
              {rol.ad.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight capitalize md:text-3xl">{rol.ad}</h1>
                {rol.sistem ? (
                  <Badge variant="outline" className="text-[10px]"><Lock className="mr-0.5 h-2.5 w-2.5" /> Sistem rolu</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/40">Custom</Badge>
                )}
              </div>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {rol.aciqlamaq ?? <span className="italic">Təsvir yoxdur. Adı/təsviri dəyişmək üçün «Redaktə» düyməsindən istifadə et.</span>}
              </p>

              {/* Inline metrics */}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 font-semibold text-primary">
                  <CheckSquare className="h-3 w-3" /> {rol.icaze_ids.length} icazə
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary/60 px-2 py-1">
                  <Users className="h-3 w-3" /> {rol.istifadeciler.length} əməkdaş
                </span>
                {activeUsers !== rol.istifadeciler.length && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-500">
                    {activeUsers} aktiv
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action stack */}
          <div className="flex flex-wrap items-center gap-2">
            <UserCreateDialog
              roles={rolesForCreate}
              filiallar={filiallar}
              defaultRoleId={rol.id}
              trigger={
                <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
                  <UserPlus className="h-4 w-4" />
                  Əməkdaş təyin et
                </Button>
              }
            />
            <RoleEditDialog
              role={{ id: rol.id, ad: rol.ad, aciqlamaq: rol.aciqlamaq, reng: rol.reng, sistem: rol.sistem }}
            />
            <RoleCloneDialog sourceId={rol.id} sourceName={rol.ad} />
            <RoleDeleteButton
              roleId={rol.id}
              roleName={rol.ad}
              isSystem={!!rol.sistem}
              userCount={rol.istifadeciler.length}
            />
          </div>
        </div>
      </header>

      <SettingsTopNav />

      <RoleEditor
        rolId={rol.id}
        isSystem={!!rol.sistem}
        initialIds={rol.icaze_ids}
        groups={groups}
      />

      <Card className="glass">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" /> Bu rolda olan əməkdaşlar
              <Badge variant="outline" className="ml-1 h-5 text-[10px]">{rol.istifadeciler.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Bu rolu daşıyan istifadəçilər. Yeni əməkdaş üçün yuxarıdakı «Əməkdaş təyin et» düyməsini bas.
            </p>
          </div>
          {rol.istifadeciler.length === 0 ? null : (
            <UserCreateDialog
              roles={rolesForCreate}
              filiallar={filiallar}
              defaultRoleId={rol.id}
              trigger={
                <Button size="sm" variant="outline">
                  <UserPlus className="h-3.5 w-3.5" /> Əməkdaş əlavə et
                </Button>
              }
            />
          )}
        </CardHeader>
        <CardContent className="p-0">
          {rol.istifadeciler.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="font-medium">Bu rolda hələ əməkdaş yoxdur</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Yuxarıdakı <span className="font-semibold text-foreground">«Əməkdaş təyin et»</span> ilə yeni
                əməkdaş yarat və ya mövcud əməkdaşın rolunu dəyişdir.
              </p>
              <div className="mt-1 flex gap-2">
                <UserCreateDialog
                  roles={rolesForCreate}
                  filiallar={filiallar}
                  defaultRoleId={rol.id}
                  trigger={
                    <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
                      <UserPlus className="h-3.5 w-3.5" /> Əməkdaş təyin et
                    </Button>
                  }
                />
                <Button asChild size="sm" variant="outline">
                  <Link href="/ayarlar/istifadeci">Mövcud siyahıya bax</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {rol.istifadeciler.map((u) => (
                <Link
                  key={u.id}
                  href={`/ayarlar/istifadeci?selected=${u.id}`}
                  className={`group flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-secondary/40 ${
                    u.aktiv ? "" : "opacity-50"
                  }`}
                >
                  <div
                    className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: rol.reng ?? "#6366F1" }}
                  >
                    {(u.ad_soyad ?? u.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{u.ad_soyad ?? "—"}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${u.aktiv ? "border-success/30 text-success" : ""}`}
                  >
                    {u.aktiv ? "aktiv" : "passiv"}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
