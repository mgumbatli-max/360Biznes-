"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptTransfer } from "../actions";

export function AcceptTransferButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      className="font-semibold text-white"
      style={{ background: "var(--brand-gradient)" }}
      onClick={() => {
        if (!window.confirm("Transferi qəbul edib stoku köçürməyə əminsən?")) return;
        startTransition(async () => {
          const r = await acceptTransfer(id);
          if (r.ok) {
            toast.success("Transfer qəbul edildi");
            router.refresh();
          } else {
            toast.error(r.error);
          }
        });
      }}
    >
      Qəbul et
    </Button>
  );
}
