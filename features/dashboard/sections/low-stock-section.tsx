import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LowStockPanel } from "@/features/dashboard/components/low-stock-panel";
import { BirthdayWidget } from "@/features/dashboard/components/birthday-widget";
import { getLowStockItems } from "@/features/dashboard/queries";

export async function LowStockSection() {
  const lowStock = await getLowStockItems(8);
  return (
    <div className="space-y-3">
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Aşağı stok</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">Top 8 kritik məhsul</p>
        </CardHeader>
        <CardContent>
          <LowStockPanel rows={lowStock} />
        </CardContent>
      </Card>
      <BirthdayWidget />
    </div>
  );
}
