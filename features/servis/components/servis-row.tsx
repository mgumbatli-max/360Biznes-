"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Phone, ShieldCheck, ArrowRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductInline } from "@/features/anbar/components/product-inline";
import { changeServisStatus } from "../actions";
import { SERVIS_STATUS_LABELS, type ServisRow } from "../types";
import { formatMoney } from "@/lib/utils";

const NEXT_STAGES: Record<string, string[]> = {
  qebul_edildi: ["diaqnostikada", "redd_edildi"],
  diaqnostikada: ["usta_baxir", "qaytarildi"],
  usta_baxir: ["ehtiyat_hisse", "temir_olunur"],
  ehtiyat_hisse: ["temir_olunur"],
  temir_olunur: ["temir_edildi"],
  temir_edildi: ["musteriye_tehvil"],
};

export function ServisRowItem({ row }: { row: ServisRow }) {
  const [pending, startTransition] = useTransition();
  const status = SERVIS_STATUS_LABELS[row.status] ?? SERVIS_STATUS_LABELS.qebul_edildi;
  const possibleNext = NEXT_STAGES[row.status] ?? [];

  function changeStatus(s: string) {
    startTransition(async () => {
      const res = await changeServisStatus(row.id, s as never);
      if (res.ok) toast.success("Status dəyişdi");
      else toast.error(res.error);
    });
  }

  return (
    <tr className={`border-b border-border/30 transition hover:bg-secondary/40 ${pending && "opacity-50"}`}>
      <td className="px-3 py-2.5">
        <Link href={`/servis/${row.id}`} className="hover:text-primary-light">
          <div className="font-mono text-xs font-medium">{row.nomre}</div>
          {row.yaradildi && (
            <div className="text-xs text-muted-foreground">
              {new Date(row.yaradildi).toLocaleDateString("az-AZ")}
            </div>
          )}
        </Link>
      </td>
      <td className="px-3 py-2.5">
        <div className="font-medium">{row.musteri_ad}</div>
        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" />
          {row.musteri_telefon}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            {row.mehsul_id ? (
              <ProductInline
                id={row.mehsul_id}
                ad={row.mehsul_ad}
                kod={row.mehsul_kod}
                barkod={row.mehsul_barkod}
                showImage={false}
                size="xs"
              />
            ) : (
              <span className="text-sm font-medium">{row.mehsul_ad}</span>
            )}
          </div>
          {row.zemanet_var && (
            <Badge variant="outline" className="ml-1 text-[10px]">
              <ShieldCheck className="h-2.5 w-2.5" /> Zəmanət
            </Badge>
          )}
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{row.problem_tesviri}</p>
      </td>
      <td className="px-3 py-2.5">
        <Badge variant="outline" className={status.cls}>{status.label}</Badge>
      </td>
      <td className="px-3 py-2.5 text-right">
        {row.musteriden_alinan > 0 && (
          <div className="tabular-nums text-sm font-semibold">{formatMoney(row.musteriden_alinan)}</div>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-0.5">
          <Link
            href={`/servis/${row.id}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Detay"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          {possibleNext.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" disabled={pending} title="Növbəti mərhələ">
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {possibleNext.map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => changeStatus(s)}>
                    → {SERVIS_STATUS_LABELS[s]?.label ?? s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </td>
    </tr>
  );
}
