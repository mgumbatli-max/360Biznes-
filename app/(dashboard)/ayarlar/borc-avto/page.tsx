import type { Metadata } from "next";
import { Coins, Info, AlertTriangle } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getActiveUsers } from "@/features/crm/leadler-queries";
import { saveBorcAvtoSettings } from "@/features/ayarlar/borc-avto-actions";

export const metadata: Metadata = { title: "Borc avto-tapşırıq" };

async function loadCfg() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: "borc_avto" },
      select: { acar: true, deyer: true },
    });
    const cfg = Object.fromEntries(rows.map((r) => [r.acar, r.deyer ?? ""]));
    return {
      aktiv: cfg.aktiv === "1" || cfg.aktiv === "true",
      gun_threshold: Number(cfg.gun_threshold ?? "30") || 30,
      tekrar_gun: Number(cfg.tekrar_gun ?? "7") || 7,
      mesul_id: cfg.mesul_id || "",
    };
  });
}

export default async function BorcAvtoPage() {
  const [cfg, users] = await Promise.all([loadCfg(), getActiveUsers()]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-start gap-3">
        <BackButton fallback="/ayarlar" className="mt-1" />
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Coins className="h-5 w-5 text-amber-500" />
            Borc avto-tapşırıq
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Borcu olan müştərilər üçün avtomatik tapşırıq yaratma
          </p>
        </div>
      </header>

      {/* İzah */}
      <Card className="glass border-sky-500/30 bg-sky-500/5">
        <CardContent className="flex items-start gap-2 py-3 text-[11px]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
          <div className="space-y-1 text-muted-foreground">
            <p>
              <strong className="text-foreground">Necə işləyir?</strong>{" "}
              Hər gün dashboard açanda sistem yoxlayır:
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>Borcu olan və müəyyən gündən artıq olan müştərilər tapılır</li>
              <li>Hər biri üçün <strong className="text-foreground">avto tapşırıq</strong> yaranır</li>
              <li>Tapşırıq seçilmiş əməkdaşa təyin olunur (və ya satışın yaradanına)</li>
              <li>Deadline: 3 gün sonra</li>
              <li>Yüksək borc (1000+ ₼) → prioritet yüksək</li>
              <li>Son 7 gündə yaranmış tapşırıq varsa, yenisi yaranmır (dublikat yox)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <form
        action={async (fd: FormData) => {
          "use server";
          await saveBorcAvtoSettings(fd);
        }}
      >
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Konfiqurasiya</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Aktiv */}
            <div className="flex items-center justify-between rounded-md border border-border bg-card/40 px-3 py-2.5">
              <div>
                <Label className="text-sm font-bold">Aktiv</Label>
                <p className="text-[10.5px] text-muted-foreground">
                  Söndürsən, heç bir avto-tapşırıq yaranmır
                </p>
              </div>
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  name="aktiv"
                  defaultChecked={cfg.aktiv}
                  className="peer sr-only"
                />
                <span className="relative inline-block h-5 w-9 rounded-full bg-secondary peer-checked:bg-emerald-500 transition-colors">
                  <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                </span>
              </label>
            </div>

            {/* Gün eşiyi */}
            <div>
              <Label className="text-xs font-bold">Borc gün eşiyi</Label>
              <p className="mb-1.5 text-[10.5px] text-muted-foreground">
                Son alışdan bu qədər gün keçibsə tapşırıq yaranır
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="gun_threshold"
                  defaultValue={cfg.gun_threshold}
                  min={1}
                  max={365}
                  className="h-10 w-32 rounded-md border border-input bg-background px-3 text-right text-sm font-bold tabular-nums"
                />
                <span className="text-sm text-muted-foreground">gün</span>
              </div>
            </div>

            {/* Təkrar müddəti */}
            <div>
              <Label className="text-xs font-bold">Təkrar qadağa müddəti</Label>
              <p className="mb-1.5 text-[10.5px] text-muted-foreground">
                Son tapşırıqdan bu qədər gün keçməyincə yenisi yaranmır (dublikat qoru)
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="tekrar_gun"
                  defaultValue={cfg.tekrar_gun}
                  min={1}
                  max={90}
                  className="h-10 w-32 rounded-md border border-input bg-background px-3 text-right text-sm font-bold tabular-nums"
                />
                <span className="text-sm text-muted-foreground">gün</span>
              </div>
            </div>

            {/* Default məsul */}
            <div>
              <Label className="text-xs font-bold">Default məsul əməkdaş</Label>
              <p className="mb-1.5 text-[10.5px] text-muted-foreground">
                Boş qoysan, satışın yaradanı (kassir / satıcı) təyin olunur
              </p>
              <select
                name="mesul_id"
                defaultValue={cfg.mesul_id}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Avto (satışın yaradanı) —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.ad_soyad}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end">
          <Button type="submit">Yadda saxla</Button>
        </div>
      </form>

      {/* Xəbərdarlıq */}
      <Card className="glass border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-2 py-3 text-[11px]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <div className="text-muted-foreground">
            <p>
              <strong className="text-foreground">Diqqət:</strong> Yaranan tapşırıqlar əməkdaşların
              KPI-sinə təsir edir. Vaxtında bitirilməsə davamiyyət/tapşırıq metriklərinə
              mənfi düşür. Sahibkar olaraq sən bu qaydaları ədalətli təyin et.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
