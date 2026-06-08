import type { Metadata } from "next";
import { Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAllVezifeler } from "@/features/iscilier/queries";
import { VezifeDialog } from "@/features/ayarlar/components/vezife-dialog";
import { toggleVezifeAktiv } from "@/features/iscilier/vezife-actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Vəzifələr" };

export default async function VezifePage() {
  const rows = await getAllVezifeler();
  const aktivSay = rows.filter((r) => r.aktiv).length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vəzifələr</h1>
            <p className="text-sm text-muted-foreground">
              İşçi vəzifə kataloqu · {aktivSay} aktiv / {rows.length} toplam
            </p>
          </div>
        </div>
        <VezifeDialog />
      </header>

      {rows.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Vəzifə yoxdur. Yuxarıdakı «Yeni vəzifə» düyməsi ilə əlavə edin.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/40 text-left">
                    <th className="px-3 py-2">Ad</th>
                    <th className="px-3 py-2 text-right">İşçi sayı</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 w-32 text-right">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id} className={cn("border-b border-border/20", !v.aktiv && "opacity-60")}>
                      <td className="px-3 py-2 text-sm font-semibold">{v.ad}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums">
                        {v.istifade_sayi}
                      </td>
                      <td className="px-3 py-2">
                        {v.aktiv ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/40">
                            aktiv
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">passiv</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <VezifeDialog initial={{ id: v.id, ad: v.ad }} />
                          <form
                            action={async () => {
                              "use server";
                              await toggleVezifeAktiv(v.id);
                            }}
                          >
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[11px]"
                            >
                              {v.aktiv ? "Deaktiv" : "Aktiv"}
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
