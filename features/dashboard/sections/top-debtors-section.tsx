import { Suspense } from "react";
import Link from "next/link";
import { Wallet, ChevronRight } from "lucide-react";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/utils";

type Debtor = {
  id: string;
  ad: string;
  telefon: string | null;
  borc: number;
  gecikme_gun: number;
  acig_say: number;
};

async function getTopDebtors(limit = 5): Promise<Debtor[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.$queryRaw<
      {
        id: string;
        ad: string;
        telefon: string | null;
        borc: number;
        gecikme_gun: number;
        acig_say: number;
      }[]
    >(Prisma.sql`
      SELECT k.id,
             k.ad,
             k.telefon,
             COALESCE(SUM(s.son_mebleg - COALESCE(s.odenilmis, 0)), 0)::float AS borc,
             COALESCE(MAX((CURRENT_DATE - s.tarix)), 0)::int AS gecikme_gun,
             COUNT(*)::int AS acig_say
        FROM kontragentler k
        JOIN satis_sifarisleri s ON s.musteri_id = k.id
       WHERE k.sahibkar_id = ${sahibkarId}::uuid
         AND s.sahibkar_id = ${sahibkarId}::uuid
         AND s.status <> 'legv'
         AND COALESCE(s.qaralama, false) = false
         AND s.odenis_nov IN ('nisye', 'borc')
         AND s.son_mebleg - COALESCE(s.odenilmis, 0) > 0
       GROUP BY k.id, k.ad, k.telefon
       ORDER BY borc DESC
       LIMIT ${limit}
    `);
    return rows.map((r) => ({
      id: r.id,
      ad: r.ad,
      telefon: r.telefon,
      borc: Number(r.borc),
      gecikme_gun: Number(r.gecikme_gun),
      acig_say: Number(r.acig_say),
    }));
  });
}

async function TopDebtorsInner() {
  const debtors = await getTopDebtors(5);
  const total = debtors.reduce((s, d) => s + d.borc, 0);

  return (
    <section className="rounded-xl border border-border bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/15 text-amber-700">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Top borclu müştərilər</h3>
            <p className="text-[10.5px] text-muted-foreground">
              {debtors.length > 0
                ? `Cəmi açıq borc: ${formatMoney(total)}`
                : "Aktiv borc yoxdur"}
            </p>
          </div>
        </div>
        <Link
          href="/maliyye/debitor"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10.5px] text-muted-foreground hover:text-foreground"
        >
          Hamısı
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {debtors.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-background/40 py-6 text-center text-xs text-muted-foreground">
          🎉 Açıq müştəri borcu yoxdur
        </div>
      ) : (
        <ul className="space-y-1">
          {debtors.map((d) => {
            const tone =
              d.gecikme_gun >= 90
                ? "border-rose-500/40 bg-rose-500/10"
                : d.gecikme_gun >= 30
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-border bg-background/40";
            return (
              <li key={d.id}>
                <Link
                  href={`/elaqe/musteriler/${d.id}`}
                  className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs transition hover:bg-secondary ${tone}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{d.ad}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {d.acig_say} açıq sənəd
                      {d.gecikme_gun > 0 && ` · ${d.gecikme_gun} gün gecikmə`}
                      {d.telefon && ` · ${d.telefon}`}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-bold tabular-nums text-amber-700 dark:text-amber-300">
                      {formatMoney(d.borc)}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="h-48 animate-pulse rounded-xl border border-border bg-card/40" />
  );
}

export function TopDebtorsSection() {
  return (
    <Suspense fallback={<Skeleton />}>
      <TopDebtorsInner />
    </Suspense>
  );
}
