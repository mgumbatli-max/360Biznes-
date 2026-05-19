"use client";

import { useEffect, useState } from "react";
import { Star, AlertTriangle } from "lucide-react";
import { tierLabel } from "../customer-tier";

type Info = {
  ok: true;
  musteri_id: string;
  musteri_ad: string;
  qiymet_tipi: string;
  borc: number;
  borc_limiti: number | null;
  voen: string | null;
  telefon: string | null;
};

export function CustomerTierBadge({ musteriId }: { musteriId: string | null | undefined }) {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    setInfo(null);
    if (!musteriId) return;
    let cancelled = false;
    fetch(`/api/ticaret/customer-tier?musteri=${musteriId}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.ok) setInfo(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [musteriId]);

  if (!musteriId || !info) return null;
  const tier = tierLabel(info.qiymet_tipi);
  const overLimit =
    info.borc_limiti !== null && info.borc_limiti > 0 && info.borc >= info.borc_limiti;
  const nearLimit =
    info.borc_limiti !== null &&
    info.borc_limiti > 0 &&
    info.borc / info.borc_limiti >= 0.8 &&
    !overLimit;

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${tier.color}`}>
        <Star className="h-3 w-3" />
        Müştəri tipi: {tier.label}
      </span>
      <span className="text-muted-foreground">— {tier.label} qiyməti tətbiq olunur</span>
      {info.borc > 0 && (
        <span className="text-warning">Cari borc: {info.borc.toFixed(2)} AZN</span>
      )}
      {(overLimit || nearLimit) && info.borc_limiti !== null && (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
            overLimit ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning"
          }`}
        >
          <AlertTriangle className="h-3 w-3" />
          {overLimit ? "Limit aşılıb" : "Limitə yaxın"} ({info.borc.toFixed(0)}/{info.borc_limiti.toFixed(0)})
        </span>
      )}
    </div>
  );
}
