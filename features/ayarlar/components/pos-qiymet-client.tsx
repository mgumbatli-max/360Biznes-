"use client";

import { useState, useTransition } from "react";
import { Loader2, Save, Tags, ShieldAlert, Eye, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { savePosPriceSettings } from "../pos-qiymet-actions";
import type { PosPriceSettings } from "../pos-qiymet-types";

type Props = {
  initial: PosPriceSettings;
};

const TIER_OPTIONS: { value: PosPriceSettings["default_tier"]; label: string }[] =
  [
    { value: "satis_qiymeti", label: "Pərakəndə" },
    { value: "endirimli_qiymet", label: "Endirimli" },
    { value: "topdan_qiymeti", label: "Topdan" },
    { value: "partnyor_qiymeti", label: "Partnyor" },
    { value: "vip_qiymeti", label: "VIP" },
  ];

export function PosQiymetClient({ initial }: Props) {
  const [state, setState] = useState<PosPriceSettings>(initial);
  const [pending, startSave] = useTransition();

  function set<K extends keyof PosPriceSettings>(
    key: K,
    value: PosPriceSettings[K],
  ) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function onSave() {
    startSave(async () => {
      const r = await savePosPriceSettings(state);
      if (r.ok) toast.success("Ayarlar yadda saxlanıldı");
      else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-violet-700">
              <Eye className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">POS-da görünən qiymət sütunları</div>
              <div className="text-xs text-slate-500">
                Axtarış nəticəsində məhsul kartında hansı tiplərin göstəriləcəyi.
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Toggle
              label="Pərakəndə qiymət göstər"
              checked={state.show_pere}
              onChange={(v) => set("show_pere", v)}
            />
            <Toggle
              label="Topdan qiymət göstər"
              checked={state.show_topdan}
              onChange={(v) => set("show_topdan", v)}
            />
            <Toggle
              label="Partnyor qiymət göstər"
              checked={state.show_partnyor}
              onChange={(v) => set("show_partnyor", v)}
            />
            <Toggle
              label="VIP qiymət göstər"
              checked={state.show_vip}
              onChange={(v) => set("show_vip", v)}
            />
            <Toggle
              label="Endirimli qiymət göstər"
              checked={state.show_endirimli}
              onChange={(v) => set("show_endirimli", v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-amber-700">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Həssas məlumat görünüşü</div>
              <div className="text-xs text-slate-500">Maya, marja, min qiymət — kim görsün.</div>
            </div>
          </div>
          <Toggle
            label="Min qiyməti yalnız administrator görsün"
            checked={state.show_min_only_admin}
            onChange={(v) => set("show_min_only_admin", v)}
          />
          <Toggle
            label="Maya qiymətini yalnız sahibkar görsün"
            checked={state.show_cost_only_owner}
            onChange={(v) => set("show_cost_only_owner", v)}
          />
          <Toggle
            label="Marjanı yalnız sahibkar görsün"
            checked={state.show_margin_only_owner}
            onChange={(v) => set("show_margin_only_owner", v)}
          />
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
              <Settings2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Satıcı icazələri</div>
              <div className="text-xs text-slate-500">
                Kassir / satıcı POS-da nələri dəyişə bilər.
              </div>
            </div>
          </div>
          <Toggle
            label="Satıcı qiyməti dəyişə bilər"
            checked={state.cashier_can_change_price}
            onChange={(v) => set("cashier_can_change_price", v)}
          />
          <Toggle
            label="Satıcı min qiymətdən aşağı sata bilər"
            checked={state.cashier_can_sell_below_min}
            onChange={(v) => set("cashier_can_sell_below_min", v)}
          />
          <Toggle
            label="Min qiymət aşağı satış rəhbər təsdiqi tələb edir"
            checked={state.below_min_needs_approval}
            onChange={(v) => set("below_min_needs_approval", v)}
          />
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-fuchsia-100 text-fuchsia-700">
              <Tags className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Default qiymət tipi</div>
              <div className="text-xs text-slate-500">
                Səbətə yeni məhsul əlavə edildikdə avtomatik seçilən tip.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {TIER_OPTIONS.map((t) => {
              const active = state.default_tier === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set("default_tier", t.value)}
                  className={
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition " +
                    (active
                      ? "border-violet-600 bg-violet-600 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-violet-300")
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <Button
          onClick={onSave}
          disabled={pending}
          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Yadda saxla
        </Button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition hover:border-violet-300">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition " +
          (checked ? "bg-emerald-600" : "bg-slate-300")
        }
      >
        <span
          className={
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition " +
            (checked ? "translate-x-[18px]" : "translate-x-0.5") +
            " self-center"
          }
        />
      </button>
    </label>
  );
}
