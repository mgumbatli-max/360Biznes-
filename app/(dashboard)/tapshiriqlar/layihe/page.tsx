import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Folder, ArrowRight, Plus, FolderPlus } from "lucide-react";
import { auth } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskSectionTabs } from "@/features/tapshiriqlar/components/section-tabs";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tapşırıqlar — Layihələr" };

type LayiheRow = {
  layihe: string;
  total: number;
  aktiv: number;
  tamamlanan: number;
  gecikmis: number;
};

async function getLayiheler(): Promise<LayiheRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<LayiheRow[]>`
      SELECT COALESCE(NULLIF(TRIM(layihe), ''), '—') AS layihe,
             COUNT(*)::int AS total,
             SUM(CASE WHEN status NOT IN ('tamamlandi','legv') THEN 1 ELSE 0 END)::int AS aktiv,
             SUM(CASE WHEN status = 'tamamlandi' THEN 1 ELSE 0 END)::int AS tamamlanan,
             SUM(CASE WHEN deadline < NOW() AND status NOT IN ('tamamlandi','legv') THEN 1 ELSE 0 END)::int AS gecikmis
        FROM tapshiriqlar
       WHERE sahibkar_id = ${sahibkarId}::uuid
       GROUP BY 1
       ORDER BY aktiv DESC, total DESC
    `.catch(() => [] as LayiheRow[]);
    return rows.map((r) => ({ ...r, total: Number(r.total), aktiv: Number(r.aktiv), tamamlanan: Number(r.tamamlanan), gecikmis: Number(r.gecikmis) }));
  });
}

export default async function LayiheTapshiriqPage() {
  const session = await auth();
  if (!session?.user) return null;
  const icazeler = await getRequestPermissions();
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  const isOwnerOrAdmin =
    rolAd.includes("sahibkar") || rolAd.includes("owner") || rolAd.includes("admin");
  if (!isOwnerOrAdmin && !icazeler.includes("tapshiriq.layihe")) {
    redirect("/tapshiriqlar");
  }

  const layiheler = await getLayiheler();
  const withLayihe = layiheler.filter((l) => l.layihe !== "—");
  const noLayihe = layiheler.find((l) => l.layihe === "—");

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-primary to-violet-500">
          <Folder className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Layihələr</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tapşırıqlar layihə adı üzrə qruplaşdırılıb. Bir layihənin bütün tapşırıqlarını birlikdə izləyin.
          </p>
        </div>
      </header>

      <TaskSectionTabs current="layihe" />

      {withLayihe.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-16 text-center">
            <FolderPlus className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <h3 className="font-semibold">Layihə yoxdur</h3>
            <p className="mt-1 max-w-md mx-auto text-sm text-muted-foreground">
              Yeni tapşırıq yaratdıqda &ldquo;Layihə&rdquo; sahəsini doldurun — eyni adda olan bütün tapşırıqlar burada birləşir.
            </p>
            <Link href="/tapshiriqlar" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <Plus className="h-3 w-3" />
              Tapşırıq yarat
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {withLayihe.map((l) => {
            const completionRate = l.total > 0 ? (l.tamamlanan / l.total) * 100 : 0;
            return (
              <Link key={l.layihe} href={`/tapshiriqlar?q=${encodeURIComponent(l.layihe)}`}>
                <Card className="glass transition hover:-translate-y-0.5 hover:border-primary/40">
                  <CardContent className="space-y-3 py-4">
                    <header className="flex items-start gap-2">
                      <Folder className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-bold">{l.layihe}</h3>
                        <p className="text-[10.5px] text-muted-foreground">{l.total} tapşırıq</p>
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </header>

                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-500">
                        {l.aktiv} aktiv
                      </Badge>
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-500">
                        {l.tamamlanan} tamam
                      </Badge>
                      {l.gecikmis > 0 && (
                        <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-500">
                          {l.gecikmis} gecik.
                        </Badge>
                      )}
                    </div>

                    {/* Completion bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>İrəliləyiş</span>
                        <span className="font-bold tabular-nums">{completionRate.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary/40">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            completionRate >= 80 ? "bg-emerald-500" :
                            completionRate >= 50 ? "bg-amber-500" :
                            "bg-rose-500"
                          )}
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {noLayihe && noLayihe.total > 0 && (
        <Card className="glass border-dashed">
          <CardContent className="flex items-center justify-between py-3">
            <div>
              <h3 className="text-sm font-bold">Layihəsiz tapşırıqlar</h3>
              <p className="text-[10.5px] text-muted-foreground">{noLayihe.total} tapşırıq layihəyə daxil edilməyib</p>
            </div>
            <Link href="/tapshiriqlar?scope=hamisi" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Bax <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
