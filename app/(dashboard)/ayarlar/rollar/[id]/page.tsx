import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Shield, Users, CheckSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsTopNav } from "@/features/ayar/components/settings-top-nav";
import {
  RoleEditDialog,
  RoleCloneDialog,
  RoleDeleteButton,
} from "@/features/ayar/components/role-dialogs";
import { getRoleDetail, getAllPermissionsGrouped } from "@/features/ayar/queries";
import { RolePermissionsMatrix } from "@/features/ayar/components/role-permissions-matrix";

export const metadata: Metadata = { title: "Rol detalı" };
export const dynamic = "force-dynamic";

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rolId = Number(id);
  if (!Number.isFinite(rolId) || rolId <= 0) notFound();

  const [rol, groups] = await Promise.all([getRoleDetail(rolId), getAllPermissionsGrouped()]);
  if (!rol) notFound();

  const activeUsers = rol.istifadeciler.filter((u) => u.aktiv).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        href="/ayarlar/rollar"
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Rollar
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white text-base font-bold shadow"
            style={{ background: rol.reng ?? "var(--brand-gradient)" }}
          >
            {rol.ad.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight capitalize">{rol.ad}</h1>
              {rol.sistem ? (
                <Badge variant="outline" className="text-[10px]">sistem</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-primary border-primary/40">custom</Badge>
              )}
            </div>
            {rol.aciqlamaq && (
              <p className="mt-0.5 text-sm text-muted-foreground">{rol.aciqlamaq}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      </header>

      <SettingsTopNav />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="glass">
          <CardContent className="py-3">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">İcazə sayı</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-primary">{rol.icaze_ids.length}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="py-3">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">İstifadəçi (cəm)</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{rol.istifadeciler.length}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="py-3">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Aktiv istifadəçi</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-500">{activeUsers}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="py-3">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Növ</div>
            <div className="mt-1 text-base font-semibold">{rol.sistem ? "Sistem (kilidli)" : "Custom"}</div>
          </CardContent>
        </Card>
      </section>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckSquare className="h-4 w-4" /> İcazə matrisi
            {rol.sistem && (
              <Badge variant="outline" className="ml-2 text-[10px] text-amber-500 border-amber-500/40">
                sistem rolu — yalnız oxuma
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RolePermissionsMatrix
            rolId={rol.id}
            isSystem={!!rol.sistem}
            initialIds={rol.icaze_ids}
            groups={groups}
          />
        </CardContent>
      </Card>

      {rol.istifadeciler.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Bu roldakı istifadəçilər ({rol.istifadeciler.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {rol.istifadeciler.map((u) => (
                <Link
                  key={u.id}
                  href={`/ayarlar/istifadeci?selected=${u.id}`}
                  className={`flex items-center justify-between gap-3 px-4 py-2 text-sm transition hover:bg-secondary/40 ${
                    u.aktiv ? "" : "opacity-50"
                  }`}
                >
                  <div>
                    <div className="font-medium">{u.ad_soyad ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
