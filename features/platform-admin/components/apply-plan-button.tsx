"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { applyPlanModules } from "@/features/platform-admin/actions";

type Props = {
  sahibkarId: string;
  planKod: string | null;
  planAd: string | null;
};

/**
 * Tenant-in cari planının modullarını tətbiq edən düymə. applyPlanModules-u
 * {sahibkar_id, plan_kod} ilə çağırır — planın tier bayrağı (*_daxil) true olan
 * modulları aktivləşdirir (mövcud add-on-ları söndürmür). Plan yoxdursa düymə
 * söndürülür. Uğurda router.refresh() ilə hesablama cədvəlini yeniləyir.
 */
export function ApplyPlanButton({ sahibkarId, planKod, planAd }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply() {
    if (!planKod) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("sahibkar_id", sahibkarId);
      fd.set("plan_kod", planKod);
      const res = await applyPlanModules(fd);
      if (res.ok) {
        toast.success(`${planAd ?? planKod} planının modulları tətbiq olundu`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending || !planKod}
      onClick={apply}
      title={planKod ? undefined : "Tenant-in aktiv abunəsi/planı yoxdur"}
    >
      <Wand2 className="h-3.5 w-3.5" /> Planın modullarını tətbiq et
    </Button>
  );
}
