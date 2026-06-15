"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveModul } from "@/features/platform-admin/actions";
import type { CatalogModule } from "@/features/platform-admin/queries";

type Props = { modul: CatalogModule };

/**
 * Modul kataloqu cədvəlinin redaktə oluna bilən sətri (super-admin).
 * - aylıq / illik qiymət (number input)
 * - 4 plan checkbox-u (start/business/pro/enterprise_daxil)
 * - "ayrıca alına bilər" + "aktiv" toggle-ları
 * - "Saxla" düyməsi → saveModul (useTransition + router.refresh)
 * Uğur/xəta inline (sətrin altında) göstərilir.
 */
export function ModuleCatalogRow({ modul }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Lokal redaktə vəziyyəti (forma controlled).
  const [aylik, setAylik] = useState(String(modul.aylik_qiymet));
  const [illik, setIllik] = useState(modul.illik_qiymet === null ? "" : String(modul.illik_qiymet));
  const [start, setStart] = useState(modul.start_daxil);
  const [business, setBusiness] = useState(modul.business_daxil);
  const [pro, setPro] = useState(modul.pro_daxil);
  const [enterprise, setEnterprise] = useState(modul.enterprise_daxil);
  const [ayrica, setAyrica] = useState(modul.ayrica_alina_biler);
  const [aktiv, setAktiv] = useState(modul.aktiv);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("kod", modul.kod);
      fd.set("aylik_qiymet", aylik === "" ? "0" : aylik);
      fd.set("illik_qiymet", illik);
      fd.set("start_daxil", start ? "true" : "false");
      fd.set("business_daxil", business ? "true" : "false");
      fd.set("pro_daxil", pro ? "true" : "false");
      fd.set("enterprise_daxil", enterprise ? "true" : "false");
      fd.set("ayrica_alina_biler", ayrica ? "true" : "false");
      fd.set("aktiv", aktiv ? "true" : "false");
      const res = await saveModul(fd);
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <tr className="border-b border-border/30 align-middle">
      {/* Modul (ad + kod) */}
      <td className="px-3 py-2.5">
        <div className="font-medium">{modul.ad}</div>
        <div className="font-mono text-[11px] text-muted-foreground">{modul.kod}</div>
      </td>

      {/* Qrup */}
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{modul.qrup ?? "—"}</td>

      {/* Aylıq qiymət */}
      <td className="px-3 py-2.5">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={aylik}
          onChange={(e) => setAylik(e.target.value)}
          disabled={pending}
          aria-label={`${modul.ad} aylıq qiymət`}
          className="h-8 w-24 text-right tabular-nums"
        />
      </td>

      {/* İllik qiymət */}
      <td className="px-3 py-2.5">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={illik}
          onChange={(e) => setIllik(e.target.value)}
          disabled={pending}
          placeholder="—"
          aria-label={`${modul.ad} illik qiymət`}
          className="h-8 w-24 text-right tabular-nums"
        />
      </td>

      {/* Planlar — 4 checkbox */}
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <PlanCheck label="Başlanğıc" checked={start} onChange={setStart} disabled={pending} />
          <PlanCheck label="Business" checked={business} onChange={setBusiness} disabled={pending} />
          <PlanCheck label="Pro" checked={pro} onChange={setPro} disabled={pending} />
          <PlanCheck label="Enterprise" checked={enterprise} onChange={setEnterprise} disabled={pending} />
        </div>
      </td>

      {/* Ayrıca alına bilər */}
      <td className="px-3 py-2.5 text-center">
        <input
          type="checkbox"
          checked={ayrica}
          onChange={(e) => setAyrica(e.target.checked)}
          disabled={pending}
          aria-label={`${modul.ad} ayrıca alına bilər`}
          className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
        />
      </td>

      {/* Aktiv */}
      <td className="px-3 py-2.5 text-center">
        <input
          type="checkbox"
          checked={aktiv}
          onChange={(e) => setAktiv(e.target.checked)}
          disabled={pending}
          aria-label={`${modul.ad} aktiv`}
          className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
        />
      </td>

      {/* Saxla */}
      <td className="px-3 py-2.5 text-right">
        <div className="flex flex-col items-end gap-1">
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={save}>
            {saved ? <Check className="h-3.5 w-3.5 text-success" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Saxlanıldı" : "Saxla"}
          </Button>
          {error ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-danger" title={error}>
              <AlertCircle className="h-3 w-3 shrink-0" /> {error}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function PlanCheck({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1 text-[11px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-3.5 w-3.5 cursor-pointer accent-[var(--primary)]"
      />
      <span className={checked ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </label>
  );
}
