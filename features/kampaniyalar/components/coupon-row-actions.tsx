"use client";

import { useState, useTransition } from "react";
import { Power, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toggleCouponActive } from "../actions";

export function CouponRowActions({ couponId, aktiv }: { couponId: string; aktiv: boolean }) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(aktiv);

  function toggle() {
    startTransition(async () => {
      try {
        const res = await toggleCouponActive(couponId, !current);
        if (res.ok) {
          setCurrent(!current);
          toast.success(current ? "Kupon deaktiv edildi" : "Kupon aktiv edildi");
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error("Server xətası");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
      title={current ? "Deaktiv et" : "Aktiv et"}
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Power className="h-3 w-3" />}
    </button>
  );
}
