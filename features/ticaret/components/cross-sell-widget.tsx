import { Link2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTopCrossSellPairs } from "@/features/ticaret/cross-sell-queries";

/**
 * Top məhsul cütlüyü — "Bunlar birlikdə alınır" widget-i.
 * Satıcı POS-da müştəriyə təklif edə bilər.
 */
export async function CrossSellWidget() {
  const pairs = await getTopCrossSellPairs(90, 8);

  if (pairs.length === 0) {
    return null;
  }

  return (
    <Card className="glass border-amber-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4 text-amber-500" />
          Birlikdə alınan məhsullar
          <Badge variant="outline" className="ml-auto text-[10px]">
            Son 90 gün
          </Badge>
        </CardTitle>
        <p className="text-[10.5px] text-muted-foreground">
          <Info className="mr-0.5 inline h-2.5 w-2.5" />
          POS-da bu cütləri birgə təklif et — satışı artırmaq üçün
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        {pairs.map((p, i) => (
          <div
            key={`${p.a_id}-${p.b_id}`}
            className="flex items-center gap-2 rounded-md border border-border/40 bg-card/40 px-2.5 py-1.5 text-xs hover:bg-secondary/30"
          >
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-secondary text-[10px] font-bold">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{p.a_ad}</span>
            <Link2 className="h-2.5 w-2.5 shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1 truncate font-medium">{p.b_ad}</span>
            <Badge variant="outline" className="shrink-0 text-[9.5px]">
              {p.birge_say}× birgə
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
