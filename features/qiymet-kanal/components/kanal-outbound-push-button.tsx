"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { pushStockToChannel } from "../outbound-actions";

export function KanalOutboundPushButton({
  kanal,
  hasOutboundUrl,
}: {
  kanal: string;
  hasOutboundUrl: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!hasOutboundUrl) return null;

  function run() {
    if (!confirm(`"${kanal}" kanalına bütün məhsulların stok+qiyməti push olunsun?`)) return;
    startTransition(async () => {
      const res = await pushStockToChannel({ kanal });
      if (res.ok) {
        toast.success(`${res.data?.sent ?? 0} məhsul göndərildi (${res.data?.ms}ms, HTTP ${res.data?.status})`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={run}
      disabled={pending}
      title="Bütün məhsulların stoku+qiyməti platformaya push et"
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
    </Button>
  );
}
