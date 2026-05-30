import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Wrench,
  CheckCircle2,
  Calendar,
  Tag,
  Phone,
  RefreshCw,
  Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getServisTrackByToken } from "@/features/servis/queries";
import { SERVIS_STATUS_LABELS } from "@/features/servis/types";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Servis izlə" };

export default async function ServisTrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const s = await getServisTrackByToken(token);
  if (!s) notFound();

  const statusMeta = SERVIS_STATUS_LABELS[s.status] ?? SERVIS_STATUS_LABELS.qebul_edildi;
  const closed = s.status === "musteriye_tehvil" || s.status === "qaytarildi";
  const overdue =
    !closed && s.texmini_tehvil && new Date(s.texmini_tehvil) < new Date();
  const balance = s.temir_xerci - s.musteriden_alinan;

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-center">
          <div
            className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Wrench className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Servis izləmə</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sifarişinizin cari statusu və vəd tarixi
          </p>
        </div>

        <Card className="glass">
          <CardContent className="space-y-4 py-6">
            <div className="flex items-start justify-between gap-2">
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

            {overdue && (
              <div className="rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-300">
                Vəd tarixi keçib. Əməkdaşlarımız sizinlə qısa zamanda əlaqə saxlayacaq.
              </div>
            )}

            <div className="space-y-2.5 border-t border-border/40 pt-4 text-sm">
              {s.sahibkarlar?.ad && (
                <Field icon={Building2} label="Mağaza" value={s.sahibkarlar.ad} />
              )}
              <Field icon={Tag} label="Məhsul" value={s.mehsul_ad} />
              {s.mehsul_seri_nomresi && (
                <Field icon={Tag} label="Seriya" value={s.mehsul_seri_nomresi} mono />
              )}
              <Field icon={Phone} label="Müştəri" value={s.musteri_ad} />
              {s.yaradildi && (
                <Field icon={Calendar} label="Qəbul tarixi" value={formatDate(s.yaradildi)} />
              )}
              {s.texmini_tehvil && (
                <Field
                  icon={Calendar}
                  label="Vəd tarixi"
                  value={formatDate(s.texmini_tehvil)}
                  tone={overdue ? "danger" : undefined}
                />
              )}
              {s.qapanma_tarixi && (
                <Field
                  icon={CheckCircle2}
                  label="Təhvil tarixi"
                  value={formatDate(s.qapanma_tarixi)}
                  tone="success"
                />
              )}
            </div>

            {s.problem_tesviri && (
              <div className="rounded-md border border-border/40 bg-secondary/40 p-3 text-sm">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Problem təsviri
                </div>
                <p className="whitespace-pre-wrap text-foreground">{s.problem_tesviri}</p>
              </div>
            )}

            {(s.temir_xerci > 0 || s.musteriden_alinan > 0) && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <Cell label="Yekun" value={formatMoney(s.temir_xerci)} />
                <Cell
                  label="Ödənilib"
                  value={formatMoney(s.musteriden_alinan)}
                  tone="success"
                />
                <Cell
                  label="Qalıq"
                  value={formatMoney(balance > 0 ? balance : 0)}
                  tone={balance > 0 ? "danger" : "success"}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status timeline (müştəri-üzü) */}
        {s.servis_status_tarixce.length > 0 && (
          <Card className="glass">
            <CardContent className="space-y-3 py-5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Status tarixçəsi
              </div>
              <ol className="relative space-y-3">
                {s.servis_status_tarixce.map((t) => {
                  const meta = SERVIS_STATUS_LABELS[t.yeni_status];
                  return (
                    <li
                      key={t.id}
                      className="rounded-md border border-border/40 bg-card/40 p-2.5 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className={meta?.cls ?? ""}>
                          {meta?.label ?? t.yeni_status}
                        </Badge>
                        {t.yaradildi && (
                          <span className="text-[10.5px] text-muted-foreground">
                            {new Date(t.yaradildi).toLocaleString("az-AZ")}
                          </span>
                        )}
                      </div>
                      {t.qeyd && (
                        <p className="mt-1 text-xs text-muted-foreground">{t.qeyd}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-center gap-2 pt-2">
          <Link
            href={`/servis-track/${token}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm hover:bg-secondary"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Yenidən yoxla
          </Link>
        </div>

        <p className="text-center text-[10.5px] text-muted-foreground">
          360Biznes vasitəsi ilə servis izləmə
        </p>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  mono,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
  tone?: "success" | "danger";
}) {
  const toneCls = tone === "success" ? "text-emerald-400" : tone === "danger" ? "text-rose-400" : "";
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`font-medium ${mono ? "font-mono text-xs" : ""} ${toneCls}`}>{value}</div>
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
  tone?: "success" | "danger";
}) {
  const cls = tone === "success" ? "text-emerald-400" : tone === "danger" ? "text-rose-400" : "";
  return (
    <div className="rounded-md border border-border/40 bg-secondary/30 p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
