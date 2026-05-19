import Link from "next/link";
import { ArrowRight, PackageX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LowStockRow } from "../queries";

type Props = {
  rows: LowStockRow[];
};

export function LowStockPanel({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-10 text-center text-sm">
        <PackageX className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="font-medium text-foreground">Az stok yoxdur</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Bütün məhsullar kritik səviyyədən yuxarıdır.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/40">
      {rows.map((r) => {
        const ratio = r.kritik_stok ? r.miqdar / r.kritik_stok : 0;
        const tone: "danger" | "warning" =
          r.miqdar <= 0 || ratio <= 0.3 ? "danger" : "warning";
        return (
          <div key={`${r.mehsul_id}-${r.anbar_ad}`} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{r.ad}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                {r.kod && <span className="font-mono">{r.kod}</span>}
                <span>·</span>
                <span>{r.anbar_ad}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold tabular-nums">{r.miqdar}</span>
                <span className="text-xs text-muted-foreground">/ {r.kritik_stok}</span>
              </div>
              <Badge variant={tone === "danger" ? "destructive" : "secondary"} className="mt-1 h-5 text-[10px]">
                {r.miqdar <= 0 ? "stok bitib" : "az stok"}
              </Badge>
            </div>
          </div>
        );
      })}

      <div className="pt-3">
        <Link
          href="/anbar"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-light hover:underline"
        >
          Bütün stoku gör
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
