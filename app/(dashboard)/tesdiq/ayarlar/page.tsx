import type { Metadata } from "next";
import Link from "next/link";
import {
  Settings, ArrowLeft, RefreshCw, Save,
  Percent, AlertTriangle, Tag, RotateCcw, Trash2, CreditCard, DollarSign, Boxes,
  Clock, Bell, History, BarChart3,
  ShoppingCart, Receipt, Package, ArrowLeftRight, Users, ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadTesdiqCfg } from "@/features/tesdiq/settings";
import { updateTesdiqSettings, resetTesdiqSettings } from "@/features/tesdiq/settings-actions";
import { getActiveUsers } from "@/features/crm/leadler-queries";

export const metadata: Metadata = { title: "Təsdiq mərkəzi — Ayarlar" };

type RuleConfig = {
  key: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  thresholdName?: string;
  thresholdLabel?: string;
  thresholdSuffix?: string;
};

function parseCsvSet(s: string | null | undefined): Set<string> {
  return new Set((s ?? "").split(",").map((x) => x.trim()).filter(Boolean));
}

export default async function TesdiqAyarlarPage() {
  const [cfg, users] = await Promise.all([loadTesdiqCfg(), getActiveUsers()]);
  const selectedApproverIds = parseCsvSet(cfg.tesdiq_eden_idler);
  // Per-kind təsdiq edənlər
  const perKind = {
    alis: parseCsvSet(cfg.tesdiq_eden_alis_idler),
    satis: parseCsvSet(cfg.tesdiq_eden_satis_idler),
    mehsul: parseCsvSet(cfg.tesdiq_eden_mehsul_idler),
    ticaret: parseCsvSet(cfg.tesdiq_eden_ticaret_idler),
    endirim: parseCsvSet(cfg.tesdiq_eden_endirim_idler),
    qaytarma: parseCsvSet(cfg.tesdiq_eden_qaytarma_idler),
    xerc: parseCsvSet(cfg.tesdiq_eden_xerc_idler),
    silme: parseCsvSet(cfg.tesdiq_eden_silme_idler),
    qiymet: parseCsvSet(cfg.tesdiq_eden_qiymet_idler),
    stok: parseCsvSet(cfg.tesdiq_eden_stok_idler),
    borc: parseCsvSet(cfg.tesdiq_eden_borc_idler),
    maya: parseCsvSet(cfg.tesdiq_eden_maya_idler),
  };
  const anyFourEyesActive =
    cfg.alis_qaime_aktiv ||
    cfg.satis_qaime_aktiv ||
    cfg.mehsul_yaratma_aktiv ||
    cfg.ticaret_emeliyyat_aktiv;
  const showEmptyApproverWarning = anyFourEyesActive && selectedApproverIds.size === 0;

  const RULES: { rule: RuleConfig; aktiv: boolean; threshold?: number; criticalName?: string; criticalValue?: number }[] = [
    {
      rule: {
        key: "endirim", label: "Endirim",
        desc: "Satışda böyük endirim sahibkar təsdiqi tələb edir",
        icon: Percent, iconColor: "text-amber-500",
        thresholdName: "endirim_limit_pct", thresholdLabel: "Limit", thresholdSuffix: "%",
      },
      aktiv: cfg.endirim_aktiv,
      threshold: cfg.endirim_limit_pct,
      criticalName: "endirim_kritik_pct",
      criticalValue: cfg.endirim_kritik_pct,
    },
    {
      rule: {
        key: "maya_alti", label: "Maya altı satış",
        desc: "Satış qiyməti mayadan aşağı olduqda",
        icon: AlertTriangle, iconColor: "text-rose-500",
      },
      aktiv: cfg.maya_alti_aktiv,
    },
    {
      rule: {
        key: "qiymet_deyisdi", label: "Qiymət dəyişikliyi",
        desc: "Məhsulun qiyməti çox dəyişəndə",
        icon: Tag, iconColor: "text-violet-500",
        thresholdName: "qiymet_deyisdi_pct", thresholdLabel: "Threshold", thresholdSuffix: "%",
      },
      aktiv: cfg.qiymet_deyisdi_aktiv,
      threshold: cfg.qiymet_deyisdi_pct,
    },
    {
      rule: {
        key: "qaytarma", label: "Qaytarma / refund",
        desc: "Böyük məbləğli qaytarma əməliyyatları",
        icon: RotateCcw, iconColor: "text-amber-500",
        thresholdName: "qaytarma_limit_mebleg", thresholdLabel: "Threshold", thresholdSuffix: "₼",
      },
      aktiv: cfg.qaytarma_aktiv,
      threshold: cfg.qaytarma_limit_mebleg,
    },
    {
      rule: {
        key: "silme", label: "Silmə əməliyyatları",
        desc: "Yazıların / sənədlərin silinməsi",
        icon: Trash2, iconColor: "text-rose-500",
        thresholdName: "silme_limit_mebleg", thresholdLabel: "Dəyər", thresholdSuffix: "₼",
      },
      aktiv: cfg.silme_aktiv,
      threshold: cfg.silme_limit_mebleg,
    },
    {
      rule: {
        key: "borc_limit", label: "Müştəri borc limiti",
        desc: "Müştərinin kreditinin artırılması",
        icon: CreditCard, iconColor: "text-sky-500",
        thresholdName: "borc_artirma_pct", thresholdLabel: "Artım", thresholdSuffix: "%",
      },
      aktiv: cfg.borc_limit_aktiv,
      threshold: cfg.borc_artirma_pct,
    },
    {
      rule: {
        key: "xerc", label: "Böyük xərclər",
        desc: "Maliyyə bölməsindən böyük xərc",
        icon: DollarSign, iconColor: "text-orange-500",
        thresholdName: "xerc_limit_mebleg", thresholdLabel: "Threshold", thresholdSuffix: "₼",
      },
      aktiv: cfg.xerc_aktiv,
      threshold: cfg.xerc_limit_mebleg,
    },
    {
      rule: {
        key: "stok_duzelis", label: "Stok düzəlişi",
        desc: "Stok write-off / əl ilə düzəliş",
        icon: Boxes, iconColor: "text-cyan-500",
        thresholdName: "stok_duzelis_limit", thresholdLabel: "Dəyər", thresholdSuffix: "₼",
      },
      aktiv: cfg.stok_duzelis_aktiv,
      threshold: cfg.stok_duzelis_limit,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-slate-500 to-zinc-700">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Təsdiq qaydaları</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hansı əməliyyatlar sahibkar təsdiqi tələb edir. Bir cədvəldə — tək yerdə.
            </p>
          </div>
        </div>
        <SubNav />
      </header>

      {/* İzahedici header — icazə vs təsdiq fərqi */}
      <Card className="glass border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="text-[11.5px] leading-relaxed">
            <p>
              <strong className="text-foreground">İcazə</strong> və{" "}
              <strong className="text-foreground">Təsdiq</strong> bir-birindən
              fərqli şeylərdir:
            </p>
            <ul className="mt-1 list-disc pl-4 text-muted-foreground">
              <li>
                <Link href="/ayarlar/rollar" className="font-semibold text-foreground underline">
                  İcazə / Rol
                </Link>{" "}
                — burada əməkdaşın funksiyanı **görüb-görməyəcəyini** idarə edirsən.
                Söndürsən, kassir o düyməni heç vaxt görməyəcək.
              </li>
              <li>
                <strong className="text-foreground">Təsdiq</strong> (bu səhifə) —
                əməkdaş funksiyanı görüb edə bilir, amma{" "}
                <strong className="text-foreground">təyin etdiyim şəxs</strong>{" "}
                təsdiqlədikdən sonra real tətbiq olunur.
              </li>
              <li>
                Hər iki sistemi birlikdə istifadə edə bilərsən: bəzi əməkdaşlara
                icazə yox, bəzilərinə icazə var ama təsdiq tələbi var.
              </li>
            </ul>
            <p className="mt-1.5 text-muted-foreground">
              <strong>Qeyd:</strong> Aşağıdakı şərt-əsaslı qaydalarda{" "}
              <code className="rounded bg-secondary px-1 text-foreground">limit/threshold = 0</code>{" "}
              qoysan, həmin əməliyyat <strong>hər dəfə</strong> təsdiq tələb edəcək.
            </p>
          </div>
        </CardContent>
      </Card>

      <form
        action={async (fd: FormData) => {
          "use server";
          await updateTesdiqSettings(fd);
        }}
        className="space-y-4"
      >
        {/* Auto-approve — short, simple */}
        <Card className="glass border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-start gap-3">
              <DollarSign className="mt-0.5 h-5 w-5 text-emerald-500" />
              <div>
                <h3 className="font-bold">Auto-təsdiq həddi</h3>
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

        {/* 4-eyes (tam-sənəd) təsdiqi — yeni bölmə */}
        <Card className="glass border-primary/30">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b border-border/40 bg-primary/5 px-4 py-2.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                Tam-sənəd təsdiqi (4-eyes)
              </h3>
              <span className="ml-auto text-[10px] text-muted-foreground">
                Aktiv olarsa, kassir/əməkdaş yaratdığı sənədi təsdiq mərkəzində ikinci şəxs təsdiq edənə qədər aktivləşmir
              </span>
            </div>
            <div className="divide-y divide-border/30">
              <DocApprovalRow
                icon={ShoppingCart}
                iconColor="text-emerald-500"
                name="alis_qaime_aktiv"
                label="Alış qaiməsi"
                desc="Hər yeni alış qaiməsi — kassir yaradır, admin təsdiq edir"
                aktiv={cfg.alis_qaime_aktiv}
                approverFieldName="tesdiq_eden_alis_idler"
                approverSelected={perKind.alis}
                allUsers={users}
              />
              <DocApprovalRow
                icon={Receipt}
                iconColor="text-primary"
                name="satis_qaime_aktiv"
                label="Satış qaiməsi"
                desc="Hər yeni satış qaiməsi — yaradan satıcı, təsdiq edən isə müdir / sahibkar"
                aktiv={cfg.satis_qaime_aktiv}
                approverFieldName="tesdiq_eden_satis_idler"
                approverSelected={perKind.satis}
                allUsers={users}
              />
              <DocApprovalRow
                icon={Package}
                iconColor="text-violet-500"
                name="mehsul_yaratma_aktiv"
                label="Yeni məhsul yaratma"
                desc="Yeni məhsul kartı yaradanda — təsdiqə qədər kart 'passiv' qalır"
                aktiv={cfg.mehsul_yaratma_aktiv}
                approverFieldName="tesdiq_eden_mehsul_idler"
                approverSelected={perKind.mehsul}
                allUsers={users}
              />
              <DocApprovalRow
                icon={ArrowLeftRight}
                iconColor="text-sky-500"
                name="ticaret_emeliyyat_aktiv"
                label="Ticarət əməliyyatları"
                desc="Transfer, qaytarma, böyük düzəlişlər"
                aktiv={cfg.ticaret_emeliyyat_aktiv}
                approverFieldName="tesdiq_eden_ticaret_idler"
                approverSelected={perKind.ticaret}
                allUsers={users}
              />
            </div>
          </CardContent>
        </Card>

        {/* Ümumi fallback siyahısı — per-kind seçim olmayan növlər üçün */}
        <Card className={showEmptyApproverWarning ? "glass border-rose-500/40 bg-rose-500/5" : "glass"}>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center gap-2">
              <Users className={showEmptyApproverWarning ? "h-4 w-4 text-rose-500" : "h-4 w-4 text-amber-500"} />
              <h3 className="text-sm font-bold">Ümumi (fallback) təsdiq edənlər</h3>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {selectedApproverIds.size > 0
                  ? `${selectedApproverIds.size} şəxs seçilib`
                  : "Boş — yalnız sahibkar/admin təsdiq edə bilər"}
              </span>
            </div>
            <p className="text-[10.5px] text-muted-foreground">
              Yuxarıdakı hər qaydada özünə xas <strong>«Təsdiq edənlər»</strong> seçə bilərsən
              (məs. Kamal yalnız alış, Aysel yalnız xərc). Boş qoysan, bu ümumi siyahıya düşür.
              Sahibkar və admin avtomatik təsdiq icazəsinə malikdir.
            </p>
            {showEmptyApproverWarning && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-700 dark:text-rose-300">
                <strong>Diqqət:</strong> 4-eyes təsdiqi aktivdir, amma heç bir şəxs seçilməyib.
                Siz işdə deyilsinizsə, sənədlər təsdiq gözləyəcək və əməkdaşlar
                ilişib qalacaq. Ən azı 1 köməkçi təyin edin.
              </div>
            )}
            <p className="text-[10.5px] text-muted-foreground">
              Yuxarıdakı tam-sənəd təsdiqlərini hansı əməkdaşların icra edə biləcəyini seçin.
              Sahibkar və admin avtomatik təsdiq icazəsinə malikdir.
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
              {users.length === 0 ? (
                <p className="col-span-full text-xs text-muted-foreground">Aktiv əməkdaş yoxdur.</p>
              ) : (
                users.map((u) => (
                  <label
                    key={u.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border/40 bg-card/40 px-2 py-1.5 hover:border-primary/40 hover:bg-card"
                  >
                    <input
                      type="checkbox"
                      name="tesdiq_eden_idler"
                      value={u.id}
                      defaultChecked={selectedApproverIds.has(u.id)}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                    <span className="truncate text-xs">{u.ad_soyad}</span>
                  </label>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rules table — all in one card, compact rows */}
        <Card className="glass">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-secondary/30 px-4 py-2.5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Şərt-əsaslı qaydalar (məbləğ / faiz)
              </h3>
              <span className="text-[10px] text-muted-foreground">
                Threshold <code className="text-foreground">0</code> = hər dəfə təsdiq
              </span>
            </div>
            <div className="divide-y divide-border/30">
              {RULES.map(({ rule, aktiv, threshold, criticalName, criticalValue }) => {
                const Icon = rule.icon;
                // Per-kind təsdiq edənlər
                const kindMap: Record<string, { field: string; sel: Set<string> }> = {
                  endirim:        { field: "tesdiq_eden_endirim_idler",   sel: perKind.endirim },
                  maya_alti:      { field: "tesdiq_eden_maya_idler",      sel: perKind.maya },
                  qiymet_deyisdi: { field: "tesdiq_eden_qiymet_idler",    sel: perKind.qiymet },
                  qaytarma:       { field: "tesdiq_eden_qaytarma_idler",  sel: perKind.qaytarma },
                  silme:          { field: "tesdiq_eden_silme_idler",     sel: perKind.silme },
                  borc_limit:     { field: "tesdiq_eden_borc_idler",      sel: perKind.borc },
                  xerc:           { field: "tesdiq_eden_xerc_idler",      sel: perKind.xerc },
                  stok_duzelis:   { field: "tesdiq_eden_stok_idler",      sel: perKind.stok },
                };
                const km = kindMap[rule.key];
                return (
                  <div key={rule.key} className="px-4 py-3 hover:bg-secondary/20">
                    <div className="flex flex-wrap items-center gap-3">
                    {/* Icon + label */}
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className={`grid h-9 w-9 place-items-center rounded-md bg-secondary/50 ${rule.iconColor}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold">{rule.label}</div>
                        <div className="text-[11px] text-muted-foreground">{rule.desc}</div>
                      </div>
                    </div>

                    {/* Threshold input */}
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

                    {/* Critical threshold (only for endirim) */}
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

                    {/* Toggle */}
                    <Switch name={`${rule.key}_aktiv`} defaultChecked={aktiv} />
                    </div>
                    {km && (
                      <ApproverPicker
                        fieldName={km.field}
                        selected={km.sel}
                        allUsers={users}
                        dimmed={!aktiv}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* SLA + Bildirişlər + Audit — one row of small cards */}
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
                <h3 className="text-sm font-bold">Bildirişlər</h3>
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
                <History className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-bold">Audit log</h3>
              </div>
              <p className="text-[10.5px] text-muted-foreground">Hər təsdiq/rədd əməliyyatı yazıya alınır.</p>
              <CheckRow name="audit_aktiv" label="Aktiv saxla" defaultChecked={cfg.audit_aktiv} />
            </CardContent>
          </Card>
        </div>

        {/* Save bar — sticky */}
        <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-xl border border-border/60 bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="text-xs text-muted-foreground">
            Bütün dəyişikliklər <strong className="text-foreground">Yadda saxla</strong> düyməsi ilə tətbiq olunur.
          </div>
          <div className="flex items-center gap-2">
            <Link href="/tesdiq">
              <Button type="button" variant="outline" size="sm">
                <ArrowLeft className="h-3.5 w-3.5" />
                Ləğv et
              </Button>
            </Link>
            <Button type="submit">
              <Save className="h-3.5 w-3.5" />
              Yadda saxla
            </Button>
          </div>
        </div>
      </form>

      {/* Reset to defaults — separate form */}
      <form action={async () => { "use server"; await resetTesdiqSettings(); }} className="text-center">
        <button type="submit" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-rose-500">
          <RefreshCw className="h-3 w-3" />
          Bütün ayarları default-a qaytar
        </button>
      </form>
    </div>
  );
}

function SubNav() {
  return (
    <nav className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card/40 p-0.5">
      <Link href="/tesdiq" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground">
        <ArrowLeft className="h-3 w-3" />
        Mərkəz
      </Link>
      <Link href="/tesdiq/statistika" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground">
        <BarChart3 className="h-3 w-3" />
        Statistika
      </Link>
      <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary/15 px-2.5 text-xs font-semibold text-primary">
        <Settings className="h-3 w-3" />
        Ayarlar
      </span>
    </nav>
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

function DocApprovalRow({
  icon: Icon,
  iconColor,
  name,
  label,
  desc,
  aktiv,
  approverFieldName,
  approverSelected,
  allUsers,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  name: string;
  label: string;
  desc: string;
  aktiv: boolean;
  approverFieldName?: string;
  approverSelected?: Set<string>;
  allUsers?: Array<{ id: string; ad_soyad: string }>;
}) {
  return (
    <div className="px-4 py-3 hover:bg-secondary/20">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className={`grid h-9 w-9 place-items-center rounded-md bg-secondary/50 ${iconColor}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold">{label}</div>
            <div className="text-[11px] text-muted-foreground">{desc}</div>
          </div>
        </div>
        <Switch name={name} defaultChecked={aktiv} />
      </div>
      {approverFieldName && approverSelected && allUsers && (
        <ApproverPicker
          fieldName={approverFieldName}
          selected={approverSelected}
          allUsers={allUsers}
          dimmed={!aktiv}
        />
      )}
    </div>
  );
}

/**
 * Hər təsdiq qaydası üçün inline approver multi-select.
 * Həmişə görünür — toggle off olsa belə, sahibkar əməkdaşları əvvəlcədən
 * təyin edə bilər. Aktiv olmadığı zaman vizual ağırdır (dimmed).
 *
 * `<details open>` ilə **default-açıq** halda göstərilir — sahibkar
 * "təyin etmə yoxdur" deyə şikayət etməsin.
 */
function ApproverPicker({
  fieldName,
  selected,
  allUsers,
  dimmed = false,
}: {
  fieldName: string;
  selected: Set<string>;
  allUsers: Array<{ id: string; ad_soyad: string }>;
  dimmed?: boolean;
}) {
  const selectedUsers = allUsers.filter((u) => selected.has(u.id));
  const summary =
    selected.size === 0
      ? "Bu növü ümumi siyahıdan götürür — istəsən aşağıdakı əməkdaşlardan seç"
      : `${selectedUsers.map((u) => u.ad_soyad).join(", ")} (${selected.size})`;
  return (
    <details
      open={selected.size > 0}
      className={`mt-2 ml-12 rounded-md border bg-secondary/20 ${
        dimmed ? "border-border/30 opacity-70" : "border-primary/20"
      }`}
    >
      <summary className="cursor-pointer list-none px-3 py-1.5 text-[10.5px] hover:bg-secondary/30">
        <span className="font-semibold">👥 Bu növü kim təsdiq edə bilər:</span>{" "}
        <span className={selected.size === 0 ? "italic text-muted-foreground" : "font-bold text-foreground"}>
          {summary}
        </span>
        {dimmed && (
          <span className="ml-2 italic text-[9.5px] text-amber-600">
            (toggle off — yalnız hazırlıq)
          </span>
        )}
      </summary>
      <div className="border-t border-border/30 px-3 py-2">
        <div className="mb-1 text-[10px] text-muted-foreground">
          Aşağıdakı əməkdaşlardan istənilən birini və ya bir neçəsini seç. Boş
          buraxsan, ümumi (fallback) siyahıdan götürür.
        </div>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
          {allUsers.length === 0 ? (
            <p className="col-span-full text-[10.5px] text-muted-foreground">
              Aktiv əməkdaş yoxdur
            </p>
          ) : (
            allUsers.map((u) => (
              <label
                key={u.id}
                className={`flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 transition ${
                  selected.has(u.id)
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/40 hover:border-primary/30 hover:bg-secondary/40"
                }`}
              >
                <input
                  type="checkbox"
                  name={fieldName}
                  value={u.id}
                  defaultChecked={selected.has(u.id)}
                  className="h-3 w-3 rounded border-border"
                />
                <span className="truncate text-[11px]">{u.ad_soyad}</span>
              </label>
            ))
          )}
        </div>
      </div>
    </details>
  );
}
