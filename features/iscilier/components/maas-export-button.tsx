"use client";

import { useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportMaasExcel } from "../maas-export";

export function MaasExportButton({ month }: { month?: string }) {
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      const res = await exportMaasExcel(month);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Base64 → Blob → trigger download
      const bytes = Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Bordro endirildi");
    });
  }

  return (
    <Button onClick={onClick} disabled={pending} variant="outline" size="sm">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      Excel endir
    </Button>
  );
}
