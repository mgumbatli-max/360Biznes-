import type { Metadata } from "next";
import { Shield, Users, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RoleCreateDialog } from "@/features/ayar/components/role-dialogs";
import { RoleListFilter } from "@/features/ayar/components/role-list-filter";
import { getRoles } from "@/features/ayar/queries";

export const metadata: Metadata = { title: "Rollar və icazələr" };

export default async function RollarPage() {
  const rows = await getRoles();

  const sistem = rows.filter((r) => r.sistem);
  const custom = rows.filter((r) => !r.sistem);
  const totalUsers = rows.reduce((s, r) => s + r._count.istifadeciler, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Premium header — gradient halo + clear intent */}
      <header className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 px-5 py-5 md:px-7 md:py-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.35), transparent 60%)" }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl text-white shadow-sm" style={{ background: "var(--brand-gradient)" }}>
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Rollar və icazələr</h1>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Hər rolun icazələri bir yerdə. Adı dəyiş, icazələri seç — sonra istənilən əməkdaşı bu rola təyin et.
              </p>
            </div>
          </div>
          <RoleCreateDialog />
        </div>

        {/* Inline stats — header daxilində kompakt */}
        <div className="relative mt-5 grid grid-cols-3 gap-2 border-t border-border/40 pt-4 text-xs">
          <InlineStat icon={Shield} label="Ümumi rol" value={rows.length} />
          <InlineStat icon={Sparkles} label="Custom rol" value={custom.length} tone="primary" />
          <InlineStat icon={Users} label="İstifadəçi" value={totalUsers} />
        </div>
      </header>

      <RoleListFilter
        roles={rows.map((r) => ({
          id: r.id,
          ad: r.ad,
          aciqlamaq: r.aciqlamaq,
          reng: r.reng,
          sistem: r.sistem,
          _count: { istifadeciler: r._count.istifadeciler, rol_icazeleri: r._count.rol_icazeleri },
        }))}
      />

      {custom.length === 0 && (
        <Card className="glass border-dashed">
          <CardContent className="py-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-3 font-semibold">Hələ öz rolun yoxdur</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Yuxarıdakı <span className="font-medium text-foreground">«Yeni rol»</span> düyməsi ilə hazır şablondan
              başla — saniyələr ərzində Kassir, Anbardar, Menecer tipli rollar gəlir.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InlineStat({ icon: Icon, label, value, tone }: { icon: typeof Shield; label: string; value: number; tone?: "primary" }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-background/40 px-3 py-2 backdrop-blur">
      <div className={`grid h-7 w-7 place-items-center rounded-md ${tone === "primary" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className={`text-base font-bold tabular-nums leading-none ${tone === "primary" ? "text-primary" : ""}`}>{value}</div>
        <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
