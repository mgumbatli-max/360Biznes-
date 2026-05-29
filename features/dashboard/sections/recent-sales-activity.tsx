import Link from "next/link";
import {
  ArrowRight,
  ShoppingCart,
  CircleDollarSign,
  Bell,
  Wrench,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";
import { getRecentSales, getRecentActivity } from "@/features/dashboard/queries";

const activityIconFor = (tip: string) => {
  switch (tip) {
    case "satis":
      return ShoppingCart;
    case "kassa":
      return CircleDollarSign;
    case "xeberdar":
      return Bell;
    case "servis":
      return Wrench;
    default:
      return Activity;
  }
};

export async function RecentSalesActivity() {
  const [recentSales, recentActivity] = await Promise.all([
    getRecentSales(5),
    getRecentActivity(15),
  ]);

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="glass lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Son 5 satış</CardTitle>
          <Link href="/ticaret/satislar" className="inline-flex items-center gap-1 text-xs text-primary-light hover:underline">
            Hamısı <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentSales.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Hələ satış yoxdur.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <th className="px-2 py-2 text-left font-medium">Nömrə</th>
                    <th className="px-2 py-2 text-left font-medium">Müştəri</th>
                    <th className="px-2 py-2 text-left font-medium">Tarix</th>
                    <th className="px-2 py-2 text-right font-medium">Məbləğ</th>
                    <th className="px-2 py-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((s) => (
                    <tr key={s.id} className="border-b border-border/30 last:border-0">
                      <td className="px-2 py-2 font-mono text-xs">
                        <Link href={`/ticaret/satislar/${s.id}`} className="text-primary-light hover:underline">
                          {s.nomre}
                        </Link>
                      </td>
                      <td className="px-2 py-2">{s.musteri_ad || "—"}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {new Date(s.tarix).toLocaleDateString("az-AZ")}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatMoney(s.son_mebleg)}</td>
                      <td className="px-2 py-2 text-right">
                        <Badge variant="outline" className="h-5 text-[10px]">{s.status || "—"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Son hadisələr</CardTitle>
          <Link href="/audit-log" className="inline-flex items-center gap-1 text-xs text-primary-light hover:underline">
            Audit <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Hələ hadisə yoxdur.</div>
          ) : (
            <ul className="space-y-2">
              {recentActivity.map((e) => {
                const Icon = activityIconFor(e.tip);
                return (
                  <li key={e.id} className="flex items-start gap-2.5 text-xs">
                    <div className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-foreground">{e.basliq}</div>
                      <div className="text-muted-foreground">
                        {new Date(e.tarix).toLocaleString("az-AZ", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
