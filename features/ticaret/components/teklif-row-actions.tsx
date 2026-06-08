"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, ExternalLink, ArrowRight, Check, X, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { convertTeklifToSale, updateTeklifStatus, deleteTeklif } from "../teklif-actions";

export function TeklifRowActions({
  teklifId,
  nomre,
  status,
  satishId,
  canConvert,
  canChangeStatus,
  canDelete,
}: {
  teklifId: string;
  nomre: string;
  status: string;
  satishId: string | null;
  canConvert: boolean;
  canChangeStatus: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isConverted = !!satishId;
  const isRedd = status === "redd";
  const isLegv = status === "legv";
  const isDraft = status === "qaralama";

  function onConvert() {
    if (!confirm(`«${nomre}» təklifi satışa çevrilsin?`)) return;
    startTransition(async () => {
      const r = await convertTeklifToSale(teklifId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Satışa çevrildi");
      const id = r.data?.id;
      if (id) router.push(`/ticaret/satislar/${id}`);
      else router.refresh();
    });
  }

  function onStatus(s: string, label: string) {
    startTransition(async () => {
      const r = await updateTeklifStatus(teklifId, s);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Status: ${label}`);
      router.refresh();
    });
  }

  function onDelete() {
    if (!confirm(`«${nomre}» təklifi silinsin? Bu əməliyyat audit log-a yazılır.`)) return;
    startTransition(async () => {
      const r = await deleteTeklif(teklifId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Silindi");
      router.refresh();
    });
  }

  return (
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
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {nomre}
          {(isRedd || isLegv) && (
            <span className="ml-1 rounded bg-destructive/15 px-1 py-px text-[9px] text-destructive">
              {isLegv ? "Ləğv" : "Rədd"}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/ticaret/teklif?id=${teklifId}`} className="cursor-pointer">
            <ExternalLink className="h-4 w-4" />
            Tam detay / redaktə
          </Link>
        </DropdownMenuItem>
        {isConverted && satishId && (
          <DropdownMenuItem asChild>
            <Link href={`/ticaret/satislar/${satishId}`} className="cursor-pointer">
              <ExternalLink className="h-4 w-4" />
              Çevrildiyi satış
            </Link>
          </DropdownMenuItem>
        )}
        {canConvert && !isConverted && !isRedd && !isLegv && (
          <DropdownMenuItem onClick={onConvert}>
            <ArrowRight className="h-4 w-4" />
            Satışa çevir
          </DropdownMenuItem>
        )}
        {canChangeStatus && isDraft && !isConverted && (
          <DropdownMenuItem onClick={() => onStatus("gonderildi", "Göndərildi")}>
            <Check className="h-4 w-4" />
            Göndərildi olaraq qeyd et
          </DropdownMenuItem>
        )}
        {canChangeStatus && !isConverted && !isRedd && !isLegv && (
          <DropdownMenuItem onClick={() => onStatus("redd", "Rədd edildi")}>
            <X className="h-4 w-4" />
            Rədd et
          </DropdownMenuItem>
        )}
        {canDelete && !isConverted && (
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
  );
}
