import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { SettingsGrid } from "@/features/ayar/components/settings-grid";
import { getCompany, getMerkezStats, getCompanyProfileCompleteness } from "@/features/ayar/queries";

export const metadata: Metadata = { title: "Ayarlar" };

export default async function AyarlarHubPage() {
  const [company, stats, completeness] = await Promise.all([
    getCompany(),
    getMerkezStats(),
    getCompanyProfileCompleteness(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-1">
      {/* Page title — clean typography, no card chrome */}
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tənzimləmələr</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Şirkət, iş axını, avtomatlaşdırma və inteqrasiya
          </p>
        </div>
      </header>

      {/* Company strip — minimal, info-rich */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/40 bg-card/60 p-3.5 backdrop-blur">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-base font-bold text-white shadow"
          style={{ background: "var(--brand-gradient)" }}
        >
          {(company?.ad ?? "?").slice(0, 1).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 className="truncate text-[14px] font-bold">{company?.ad ?? "Şirkət"}</h2>
            {company?.voen && (
              <span className="text-[11px] text-muted-foreground">VÖEN {company.voen}</span>
            )}
            {company?.email && (
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                · {company.email}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {completeness.percent < 100 ? (
              <>
                <div className="h-1 w-32 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${completeness.percent}%`,
                      background: "var(--brand-gradient)",
                    }}
                  />
                </div>
                <span className="text-[10.5px] tabular-nums text-muted-foreground">
                  Profil {completeness.percent}%
                </span>
                {completeness.missing.length > 0 && (
                  <span className="hidden text-[10.5px] text-muted-foreground/80 sm:inline">
                    · doldur: {completeness.missing.slice(0, 2).join(", ")}
                  </span>
                )}
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Profil tam doldurulub
              </span>
            )}
          </div>
        </div>

        <Link
          href="/ayarlar/kompaniya"
          className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-[12px] font-semibold transition-colors hover:border-primary/30 hover:bg-secondary"
        >
          Profili aç <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <SettingsGrid stats={{ branchTotal: stats.branchTotal, userCount: stats.userCount }} />
    </div>
  );
}
