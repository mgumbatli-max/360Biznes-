"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelBron } from "../actions";

export function CancelBronButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="destructive"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Bron ləğv edilsin?")) return;
        startTransition(async () => {
          const r = await cancelBron(id);
          if (r.ok) {
            toast.success("Ləğv edildi");
            router.refresh();
          } else {
            toast.error(r.error);
          }
        });
      }}
    >
      Ləğv
    </Button>
  );
}
