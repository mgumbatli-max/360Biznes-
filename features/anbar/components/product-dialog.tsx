"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Plus, Pencil } from "lucide-react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ProductDialogProps } from "./product-dialog.impl";

/**
 * Lazy wrapper — yalnız basıldıqda 622 LOC-luq form yüklənir.
 * Trigger button hər zaman görünür, body chunk ilk açılışda gəlir.
 */
const ProductDialogBody = dynamic(
  () => import("./product-dialog.impl").then((m) => m.ProductDialogBody),
  { ssr: false }
);

export function ProductDialog(
  props: ProductDialogProps & {
    defaultOpen?: boolean;
    onOpenChange?: (v: boolean) => void;
    hideTrigger?: boolean;
  },
) {
  const [open, setOpenState] = useState(props.defaultOpen ?? false);
  function setOpen(v: boolean) {
    setOpenState(v);
    props.onOpenChange?.(v);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!props.hideTrigger && (
        <DialogTrigger asChild>
          {props.trigger === "edit" ? (
            <Button size="icon-sm" variant="ghost" title="Redaktə">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
              <Plus className="h-4 w-4" />
              Yeni məhsul
            </Button>
          )}
        </DialogTrigger>
      )}
      {open && <ProductDialogBody {...props} open={open} onOpenChange={setOpen} />}
    </Dialog>
  );
}
