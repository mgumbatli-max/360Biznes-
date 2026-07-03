"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Phone, ShieldCheck, MoreHorizontal, ExternalLink, X, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ProductInline } from "@/features/anbar/components/product-inline";
import { changeServisStatus } from "../actions";
import { SERVIS_STATUS_LABELS, type ServisRow } from "../types";
import { formatMoney, formatDate } from "@/lib/utils";

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

  const isCancelled = row.status === "qaytarildi" || row.status === "redd_edildi";

  return (
    <tr
      className={`border-b border-border/30 transition hover:bg-secondary/40 ${pending ? "opacity-50" : ""} ${
        isCancelled
          ? "bg-destructive/[0.04] text-muted-foreground line-through decoration-destructive/40"
          : ""
      }`}
    >
      <td className="px-3 py-2.5">
        <Link href={`/servis/${row.id}`} className="hover:text-primary-light">
          <div className="font-mono text-xs font-medium">{row.nomre}</div>
          {row.yaradildi && (
            <div className="text-xs text-muted-foreground">
              {formatDate(row.yaradildi)}
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
      <td className="px-3 py-2.5 text-right no-underline [text-decoration:none]">
        <div className="flex items-center justify-end gap-0.5 no-underline [text-decoration:none]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                disabled={pending}
                aria-label="Əməliyyatlar"
                title="Əməliyyatlar"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {row.nomre}
                {isCancelled && (
                  <span className="ml-1 rounded bg-destructive/15 px-1 py-px text-[9px] text-destructive">
                    {row.status === "qaytarildi" ? "Qaytarıldı" : "Rədd"}
                  </span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/servis/${row.id}`} className="cursor-pointer">
                  <ExternalLink className="h-4 w-4" />
                  Tam detay
                </Link>
              </DropdownMenuItem>
              {possibleNext
                .filter((s) => s !== "redd_edildi" && s !== "qaytarildi")
                .map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => changeStatus(s)}>
                    → {SERVIS_STATUS_LABELS[s]?.label ?? s}
                  </DropdownMenuItem>
                ))}
              {!isCancelled && possibleNext.includes("redd_edildi") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => changeStatus("redd_edildi")}>
                    <X className="h-4 w-4" />
                    Rədd et
                  </DropdownMenuItem>
                </>
              )}
              {!isCancelled && possibleNext.includes("qaytarildi") && (
                <DropdownMenuItem variant="destructive" onSelect={() => changeStatus("qaytarildi")}>
                  <Undo2 className="h-4 w-4" />
                  Müştəriyə qaytar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}
