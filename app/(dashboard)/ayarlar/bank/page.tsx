import type { Metadata } from "next";
import Link from "next/link";
import { Landmark, Wallet, CreditCard, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ViewToggle } from "@/components/ui/view-toggle";
import { getViewMode } from "@/components/ui/view-mode";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { cn, formatMoney } from "@/lib/utils";
import { HesabDialog } from "@/features/ayarlar/components/hesab-dialog";

export const metadata: Metadata = { title: "Maliyyə hesabları" };

type SearchParams = Promise<{ view?: string }>;

async function getAccounts() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.maliye_hesablari.findMany({
      where: { sahibkar_id: sahibkarId },
      orderBy: [{ aktiv: "desc" }, { ad: "asc" }],
      include: {
        filiallar: { select: { ad: true } },
      },
    });
  });
}

async function getFilialOptions() {
  return withTenant(async () =>
    prisma.filiallar.findMany({
      where: { aktiv: true },
      select: { id: true, ad: true },
      orderBy: { ad: "asc" },
    }),
  );
}

const NOV_INFO: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  negd: { label: "Nağd", icon: Wallet, cls: "text-emerald-500 bg-emerald-500/10 border-emerald-500/40" },
  bank: { label: "Bank", icon: Landmark, cls: "text-primary bg-primary/10 border-primary/40" },
  kart: { label: "Kart", icon: CreditCard, cls: "text-violet-500 bg-violet-500/10 border-violet-500/40" },
};

export default async function AyarBankPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const view = getViewMode(sp as Record<string, string | undefined>, "view", "card");

  const [accounts, filiallar] = await Promise.all([getAccounts(), getFilialOptions()]);
  const aktivAccounts = accounts.filter((a) => a.aktiv);
  const byCurrency = new Map<string, number>();
  for (const a of aktivAccounts) {
    const v = a.valyuta ?? "AZN";
    byCurrency.set(v, (byCurrency.get(v) ?? 0) + Number(a.qaliq ?? 0));
  }
  const negdCem = aktivAccounts.filter((a) => a.nov === "negd").reduce((s, a) => s + Number(a.qaliq ?? 0), 0);
  const bankCem = aktivAccounts.filter((a) => a.nov === "bank" || a.nov === "kart").reduce((s, a) => s + Number(a.qaliq ?? 0), 0);
  const totalAZN = byCurrency.get("AZN") ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Maliyyə hesabları</h1>
            <p className="text-sm text-muted-foreground">
              Kassa, bank və kart hesabları · {accounts.length} hesab · {accounts.filter((a) => a.aktiv).length} aktiv
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle modes={["card", "list"]} />
          <Link
            href="/ayarlar/bank-inteqrasiya"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            <TrendingUp className="h-3.5 w-3.5" /> Bank inteqrasiya
          </Link>
          <HesabDialog filiallar={filiallar} />
        </div>
      </header>


      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Ümumi balans (AZN)" value={formatMoney(totalAZN)} tone="primary" icon={Landmark} />
        <Stat label="Nağd kassa" value={formatMoney(negdCem)} tone="emerald" icon={Wallet} />
        <Stat label="Bank + Kart" value={formatMoney(bankCem)} icon={CreditCard} />
        <Stat label="Aktiv hesab" value={String(aktivAccounts.length)} tone="muted" icon={Landmark} />
      </div>

      {byCurrency.size > 1 && (
        <Card className="glass">
          <CardContent className="flex flex-wrap items-center gap-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Çoxlu valyuta:
            </span>
            {Array.from(byCurrency.entries()).map(([v, amount]) => (
              <Badge key={v} variant="outline" className="text-xs">
                {v}: <span className="ml-1 font-bold tabular-nums">{formatMoney(amount)}</span>
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {accounts.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <Landmark className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Maliyyə hesabı yoxdur.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Yuxarıdakı «Yeni hesab» düyməsi ilə nağd kassa, bank və ya kart hesabı yarat.
            </p>
            <div className="mt-4 flex justify-center">
              <HesabDialog filiallar={filiallar} />
            </div>
          </CardContent>
        </Card>
      ) : view === "list" ? (
        <Card className="glass">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/40 text-left">
                    <th className="w-10 px-3 py-2"></th>
                    <th className="px-3 py-2">Hesab</th>
                    <th className="px-3 py-2">Növ</th>
                    <th className="px-3 py-2">Bank / IBAN</th>
                    <th className="px-3 py-2">Filial</th>
                    <th className="px-3 py-2">Valyuta</th>
                    <th className="px-3 py-2 text-right">Balans</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="w-10 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((h) => {
                    const info = NOV_INFO[h.nov] ?? NOV_INFO.bank;
                    const Icon = info.icon;
                    return (
                      <tr key={h.id} className={cn("border-b border-border/20", !h.aktiv && "opacity-60")}>
                        <td className="px-3 py-2">
                          <Icon className={cn("h-4 w-4", info.cls.split(" ")[0])} />
                        </td>
                        <td className="px-3 py-2 text-sm font-semibold">
                          {h.ad}
                          {h.kart_son4 && <span className="ml-1 font-mono text-[10.5px] text-muted-foreground">···{h.kart_son4}</span>}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={cn("text-[10px]", info.cls)}>{info.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {h.bank_adi && <div>{h.bank_adi}</div>}
                          {h.iban && <div className="font-mono">{h.iban}</div>}
                        </td>
                        <td className="px-3 py-2 text-xs">{h.filiallar?.ad ?? "—"}</td>
                        <td className="px-3 py-2 text-xs font-mono">{h.valyuta ?? "AZN"}</td>
                        <td className="px-3 py-2 text-right text-sm font-bold tabular-nums">
                          {formatMoney(Number(h.qaliq ?? 0))}
                        </td>
                        <td className="px-3 py-2">
                          {h.aktiv ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/40">aktiv</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">passiv</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <HesabDialog
                            filiallar={filiallar}
                            hesab={{
                              id: h.id,
                              ad: h.ad,
                              nov: h.nov,
                              valyuta: h.valyuta,
                              bank_adi: h.bank_adi,
                              iban: h.iban,
                              kart_son4: h.kart_son4,
                              pos_kodu: h.pos_kodu,
                              filial_id: h.filial_id,
                              qeyd: h.qeyd,
                              aktiv: h.aktiv,
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((h) => {
            const info = NOV_INFO[h.nov] ?? NOV_INFO.bank;
            const Icon = info.icon;
            const balance = Number(h.qaliq ?? 0);
            return (
              <Card key={h.id} className={cn("glass", !h.aktiv && "opacity-60")}>
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", info.cls)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-bold">{h.ad}</h3>
                        {!h.aktiv && <Badge variant="outline" className="text-[9px]">passiv</Badge>}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className={cn("text-[9px]", info.cls)}>{info.label}</Badge>
                        {h.filiallar?.ad && <span>· {h.filiallar.ad}</span>}
                      </div>
                    </div>
                    <HesabDialog
                      filiallar={filiallar}
                      hesab={{
                        id: h.id,
                        ad: h.ad,
                        nov: h.nov,
                        valyuta: h.valyuta,
                        bank_adi: h.bank_adi,
                        iban: h.iban,
                        kart_son4: h.kart_son4,
                        pos_kodu: h.pos_kodu,
                        filial_id: h.filial_id,
                        qeyd: h.qeyd,
                        aktiv: h.aktiv,
                      }}
                    />
                  </div>

                  {h.bank_adi && (
                    <div className="text-xs">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bank</div>
                      <div className="font-semibold">{h.bank_adi}</div>
                    </div>
                  )}
                  {h.iban && (
                    <div className="text-xs">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">IBAN</div>
                      <div className="break-all font-mono">{h.iban}</div>
                    </div>
                  )}
                  {h.kart_son4 && (
                    <div className="text-xs">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Kart son 4</div>
                      <div className="font-mono">···{h.kart_son4}</div>
                    </div>
                  )}

                  <div className="flex items-end justify-between border-t border-border/40 pt-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Balans</span>
                    <div className="text-right">
                      <div className={cn("text-xl font-bold tabular-nums", balance < 0 ? "text-rose-500" : "")}>
                        {formatMoney(balance)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{h.valyuta ?? "AZN"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "default" | "primary" | "emerald" | "muted";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const cls =
    tone === "primary"
      ? "text-primary"
      : tone === "emerald"
      ? "text-emerald-500"
      : tone === "muted"
      ? "text-muted-foreground"
      : "text-foreground";
  return (
    <div className="glass flex items-center gap-3 rounded-xl border border-border/40 px-3 py-2.5">
      <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary", cls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-lg font-bold tabular-nums ${cls}`}>{value}</div>
      </div>
    </div>
  );
}
