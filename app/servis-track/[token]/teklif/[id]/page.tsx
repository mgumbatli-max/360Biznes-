import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Wrench, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getServisTrackByToken } from "@/features/servis/queries";
import { SERVIS_STATUS_LABELS } from "@/features/servis/types";
import { formatMoney, formatDate } from "@/lib/utils";
import { CustomerQuoteApproval } from "./quote-approval";

export const metadata: Metadata = { title: "Servis qiymət təklifi" };
export const dynamic = "force-dynamic";

export default async function CustomerQuotePage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;
  const s = await getServisTrackByToken(token);
  if (!s) notFound();
  if (s.id !== id) notFound();

  const statusMeta = SERVIS_STATUS_LABELS[s.status] ?? SERVIS_STATUS_LABELS.qebul_edildi;
  const xerc = s.temir_xerci;
  const balance = xerc - s.musteriden_alinan;
  const closed = s.status === "musteriye_tehvil" || s.status === "redd_edildi" || s.status === "qaytarildi";
  const canDecide = !closed && s.status === "teklif_gozleyir";

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-center">
          <div
            className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Wrench className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Qiymət təklifi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {s.sahibkarlar?.ad ?? "Servis"} servisindən qiymət təklifi
          </p>
        </div>

        <Card className="glass">
          <CardContent className="space-y-4 py-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Servis nömrəsi
                </div>
                <div className="font-mono text-lg font-semibold">{s.nomre}</div>
              </div>
              <Badge variant="outline" className={statusMeta.cls}>
                {statusMeta.label}
              </Badge>
            </div>

            <div className="rounded-md border border-border/40 bg-secondary/30 p-3 text-sm">
              <div className="text-[10px] uppercase text-muted-foreground">Məhsul</div>
              <div className="font-medium">{s.mehsul_ad}</div>
              {s.mehsul_seri_nomresi && (
                <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                  Seriya: {s.mehsul_seri_nomresi}
                </div>
              )}
              <div className="mt-2 text-[10px] uppercase text-muted-foreground">Problem</div>
              <p className="whitespace-pre-wrap text-xs text-foreground">{s.problem_tesviri}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <Cell label="Təklif" value={formatMoney(xerc)} tone="info" />
              <Cell label="Ödənilib" value={formatMoney(s.musteriden_alinan)} tone="success" />
              <Cell label="Qalıq" value={formatMoney(Math.max(0, balance))} tone={balance > 0 ? "danger" : "success"} />
            </div>

            {s.texmini_tehvil && (
              <div className="rounded-md border border-emerald-400/30 bg-emerald-400/10 p-2 text-center text-xs text-emerald-300">
                <ShieldCheck className="inline h-3 w-3" /> Vəd tarixi: {formatDate(s.texmini_tehvil)}
              </div>
            )}
          </CardContent>
        </Card>

        {canDecide ? (
          <CustomerQuoteApproval servisId={s.id} />
        ) : (
          <div className="rounded-md border border-border/40 bg-card/30 p-3 text-center text-sm text-muted-foreground">
            Bu təklif artıq emal olunmuşdur. Status: {statusMeta.label}.
          </div>
        )}
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger" | "info";
}) {
  const cls =
    tone === "success" ? "text-emerald-400" : tone === "danger" ? "text-rose-400" : tone === "info" ? "text-sky-300" : "";
  return (
    <div className="rounded-md border border-border/40 bg-secondary/30 p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
