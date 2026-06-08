"use client";

import Link from "next/link";
import { MoreHorizontal, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { SaleRowActions } from "./sale-row-actions";
import { AlisRowActions } from "./alis-row-actions";
import type { OperationRow } from "../emeliyyat-queries";

export function OperationRowActions({
  row,
  canPaySale,
  canCancelSale,
  canReceivePurchase,
  canCancelPurchase,
}: {
  row: OperationRow;
  canPaySale: boolean;
  canCancelSale: boolean;
  canReceivePurchase: boolean;
  canCancelPurchase: boolean;
}) {
  if (row.nov === "satis") {
    return (
      <SaleRowActions
        saleId={row.id}
        nomre={row.nomre}
        status={row.status ?? null}
        qaliq={Math.max(0, row.qaliq)}
        canPay={canPaySale}
        canCancel={canCancelSale}
      />
    );
  }
  if (row.nov === "alis") {
    return (
      <AlisRowActions
        purchaseId={row.id}
        nomre={row.nomre}
        status={row.status ?? null}
        canReceive={canReceivePurchase}
        canCancel={canCancelPurchase}
      />
    );
  }
  // qaytarma / transfer — sadəcə detay linki
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Əməliyyatlar"
          title="Əməliyyatlar"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {row.nomre}
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={row.href} className="cursor-pointer">
            <ExternalLink className="h-4 w-4" />
            Tam detay
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
