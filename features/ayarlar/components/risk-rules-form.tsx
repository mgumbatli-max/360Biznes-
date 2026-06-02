"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, AlertTriangle, ShieldOff, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { saveRiskRules } from "../risk-rules-actions";
import type { RiskRules } from "../risk-rules";
import { cn } from "@/lib/utils";

const ACTION_OPTIONS: { value: RiskRules["maya_alti_action"]; label: string; desc: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { value: "warn", label: "Yalnız xəbərdar et", desc: "Əməliyyat işləyir, audit-ə yazılır, xəbərdarlıqlar paneline düşür", icon: AlertTriangle, tone: "amber" },
  { value: "approve", label: "Təsdiq tələb et", desc: "Əməliyyat sahibkarın və ya təsdiqedənin onayını gözləyir", icon: ClipboardCheck, tone: "sky" },
  { value: "block", label: "Tamamilə qadağa", desc: "Əməliyyat heç icra olunmur, istifadəçi xəta görür", icon: ShieldOff, tone: "rose" },
];

export function RiskRulesForm({ initial }: { initial: RiskRules }) {
  const [rules, setRules] = useState<RiskRules>(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function update<K extends keyof RiskRules>(key: K, value: RiskRules[K]) {
    setRules((r) => ({ ...r, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("maya_alti_action", rules.maya_alti_action);
    fd.append("borc_limit_action", rules.borc_limit_action);
    fd.append("stok_alert_threshold", String(rules.stok_alert_threshold));
    fd.append("sayim_anomaly_pct", String(rules.sayim_anomaly_pct));
    fd.append("return_anomaly_30d", String(rules.return_anomaly_30d));
    fd.append("stok_change_threshold_unit", String(rules.stok_change_threshold_unit));
    fd.append("stok_change_threshold_azn", String(rules.stok_change_threshold_azn));
    startTransition(async () => {
      const r = await saveRiskRules(fd);
      if (r.ok) {
        toast.success("Yadda saxlandı");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Maya altı satış */}
      <Card className="glass">
        <CardContent className="space-y-3 py-4">
          <div>
            <div className="text-sm font-semibold">Maya altı satış</div>
            <div className="text-xs text-muted-foreground">
              Məhsulun satış qiyməti mayadan aşağı olarsa nə baş versin?
            </div>
          </div>
          <ActionPicker
            value={rules.maya_alti_action}
            onChange={(v) => update("maya_alti_action", v)}
          />
        </CardContent>
      </Card>

      {/* Borc limit */}
      <Card className="glass">
        <CardContent className="space-y-3 py-4">
          <div>
            <div className="text-sm font-semibold">Müştəri borc limiti aşıldıqda</div>
            <div className="text-xs text-muted-foreground">
              Müştərinin qoyulmuş borc limiti aşılarsa nə baş versin?
            </div>
          </div>
          <ActionPicker
            value={rules.borc_limit_action}
            onChange={(v) => update("borc_limit_action", v)}
          />
        </CardContent>
      </Card>

      {/* Ədədi parametrlər */}
      <Card className="glass">
        <CardContent className="space-y-3 py-4">
          <div className="text-sm font-semibold">Anomaliya eşikləri</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="stok_th" className="text-xs">Stok azaldı eşiyi</Label>
              <Input
                id="stok_th"
                type="number"
                min={0}
                max={99999}
                value={rules.stok_alert_threshold}
                onChange={(e) => update("stok_alert_threshold", Math.max(0, Number(e.target.value) || 0))}
              />
              <p className="mt-1 text-[10.5px] text-muted-foreground">Stok bu səviyyəyə düşdükdə xəbərdarlıq</p>
            </div>
            <div>
              <Label htmlFor="sayim_pct" className="text-xs">Sayım fərqi (%)</Label>
              <Input
                id="sayim_pct"
                type="number"
                min={0}
                max={100}
                value={rules.sayim_anomaly_pct}
                onChange={(e) => update("sayim_anomaly_pct", Math.max(0, Number(e.target.value) || 0))}
              />
              <p className="mt-1 text-[10.5px] text-muted-foreground">Bu %-dan böyük fərqdə təsdiq</p>
            </div>
            <div>
              <Label htmlFor="ret_30d" className="text-xs">Eyni müştərinin 30 günlük qaytarma sayı</Label>
              <Input
                id="ret_30d"
                type="number"
                min={0}
                max={100}
                value={rules.return_anomaly_30d}
                onChange={(e) => update("return_anomaly_30d", Math.max(0, Number(e.target.value) || 0))}
              />
              <p className="mt-1 text-[10.5px] text-muted-foreground">Aşılarsa anomaliya alert</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stok düzəliş təsdiq həddləri */}
      <Card className="glass">
        <CardContent className="space-y-3 py-4">
          <div>
            <div className="text-sm font-semibold">Manuel stok düzəlişi təsdiq həddləri</div>
            <div className="text-xs text-muted-foreground">
              Sahibkar/admin olmayan istifadəçi bu həddən böyük stok düzəlişi etsə təsdiq mərkəzinə düşür və icra olunmayana qədər stok dəyişmir.
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="th_unit" className="text-xs">Vahid sayı həddi</Label>
              <Input
                id="th_unit"
                type="number"
                min={0}
                max={999999}
                value={rules.stok_change_threshold_unit}
                onChange={(e) => update("stok_change_threshold_unit", Math.max(0, Number(e.target.value) || 0))}
              />
              <p className="mt-1 text-[10.5px] text-muted-foreground">Bu sayı keçən mexariç/mədaxil təsdiq tələb edir (0 = limit yox)</p>
            </div>
            <div>
              <Label htmlFor="th_azn" className="text-xs">Dəyər həddi (AZN)</Label>
              <Input
                id="th_azn"
                type="number"
                min={0}
                max={99999999}
                value={rules.stok_change_threshold_azn}
                onChange={(e) => update("stok_change_threshold_azn", Math.max(0, Number(e.target.value) || 0))}
              />
              <p className="mt-1 text-[10.5px] text-muted-foreground">Bu məbləği keçən düzəliş təsdiq tələb edir (miqdar × qiymət)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <Save className="mr-1 h-4 w-4" />
          {pending ? "Saxlanılır..." : "Yadda saxla"}
        </Button>
      </div>
    </form>
  );
}

function ActionPicker({
  value,
  onChange,
}: {
  value: RiskRules["maya_alti_action"];
  onChange: (v: RiskRules["maya_alti_action"]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {ACTION_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-lg border p-3 text-left transition",
              active
                ? `border-${opt.tone}-500/60 bg-${opt.tone}-500/10`
                : "border-border/40 hover:border-border hover:bg-secondary/30",
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4", active && `text-${opt.tone}-600`)} />
              <span className={cn("text-sm font-medium", active && `text-${opt.tone}-700`)}>{opt.label}</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">{opt.desc}</div>
          </button>
        );
      })}
    </div>
  );
}
