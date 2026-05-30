import type { Metadata } from "next";
import Link from "next/link";
import { Shield, Users, CheckSquare, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoleCreateDialog } from "@/features/ayar/components/role-dialogs";
import { getRoles } from "@/features/ayar/queries";

export const metadata: Metadata = { title: "Rollar və icazələr" };

export default async function RollarPage() {
  const rows = await getRoles();

  const sistem = rows.filter((r) => r.sistem);
  const custom = rows.filter((r) => !r.sistem);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rollar və icazələr</h1>
            <p className="text-sm text-muted-foreground">
              Rol matrisi, hər rol üçün modul və əməliyyat icazələri
            </p>
          </div>
        </div>
        <RoleCreateDialog />
      </header>


      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Ümumi rol" value={rows.length} />
        <Stat label="Sistem rolu" value={sistem.length} tone="muted" />
        <Stat label="Custom rol" value={custom.length} tone="primary" />
        <Stat
          label="Cəmi istifadəçi"
          value={rows.reduce((s, r) => s + r._count.istifadeciler, 0)}
        />
      </div>

      {sistem.length > 0 && (
        <RoleSection title="Sistem rolları" desc="Sabit rollar — silinə bilməz, icazələri «kilidlidir»" roles={sistem} />
      )}
      {custom.length > 0 ? (
        <RoleSection title="Custom rollar" desc="Sizin yaratdığınız rollar — tam redaktə olunan" roles={custom} />
      ) : (
        <Card className="glass border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Shield className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="font-semibold">Hələ custom rol yoxdur</p>
            <p className="mt-1">«+ Yeni rol» düyməsi ilə hazır şablondan və ya boş rol yaradın.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RoleSection({
  title,
  desc,
  roles,
}: {
  title: string;
  desc: string;
  roles: Awaited<ReturnType<typeof getRoles>>;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {roles.map((r) => (
          <Link key={r.id} href={`/ayarlar/rollar/${r.id}`} className="block">
            <Card className="glass transition hover:border-primary/40 hover:shadow">
              <CardContent className="space-y-2 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-bold text-white shadow"
                      style={{ background: r.reng ?? "#6366F1" }}
                    >
                      {r.ad.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold capitalize">{r.ad}</h3>
                        {r.sistem && (
                          <Badge variant="outline" className="text-[10px]">
                            sistem
                          </Badge>
                        )}
                      </div>
                      {r.aciqlamaq && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.aciqlamaq}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-4 border-t border-border/40 pt-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {r._count.istifadeciler} istifadəçi
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckSquare className="h-3 w-3" />
                    {r._count.rol_icazeleri} icazə
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "primary" | "muted";
}) {
  const toneClass = tone === "primary" ? "text-primary" : tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="glass rounded-xl border border-border/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
