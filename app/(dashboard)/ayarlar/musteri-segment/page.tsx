import type { Metadata } from "next";
import Link from "next/link";
import { Users, Sparkles, ArrowRight, Crown, ShoppingBag, Repeat, Clock, AlertTriangle, Heart } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsTopNav } from "@/features/ayar/components/settings-top-nav";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Müştəri seqmentasiyası" };
export const dynamic = "force-dynamic";

type SegmentRow = {
  id: number;
  kod: string;
  ad: string;
  tesvir: string | null;
  reng: string | null;
  sistem: boolean | null;
  aktiv: boolean | null;
  member_count: number;
};

// Sistem seqmentləri — DB-də yoxdursa avtomatik göstərilir
const SYSTEM_PRESETS: { kod: string; ad: string; tesvir: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { kod: "vip", ad: "VIP müştərilər", tesvir: "Cəmi 10.000 AZN+ alış", icon: Crown, tone: "amber" },
  { kod: "topdan", ad: "Topdan", tesvir: "1.000+ AZN bir əməliyyatda", icon: ShoppingBag, tone: "violet" },
  { kod: "tez_alan", ad: "Tez-tez alan", tesvir: "Ayda 3+ əməliyyat", icon: Repeat, tone: "emerald" },
  { kod: "uzun_almayan", ad: "Uzun almayan", tesvir: "Son 90 gündə alış yoxdur", icon: Clock, tone: "rose" },
  { kod: "borclu", ad: "Borclular", tesvir: "Açıq borcu olan müştərilər", icon: AlertTriangle, tone: "rose" },
  { kod: "loyal", ad: "Loyal", tesvir: "Loyalty kart aktiv", icon: Heart, tone: "pink" },
];

async function getSegments(): Promise<SegmentRow[]> {
  return withTenant(async () => {
    const segments = await prisma.musteri_seqment.findMany({
      orderBy: [{ sistem: "desc" }, { ad: "asc" }],
      select: {
        id: true,
        kod: true,
        ad: true,
        tesvir: true,
        reng: true,
        sistem: true,
        aktiv: true,
        _count: { select: { musteri_seqment_link: true } },
      },
    });
    return segments.map((s) => ({
      id: s.id,
      kod: s.kod,
      ad: s.ad,
      tesvir: s.tesvir,
      reng: s.reng,
      sistem: s.sistem,
      aktiv: s.aktiv,
      member_count: s._count.musteri_seqment_link,
    }));
  });
}

export default async function Page() {
  const segments = await getSegments();
  const existingCodes = new Set(segments.map((s) => s.kod));
  const missingPresets = SYSTEM_PRESETS.filter((p) => !existingCodes.has(p.kod));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <BackButton fallback="/ayarlar" label="Tənzimləmələr" />

      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-pink-500/15 text-pink-600">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tənzimləmələr</div>
          <h1 className="text-2xl font-bold tracking-tight">Müştəri seqmentasiyası</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Müştəriləri davranışına görə qruplaşdırma — kampaniya hədəfləməsi və avto-mesaj üçün.
          </p>
        </div>
      </header>

      <SettingsTopNav />

      <Card className="glass border-sky-500/30">
        <CardContent className="py-3">
          <div className="flex items-start gap-2 text-sm">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            <div>
              Yeni seqmentlər <strong>CRM → Seqmentlər</strong> bölməsində AI-əsaslı qurucu ilə yaradılır. Aşağıda sahibkarın bütün seqmentləri və müştəri sayı görünür.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {segments.map((s) => (
          <SegmentCard key={s.id} segment={s} />
        ))}
        {missingPresets.length > 0 && segments.length === 0 && (
          <Card className="glass col-span-full">
            <CardContent className="py-6 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <div className="mt-2 text-sm font-medium">Hələ heç bir seqment yoxdur</div>
              <p className="mt-1 text-xs text-muted-foreground">CRM-də ilk seqmenti yarat</p>
              <Link
                href="/crm"
                className="mt-3 inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
              >
                CRM-ə keç <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {missingPresets.length > 0 && segments.length > 0 && (
        <Card className="glass">
          <CardContent className="space-y-2 py-3">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sistem seqmentləri (hələ yaradılmayıb)
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {missingPresets.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.kod} className="flex items-center gap-2 rounded-md border border-dashed border-border/40 px-3 py-1.5">
                    <Icon className={`h-3.5 w-3.5 text-${p.tone}-600`} />
                    <div className="flex-1">
                      <div className="text-sm">{p.ad}</div>
                      <div className="text-[10.5px] text-muted-foreground">{p.tesvir}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="pt-1 text-[10.5px] text-muted-foreground">
              Bu sistem seqmentləri AI seqment qurucusunda preset olaraq mövcuddur — CRM-də «Yeni seqment» düyməsindən yarada bilərsən.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SegmentCard({ segment }: { segment: SegmentRow }) {
  const preset = SYSTEM_PRESETS.find((p) => p.kod === segment.kod);
  const Icon = preset?.icon ?? Users;
  return (
    <Link
      href={`/crm/seqmentler/${segment.id}`}
      className={cn(
        "block rounded-xl border bg-card/40 p-4 transition hover:border-primary/40 hover:bg-secondary/30",
        segment.aktiv === false && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="grid h-8 w-8 place-items-center rounded-lg"
            style={segment.reng ? { backgroundColor: `${segment.reng}20`, color: segment.reng } : undefined}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{segment.ad}</div>
            <div className="text-[10.5px] font-mono text-muted-foreground">{segment.kod}</div>
          </div>
        </div>
        {segment.sistem && (
          <Badge variant="outline" className="text-[10px]">sistem</Badge>
        )}
      </div>
      <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
        {segment.tesvir ?? preset?.tesvir ?? "—"}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs">
          <span className="font-bold tabular-nums">{segment.member_count.toLocaleString("az-AZ")}</span>
          <span className="ml-1 text-muted-foreground">müştəri</span>
        </div>
        {segment.aktiv ? (
          <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-600">aktiv</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">passiv</Badge>
        )}
      </div>
    </Link>
  );
}
