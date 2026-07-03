"use client";

import { useState } from "react";
import { Receipt, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney, formatDate } from "@/lib/utils";

const MONTH_LABELS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

export type BordroDetail = {
  id: number;
  il: number;
  ay: number;
  esas_maas: number;
  kpi_bonus: number;
  manual_bonus: number;
  cerime: number;
  son_meblegh: number;
  status: string;
  odenish_tarixi: Date | null;
  prorata_maas?: number;
  avans?: number;
  ish_gun_norma?: number | null;
  ish_gun_faktiki?: number | null;
  qaib_gun?: number | null;
  mezuniyyet_gun?: number | null;
  detal?: {
    satis_komisyon?: number;
    vergi?: number;
    sosial_sigorta?: number;
    gross?: number;
    events?: Array<{ ts?: string; nov?: string; meblegh?: number; sebeb?: string }>;
  } | null;
};

export function BordroDetailRow({
  row,
  children,
  printHrefBase,
}: {
  row: BordroDetail;
  children: React.ReactNode;
  printHrefBase?: string; // e.g. `/iscilier/${id}/bordro-print`
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        onClick={() => setOpen(true)}
        className="cursor-pointer border-b border-border/30 hover:bg-secondary/40"
        title="Detallar üçün klikləyin"
      >
        {children}
      </tr>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              <Receipt className="inline h-4 w-4 mr-1.5" />
              {MONTH_LABELS[row.ay - 1]} {row.il} — Bordro detalı
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-border/40 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hesablama</div>
              <div className="space-y-1">
                <RowLine label="Əsas maaş" value={formatMoney(row.esas_maas)} />
                {row.prorata_maas != null && row.prorata_maas !== row.esas_maas && (
                  <RowLine label={`Prorata (${row.ish_gun_faktiki ?? 0}/${row.ish_gun_norma ?? 22} gün)`} value={formatMoney(row.prorata_maas)} />
                )}
                {(row.detal?.satis_komisyon ?? 0) > 0 && (
                  <RowLine label="Satış komissiyası" value={`+ ${formatMoney(row.detal!.satis_komisyon!)}`} tone="success" />
                )}
                {(row.kpi_bonus ?? 0) > 0 && <RowLine label="KPI bonus" value={`+ ${formatMoney(row.kpi_bonus)}`} tone="success" />}
                {(row.manual_bonus ?? 0) > 0 && <RowLine label="Manual bonus" value={`+ ${formatMoney(row.manual_bonus)}`} tone="success" />}
                {(row.detal?.vergi ?? 0) > 0 && <RowLine label="Vergi (14%)" value={`− ${formatMoney(row.detal!.vergi!)}`} tone="danger" />}
                {(row.detal?.sosial_sigorta ?? 0) > 0 && <RowLine label="Sosial sığorta (3%)" value={`− ${formatMoney(row.detal!.sosial_sigorta!)}`} tone="danger" />}
                {(row.cerime ?? 0) > 0 && <RowLine label="Cərimə" value={`− ${formatMoney(row.cerime)}`} tone="danger" />}
                {(row.avans ?? 0) > 0 && <RowLine label="Avans" value={`− ${formatMoney(row.avans)}`} tone="danger" />}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2">
                <span className="font-semibold">Net məbləğ</span>
                <span className="tabular-nums text-lg font-bold">{formatMoney(row.son_meblegh)}</span>
              </div>
            </div>

            {row.detal?.events && row.detal.events.length > 0 && (
              <div className="rounded-md border border-border/40 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bonus / Cərimə qeydləri</div>
                <div className="space-y-1.5">
                  {row.detal.events.map((e, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="min-w-0 flex-1">
                        <div>
                          <Badge variant="outline" className={`text-[10px] mr-1.5 ${e.nov === "bonus" ? "border-success/30 text-success" : "border-danger/30 text-danger"}`}>
                            {e.nov === "bonus" ? "Bonus" : "Cərimə"}
                          </Badge>
                          {e.sebeb}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground">{e.ts ? formatDate(e.ts, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                      </div>
                      <span className={`tabular-nums ${e.nov === "bonus" ? "text-success" : "text-danger"}`}>
                        {e.nov === "bonus" ? "+" : "−"}{formatMoney(Number(e.meblegh ?? 0))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-md border border-border/40 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status / Ödəniş</div>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={row.status === "odenilib" ? "border-success/30 text-success" : "border-warning/30 text-warning"}>
                  {row.status === "odenilib" ? "Ödənilib" : "Çernovik"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {row.odenish_tarixi ? `Ödənilib: ${formatDate(row.odenish_tarixi)}` : "Hələ ödənilməyib"}
                </span>
              </div>
            </div>

            {printHrefBase && (
              <div className="flex justify-end">
                <a
                  href={`${printHrefBase}?ay=${row.ay}&il=${row.il}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                >
                  <Printer className="h-3 w-3" /> PDF / Çap
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RowLine({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  const cls = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}
