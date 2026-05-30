import type { Metadata } from "next";
import { Percent, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { MpKomisyonDialog } from "@/features/ayarlar/components/mp-komisyon-dialog";

export const metadata: Metadata = { title: "Marketplace komissiya" };

const PLATFORM_DEFAULTS: Array<{ platform: string; faiz: number; emoji: string; aciqlama: string }> = [
  { platform: "bolt", faiz: 25, emoji: "🚖", aciqlama: "Bolt Food" },
  { platform: "wolt", faiz: 30, emoji: "🛵", aciqlama: "Wolt çatdırılma" },
  { platform: "yango", faiz: 22, emoji: "🚙", aciqlama: "Yango Deli" },
  { platform: "progo", faiz: 18, emoji: "📦", aciqlama: "ProGo marketplace" },
  { platform: "tapaz", faiz: 5, emoji: "🛒", aciqlama: "Tap.az" },
];

type MpAyarConfig = {
  faiz?: number;
  odenis_gun?: number;
  default_edv?: number;
  valyuta?: string;
};

async function getMarketplaceCommissions() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [rows, ayarRows] = await Promise.all([
      prisma.marketplace_komisyon.findMany({
        orderBy: { platform: "asc" },
        include: { kateqoriyalar: { select: { ad: true } } },
      }),
      prisma.ayarlar.findMany({
        where: { sahibkar_id: sahibkarId, qrup: "mp_komisyon" },
      }),
    ]);
    const ayarByPlatform = new Map<string, MpAyarConfig>();
    for (const a of ayarRows) {
      if (!a.deyer) continue;
      try {
        const parsed = JSON.parse(a.deyer) as MpAyarConfig;
        ayarByPlatform.set(a.acar, parsed);
      } catch {
        // skip
      }
    }
    return { rows, ayarByPlatform };
  });
}

export default async function AyarMpKomisyonPage() {
  const { rows, ayarByPlatform } = await getMarketplaceCommissions();

  // Group existing config by platform
  const byPlatform = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byPlatform.get(r.platform) ?? [];
    arr.push(r);
    byPlatform.set(r.platform, arr);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Marketplace komissiya</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-platform komissiya faizləri. Sistemdə qeyd olunmamış platformalar default qiymətdən istifadə edir.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {PLATFORM_DEFAULTS.map((p) => {
          const configured = byPlatform.get(p.platform) ?? [];
          const def = configured.find((c) => c.default_qayda);
          const ayarCfg = ayarByPlatform.get(p.platform);
          const efektivFaiz =
            ayarCfg?.faiz !== undefined ? Number(ayarCfg.faiz) : def ? Number(def.faiz) : p.faiz;
          const valyuta = ayarCfg?.valyuta ?? "AZN";

          return (
            <Card key={p.platform} className="glass">
              <CardContent className="space-y-3 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{p.emoji}</span>
                    <div>
                      <h3 className="font-semibold capitalize">{p.platform}</h3>
                      <p className="text-xs text-muted-foreground">{p.aciqlama}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1 text-2xl font-bold tabular-nums">
                      <Percent className="h-4 w-4 text-muted-foreground" />
                      {efektivFaiz.toFixed(1)}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground">
                      {ayarCfg ? `${valyuta} · ödəniş günü ${ayarCfg.odenis_gun ?? "—"}` : def ? "konfiqurasiya edilib" : `default (${p.faiz}%)`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2">
                  <div className="text-[10.5px] text-muted-foreground">
                    ƏDV: <span className="font-semibold text-foreground">{ayarCfg?.default_edv ?? 18}%</span>
                  </div>
                  <MpKomisyonDialog
                    platform={p.platform}
                    label={p.aciqlama}
                    defaultFaiz={p.faiz}
                    current={ayarCfg}
                  />
                </div>

                {configured.length > 0 && (
                  <div className="space-y-1 border-t border-border/40 pt-2 text-xs">
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Kateqoriya qaydaları</div>
                    {configured
                      .filter((c) => !c.default_qayda)
                      .map((c) => (
                        <div key={c.id} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{c.kateqoriyalar?.ad ?? "—"}</span>
                          <Badge variant="outline" className="tabular-nums">{Number(c.faiz).toFixed(1)}%</Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="glass">
        <CardContent className="space-y-2 py-4 text-sm">
          <h3 className="flex items-center gap-2 font-semibold">
            <Store className="h-4 w-4 text-primary-light" /> Ödəniş qaydaları
          </h3>
          <ul className="ml-5 list-disc space-y-1 text-xs text-muted-foreground">
            <li>Marketplace komissiyası satışdan dərhal tutulur.</li>
            <li>Çıxarış (payout) hər həftə cümə günü.</li>
            <li>Qaytarmada komissiya geri qaytarılmır (platform qaydası).</li>
            <li>Bonus və promosyon endirimləri komissiya bazasından çıxılır.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
