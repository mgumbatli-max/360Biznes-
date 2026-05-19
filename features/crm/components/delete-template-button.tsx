"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteTemplate } from "../actions";

export function DeleteTemplateButton({ id, ad }: { id: number; ad: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(`"${ad}" silinsin?`)) return;
    startTransition(async () => {
      const res = await deleteTemplate(id);
      if (res.ok) toast.success("Silindi");
      else toast.error(res.error);
    });
  }

  return (
    <Button size="icon-sm" variant="ghost" title="Sil" disabled={pending} onClick={onClick}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
