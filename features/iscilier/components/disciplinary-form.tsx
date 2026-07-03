"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDate } from "@/lib/utils";
import { addDisciplinaryAction } from "../hr-actions";
import type { DisciplineEvent } from "../hr-types";

const NOV_OPTS: Array<{ value: string; label: string }> = [
  { value: "sifahi", label: "Şifahi xəbərdarlıq" },
  { value: "yazili", label: "Yazılı xəbərdarlıq" },
  { value: "cerime", label: "Cərimə" },
  { value: "muveqqeti_dayanma", label: "Müvəqqəti dayandırma" },
  { value: "isden_cixarma", label: "İşdən çıxarma təklifi" },
];

export function DisciplinaryForm({
  istifadeciId,
  history = [],
}: {
  istifadeciId: string;
  history?: DisciplineEvent[];
}) {
  const router = useRouter();
  const [nov, setNov] = useState("sifahi");
  const [sebeb, setSebeb] = useState("");
  const [meblegh, setMeblegh] = useState("");
  const [pending, startTransition] = useTransition();

  // Count warnings (sifahi+yazili) in last 12 months
  const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const warningCount = history.filter(
    (h) =>
      (h.nov === "sifahi" || h.nov === "yazili") &&
      new Date(h.ts).getTime() >= yearAgo,
  ).length;

  function submit() {
    if (sebeb.trim().length < 2) {
      toast.error("Səbəb daxil edin");
      return;
    }
    if (nov === "cerime" && (!meblegh || Number(meblegh) <= 0)) {
      toast.error("Cərimə üçün məbləğ daxil edin");
      return;
    }
    startTransition(async () => {
      const res = await addDisciplinaryAction({
        istifadeci_id: istifadeciId,
        nov,
        sebeb,
        meblegh: nov === "cerime" ? Number(meblegh) : undefined,
      });
      if (res.ok) {
        toast.success("Əlavə olundu");
        setSebeb("");
        setMeblegh("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {warningCount >= 3 && (
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Diqqət:</strong> Bu işçinin son 12 ayda {warningCount} xəbərdarlığı var.
            İşdən çıxarma prosedurları nəzərdən keçirilməlidir.
          </AlertDescription>
        </Alert>
      )}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Yeni intizam tədbiri
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Növ</Label>
            <select
              className="h-8 w-full rounded-md border border-border bg-card px-2 text-sm"
              value={nov}
              onChange={(e) => setNov(e.target.value)}
            >
              {NOV_OPTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {nov === "cerime" && (
            <div className="space-y-1">
              <Label className="text-xs">Məbləğ (AZN)</Label>
              <Input
                value={meblegh}
                onChange={(e) => setMeblegh(e.target.value)}
                inputMode="decimal"
                className="h-8"
                placeholder="50"
              />
            </div>
          )}
          <div className={`space-y-1 ${nov === "cerime" ? "md:col-span-1" : "md:col-span-2"}`}>
            <Label className="text-xs">Səbəb</Label>
            <Input
              value={sebeb}
              onChange={(e) => setSebeb(e.target.value)}
              className="h-8"
              placeholder="Davamiyyət pozuntusu, ..."
            />
          </div>
          <div className={`flex items-end ${nov === "cerime" ? "" : "md:col-span-1"}`}>
            <Button size="sm" onClick={submit} disabled={pending} className="w-full">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Əlavə et
            </Button>
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Tarixçə ({history.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((h, i) => {
              const lbl = NOV_OPTS.find((n) => n.value === h.nov)?.label ?? h.nov;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border border-border/40 p-2 text-xs"
                >
                  <div>
                    <div className="font-medium">{lbl}</div>
                    <div className="text-muted-foreground">{h.sebeb}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatDate(h.ts, {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  {h.meblegh && h.meblegh > 0 && (
                    <Badge variant="outline" className="border-danger/30 text-danger">
                      −{h.meblegh.toFixed(2)} AZN
                    </Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
