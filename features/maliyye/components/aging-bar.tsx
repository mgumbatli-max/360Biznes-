"use client";

import { formatMoney } from "@/lib/utils";

type Props = {
  cari: number;
  orta: number;
  kritik: number;
};

export function AgingBar({ cari, orta, kritik }: Props) {
  const total = cari + orta + kritik;
  if (total <= 0) return null;
  const cP = (cari / total) * 100;
  const oP = (orta / total) * 100;
  const kP = (kritik / total) * 100;

  return (
    <div className="flex h-7 overflow-hidden rounded-md border border-border bg-secondary/40">
      {cari > 0 && (
        <div
          className="flex items-center justify-center bg-success text-[10.5px] font-semibold text-white"
          style={{ width: `${cP}%` }}
          title={`Cari: ${formatMoney(cari)}`}
        >
          {cP > 6 && `${cP.toFixed(0)}%`}
        </div>
      )}
      {orta > 0 && (
        <div
          className="flex items-center justify-center bg-warning text-[10.5px] font-semibold text-white"
          style={{ width: `${oP}%` }}
          title={`Gecikmiş: ${formatMoney(orta)}`}
        >
          {oP > 6 && `${oP.toFixed(0)}%`}
        </div>
      )}
      {kritik > 0 && (
        <div
          className="flex items-center justify-center bg-danger text-[10.5px] font-semibold text-white"
          style={{ width: `${kP}%` }}
          title={`Kritik: ${formatMoney(kritik)}`}
        >
          {kP > 6 && `${kP.toFixed(0)}%`}
        </div>
      )}
    </div>
  );
}
