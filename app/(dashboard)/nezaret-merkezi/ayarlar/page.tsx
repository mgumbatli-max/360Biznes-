import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Settings, ShieldCheck, Radar, Workflow, ChevronRight,
  Percent, AlertTriangle, Tag, RotateCcw, Trash2, CreditCard, DollarSign, Boxes,
  Clock, Bell, History as HistoryIcon, Save, RefreshCw,
} from "lucide-react";
import { auth } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NezaretMerkeziTabs } from "@/features/nezaret-merkezi/components/tabs";
import { getNezaretBadges } from "@/features/nezaret-merkezi/counts";
import { loadTesdiqCfg } from "@/features/tesdiq/settings";
import { updateTesdiqSettings, resetTesdiqSettings } from "@/features/tesdiq/settings-actions";
import { getRequestPermissions } from "@/lib/auth/get-permissions";

export const metadata: Metadata = { title: "Nəzarət Mərkəzi — Ayarlar" };

type RuleRow = {
  key: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  thresholdName?: string;
  thresholdLabel?: string;
  thresholdSuffix?: string;
};

export default async function NezaretAyarlarPage() {
  const session = await auth();
  if (!session?.user) return null;
  const icazeler = await getRequestPermissions();
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  const isOwnerOrAdmin =
    rolAd.includes("sahibkar") || rolAd.includes("owner") || rolAd.includes("admin");
  if (!isOwnerOrAdmin && (!icazeler.includes("nezaret.oxu") || !icazeler.includes("nezaret.ayarlar"))) {
    redirect("/tapshiriqlar");
  }

  const [badges, cfg] = await Promise.all([
    getNezaretBadges(),
    loadTesdiqCfg(),
  ]);

  const RULES: { rule: RuleRow; aktiv: boolean; threshold?: number; criticalName?: string; criticalValue?: number }[] = [
    {
      rule: { key: "endirim", label: "Endirim", desc: "Satışda böyük endirim", icon: Percent, iconColor: "text-amber-500",
        thresholdName: "endirim_limit_pct", thresholdLabel: "Limit", thresholdSuffix: "%" },
      aktiv: cfg.endirim_aktiv, threshold: cfg.endirim_limit_pct,
      criticalName: "endirim_kritik_pct", criticalValue: cfg.endirim_kritik_pct,
    },
    {
      rule: { key: "maya_alti", label: "Maya altı satış", desc: "Satış mayadan aşağı", icon: AlertTriangle, iconColor: "text-rose-500" },
      aktiv: cfg.maya_alti_aktiv,
    },
    {
      rule: { key: "qiymet_deyisdi", label: "Qiymət dəyişdi", desc: "Məhsulun qiyməti çox dəyişdi", icon: Tag, iconColor: "text-violet-500",
        thresholdName: "qiymet_deyisdi_pct", thresholdLabel: "Threshold", thresholdSuffix: "%" },
      aktiv: cfg.qiymet_deyisdi_aktiv, threshold: cfg.qiymet_deyisdi_pct,
    },
    {
      rule: { key: "qaytarma", label: "Qaytarma / refund", desc: "Böyük qaytarma əməliyyatı", icon: RotateCcw, iconColor: "text-amber-500",
        thresholdName: "qaytarma_limit_mebleg", thresholdLabel: "Threshold", thresholdSuffix: "₼" },
      aktiv: cfg.qaytarma_aktiv, threshold: cfg.qaytarma_limit_mebleg,
    },
    {
      rule: { key: "silme", label: "Silmə əməliyyatları", desc: "Yazıların silinməsi", icon: Trash2, iconColor: "text-rose-500",
        thresholdName: "silme_limit_mebleg", thresholdLabel: "Dəyər", thresholdSuffix: "₼" },
      aktiv: cfg.silme_aktiv, threshold: cfg.silme_limit_mebleg,
    },
    {
      rule: { key: "borc_limit", label: "Müştəri borc limiti", desc: "Kredit limitinin artırılması", icon: CreditCard, iconColor: "text-sky-500",
        thresholdName: "borc_artirma_pct", thresholdLabel: "Artım", thresholdSuffix: "%" },
      aktiv: cfg.borc_limit_aktiv, threshold: cfg.borc_artirma_pct,
    },
    {
      rule: { key: "xerc", label: "Böyük xərclər", desc: "Maliyyə bölməsindən böyük xərc", icon: DollarSign, iconColor: "text-orange-500",
        thresholdName: "xerc_limit_mebleg", thresholdLabel: "Threshold", thresholdSuffix: "₼" },
      aktiv: cfg.xerc_aktiv, threshold: cfg.xerc_limit_mebleg,
    },
    {
      rule: { key: "stok_duzelis", label: "Stok düzəlişi", desc: "Stok write-off / əl ilə düzəliş", icon: Boxes, iconColor: "text-cyan-500",
        thresholdName: "stok_duzelis_limit", thresholdLabel: "Dəyər", thresholdSuffix: "₼" },
      aktiv: cfg.stok_duzelis_aktiv, threshold: cfg.stok_duzelis_limit,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-slate-500 to-zinc-700">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ayarlar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Nəzarət Mərkəzinin bütün modulları üçün konfiqurasiya.
            </p>
          </div>
        </div>
      </header>

      <NezaretMerkeziTabs current="ayarlar" badges={badges} />

      {/* Quick links to module-specific settings */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SectionLink icon={Workflow} title="Avtomatlaşdırma qaydaları" desc="Trigger, şərt, əməliyyat" color="violet" href="/avtomatlasdirma" />
        <SectionLink icon={Radar} title="Xəbərdarlıq qaydaları" desc="Kateqoriya, threshold, eskalasiya" color="amber" href="/ayarlar/risk-qayda" />
        <SectionLink icon={HistoryIcon} title="Audit log" desc="Tarixçə nəzarəti" color="slate" href="/audit-log" />
      </div>

      <form
        action={async (fd: FormData) => {
          "use server";
          await updateTesdiqSettings(fd);
        }}
        className="space-y-4"
      >
        {/* Auto-approve */}
        <Card className="glass border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-start gap-3">
              <DollarSign className="mt-0.5 h-5 w-5 text-emerald-500" />
              <div>
                <h3 className="font-bold">Təsdiq mərkəzi — auto-təsdiq həddi</h3>
                <p className="text-xs text-muted-foreground">Bu məbləğdən aşağı tələblər avto-təsdiq olur. <code>0</code> = söndür.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="auto_approve_mebleg"
                defaultValue={cfg.auto_approve_mebleg}
                min={0}
                max={1000000}
                className="h-10 w-32 rounded-md border border-border bg-background px-3 text-right text-lg font-bold tabular-nums"
              />
              <span className="text-sm font-bold text-muted-foreground">₼</span>
            </div>
          </CardContent>
        </Card>

        {/* Rules table */}
        <Card className="glass">
          <CardContent className="p-0">
            <div className="border-b border-border/40 bg-secondary/30 px-4 py-2.5">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Təsdiq qaydaları (bütün modullara aid)
              </h3>
            </div>
            <div className="divide-y divide-border/30">
              {RULES.map(({ rule, aktiv, threshold, criticalName, criticalValue }) => {
                const Icon = rule.icon;
                return (
                  <div key={rule.key} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-secondary/20">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className={`grid h-9 w-9 place-items-center rounded-md bg-secondary/50 ${rule.iconColor}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold">{rule.label}</div>
                        <div className="text-[11px] text-muted-foreground">{rule.desc}</div>
                      </div>
                    </div>

                    {rule.thresholdName && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{rule.thresholdLabel}</span>
                        <input
                          type="number"
                          name={rule.thresholdName}
                          defaultValue={threshold}
                          min={0}
                          max={1000000}
                          className="h-8 w-20 rounded-md border border-border bg-background px-2 text-right text-sm font-bold tabular-nums"
                        />
                        <span className="text-xs text-muted-foreground">{rule.thresholdSuffix}</span>
                      </div>
                    )}

                    {criticalName && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-rose-500">Kritik</span>
                        <input
                          type="number"
                          name={criticalName}
                          defaultValue={criticalValue}
                          min={0}
                          max={100}
                          className="h-8 w-16 rounded-md border border-rose-500/30 bg-rose-500/5 px-2 text-right text-sm font-bold tabular-nums text-rose-500"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    )}

                    <Switch name={`${rule.key}_aktiv`} defaultChecked={aktiv} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Notification + SLA + Audit */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card className="glass">
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold">SLA və avto-bitmə</h3>
              </div>
              <div className="space-y-2">
                <MiniNum name="sla_saat" label="SLA cavab müddəti" defaultValue={cfg.sla_saat} suffix="saat" />
                <MiniNum name="expire_saat" label="Avto-ləğv" defaultValue={cfg.expire_saat} suffix="saat" hint="0 = heç vaxt" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold">Bildiriş kanalları</h3>
              </div>
              <div className="space-y-1.5">
                <CheckRow name="bildir_erp" label="ERP daxili" defaultChecked={cfg.bildir_erp} />
                <CheckRow name="bildir_email" label="Email" defaultChecked={cfg.bildir_email} />
                <CheckRow name="bildir_telegram" label="Telegram" defaultChecked={cfg.bildir_telegram} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center gap-2">
                <HistoryIcon className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-bold">Audit log</h3>
              </div>
              <p className="text-[10.5px] text-muted-foreground">Hər təsdiq/rədd əməliyyatı yazıya alınır.</p>
              <CheckRow name="audit_aktiv" label="Aktiv saxla" defaultChecked={cfg.audit_aktiv} />
            </CardContent>
          </Card>
        </div>

        {/* Sticky save */}
        <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-xl border border-border/60 bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="text-xs text-muted-foreground">
            Bütün dəyişikliklər <strong className="text-foreground">Yadda saxla</strong> düyməsi ilə tətbiq olunur.
          </div>
          <Button type="submit">
            <Save className="h-3.5 w-3.5" />
            Yadda saxla
          </Button>
        </div>
      </form>

      <form action={async () => { "use server"; await resetTesdiqSettings(); }} className="text-center">
        <button type="submit" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-rose-500">
          <RefreshCw className="h-3 w-3" />
          Təsdiq qaydalarını default-a qaytar
        </button>
      </form>
    </div>
  );
}

function SectionLink({
  icon: Icon, title, desc, color, href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string;
  color: "violet" | "amber" | "slate";
  href: string;
}) {
  const cls = {
    violet: "border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 text-violet-500",
    amber:  "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-500",
    slate:  "border-slate-500/30 bg-slate-500/5 hover:bg-slate-500/10 text-slate-500",
  }[color];
  return (
    <Link href={href} className={`group flex items-center gap-3 rounded-lg border p-3 transition ${cls}`}>
      <Icon className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-[10.5px] opacity-75">{desc}</div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-50 group-hover:translate-x-0.5 transition" />
    </Link>
  );
}

function Switch({ name, defaultChecked }: { name: string; defaultChecked?: boolean }) {
  return (
    <label className="inline-flex shrink-0 cursor-pointer items-center gap-2">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative inline-block h-5 w-9 rounded-full bg-secondary peer-checked:bg-emerald-500 transition-colors">
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

function MiniNum({ name, label, defaultValue, suffix, hint }: { name: string; label: string; defaultValue: number; suffix: string; hint?: string }) {
  return (
    <div>
      <label className="text-[10.5px] text-muted-foreground">{label}</label>
      <div className="mt-0.5 flex items-center gap-1.5">
        <input
          type="number"
          name={name}
          defaultValue={defaultValue}
          min={0}
          max={720}
          className="h-8 w-20 rounded-md border border-border bg-background px-2 text-right text-sm font-bold tabular-nums"
        />
        <span className="text-xs text-muted-foreground">{suffix}</span>
      </div>
      {hint && <p className="text-[9.5px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function CheckRow({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-xs hover:bg-secondary/30">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-3.5 w-3.5 rounded border-border" />
      <span>{label}</span>
    </label>
  );
}
