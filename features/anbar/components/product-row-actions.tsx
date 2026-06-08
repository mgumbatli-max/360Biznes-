"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  ExternalLink,
  Pencil,
  SlidersHorizontal,
  PowerOff,
  Power,
  Trash2,
  Loader2,
  ShoppingCart,
  Truck,
  History,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ProductDialog } from "./product-dialog";
import { deleteProduct, bulkUpdateProducts } from "../actions";
import type { ProductDialogProps } from "./product-dialog.impl";

type AnbarOpt = { id: number; ad: string };

export function ProductRowActions({
  product,
  categories,
  brands,
  units,
  anbarlar,
  currentStock,
  canEdit,
  canDelete,
  canAdjustStock,
}: {
  product: NonNullable<ProductDialogProps["initial"]>;
  categories: ProductDialogProps["categories"];
  brands: ProductDialogProps["brands"];
  units: ProductDialogProps["units"];
  anbarlar: AnbarOpt[];
  currentStock?: number;
  canEdit: boolean;
  canDelete: boolean;
  canAdjustStock: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const isActive = product.aktiv !== false;

  function onDelete() {
    if (!confirm(`«${product.ad}» soft-delete (aktiv=false) edilsin? Audit log-a yazılır.`)) return;
    startTransition(async () => {
      const r = await deleteProduct(product.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Məhsul silindi");
      router.refresh();
    });
  }

  function onTogglePassive() {
    const action = isActive ? "passiv" : "aktiv";
    const label = isActive ? "passivləşdir" : "aktivləşdir";
    if (!confirm(`«${product.ad}» ${label}?`)) return;
    startTransition(async () => {
      const r = await bulkUpdateProducts({ op: action, ids: [product.id] } as never);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(isActive ? "Passivləşdirildi" : "Aktivləşdirildi");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 bg-card/60 text-muted-foreground shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:scale-110 hover:bg-secondary hover:text-foreground active:scale-95"
            aria-label="Əməliyyatlar"
            title="Əməliyyatlar"
            disabled={pending}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground line-clamp-1">
            {product.ad}
            {!isActive && (
              <span className="ml-1 rounded bg-destructive/15 px-1 py-px text-[9px] text-destructive">
                Passiv
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={`/anbar/mehsullar/${product.id}`} className="cursor-pointer">
              <ExternalLink className="h-4 w-4" />
              Tam karta keç
            </Link>
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Redaktə et
            </DropdownMenuItem>
          )}
          {canAdjustStock && (
            <DropdownMenuItem asChild>
              <Link href={`/anbar/stok?mehsul=${product.id}`}>
                <SlidersHorizontal className="h-4 w-4" />
                Stok düzəliş aktı
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Cross-modul
          </DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={`/ticaret/satis-yeni?mehsul=${product.id}`}>
              <ShoppingCart className="h-4 w-4" />
              Bu məhsuldan satış
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/ticaret/alislar?new=1&mehsul=${product.id}`}>
              <Truck className="h-4 w-4" />
              Bu məhsuldan alış
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/anbar/hereketler?mehsul=${product.id}`}>
              <History className="h-4 w-4" />
              Hərəkət tarixçəsi
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/anbar/bron?mehsul=${product.id}`}>
              <Bookmark className="h-4 w-4" />
              Bron yarat / bax
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          {canEdit && (
            <DropdownMenuItem onClick={onTogglePassive}>
              {isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
              {isActive ? "Passivləşdir" : "Aktivləşdir"}
            </DropdownMenuItem>
          )}
          {canDelete && isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                Sil
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {editOpen && (
        <ProductDialog
          categories={categories}
          brands={brands}
          units={units}
          initial={product}
          trigger="edit"
          hideTrigger
          defaultOpen
          onOpenChange={(v) => !v && setEditOpen(false)}
        />
      )}
      {stockOpen && (
        <div className="hidden">
          {/* Stok düzəlişi indi yalnız ayrıca dialog ilə — icazə-li akt */}
        </div>
      )}
    </>
  );
}
