import type { Metadata } from "next";
import { ShieldCheck, Info } from "lucide-react";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getDiscountThresholds,
  setDiscountThresholds,
} from "@/features/ayarlar/satis-tesdiq";

export const metadata: Metadata = { title: "Endirim təsdiq qaydaları" };

async function save(formData: FormData) {
  "use server";
  const schema = z.object({
    free_max: z.coerce.number().min(0).max(100),
    medium_max: z.coerce.number().min(0).max(100),
    high_max: z.coerce.number().min(0).max(100),
    admin_max: z.coerce.number().min(0).max(100),
  });
  const parsed = schema.safeParse({
    free_max: formData.get("free_max"),
    medium_max: formData.get("medium_max"),
    high_max: formData.get("high_max"),
    admin_max: formData.get("admin_max"),
  });
  if (!parsed.success) return;
  await setDiscountThresholds(parsed.data);
  revalidatePath("/ayarlar/satis-tesdiq");
  revalidatePath("/ticaret/satis-yeni");
}

export default async function SatisTesdiqPage() {
  const t = await getDiscountThresholds();

  const tiers: Array<{
    range: string;
    rule: string;
    permission: string;
    tone: "neutral" | "info" | "warning" | "danger";
  }> = [
    { range: `< ${t.free_max}%`, rule: "Sərbəst (satıcı verə bilər)", permission: "—", tone: "neutral" },
    { range: `${t.free_max}–${t.medium_max}%`, rule: "İcazə tələb olunur", permission: "sales.discount_medium", tone: "info" },
    { range: `${t.medium_max}–${t.high_max}%`, rule: "İcazə + təsdiq tələb olunur", permission: "sales.discount_high", tone: "warning" },
    { range: `${t.high_max}–${t.admin_max}%+`, rule: "Yalnız admin + təsdiq tələb olunur", permission: "admin / sahibkar", tone: "danger" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-muted-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Endirim təsdiq qaydaları</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Endirim faizinə görə mərhələli icazə və təsdiq workflow.
          </p>
        </div>
      </header>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Mərhələli threshold cədvəli</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={save} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                name="free_max"
                label="Sərbəst limit (%)"
                desc="Bu faizə qədər icazə tələb olunmur"
                defaultValue={t.free_max}
              />
              <Field
                name="medium_max"
                label="Orta limit (%)"
                desc="Bu faizə qədər sales.discount_medium icazəsi lazımdır"
                defaultValue={t.medium_max}
              />
              <Field
                name="high_max"
                label="Yüksək limit (%)"
                desc="Bu faizə qədər sales.discount_high icazəsi + təsdiq"
                defaultValue={t.high_max}
              />
              <Field
                name="admin_max"
                label="Admin maksimum (%)"
                desc="Bu faizdən yuxarı yalnız admin/sahibkar"
                defaultValue={t.admin_max}
              />
            </div>
            <Button type="submit" size="sm" className="font-semibold">
              Yadda saxla
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Cari iyerarxiya</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <table className="w-full text-sm">
            <thead className="border-b border-border/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2">Endirim diapazonu</th>
                <th className="py-2">Qayda</th>
                <th className="py-2">İcazə kodu</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((r, i) => (
                <tr key={i} className="border-b border-border/30 last:border-0">
                  <td className="py-2 font-mono text-xs tabular-nums">{r.range}</td>
                  <td className="py-2">
                    <span
                      className={
                        r.tone === "danger"
                          ? "text-danger"
                          : r.tone === "warning"
                            ? "text-warning"
                            : r.tone === "info"
                              ? "text-info"
                              : ""
                      }
                    >
                      {r.rule}
                    </span>
                  </td>
                  <td className="py-2 font-mono text-xs text-muted-foreground">{r.permission}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 p-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 text-info" />
            <span>
              Threshold keçirsə, satış &ldquo;tesdiq_gozleyir&rdquo; statusu ilə yaranır və
              tesdiq_telep cədvəlinə bildiriş göndərilir. Təsdiq aldıqdan sonra satış aktivləşir.
              Hər rol üçün konkret limit isə Rollar səhifəsindəki endirim_limit_&lt;rol&gt;
              acarı ilə təyin edilir.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  name,
  label,
  desc,
  defaultValue,
}: {
  name: string;
  label: string;
  desc: string;
  defaultValue: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type="number"
        step="any"
        min={0}
        max={100}
        name={name}
        defaultValue={defaultValue}
        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
      />
      <div className="mt-1 text-[11px] text-muted-foreground">{desc}</div>
    </div>
  );
}
