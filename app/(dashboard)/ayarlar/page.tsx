import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsGrid } from "@/features/ayar/components/settings-grid";
import { getCompany, getMerkezStats, getCompanyProfileCompleteness } from "@/features/ayar/queries";

export const metadata: Metadata = { title: "Ayarlar" };
export const dynamic = "force-dynamic";

/**
 * Ayarlar Hub — minimalist, axtarış-əsaslı:
 *   • Sticky search input (40+ ayar üçün vacib)
 *   • Kompakt profil header (1 sətr + tamamlanma bar sub-100%)
 *   • 5 super-qrup ilə kompakt tile grid (4-5 sütun)
 *   • Hər tile yalnız ikon + başlıq + opsional badge
 *   • Təsvirlər tooltip-də (hover)
 *
 * Qrup məlumatları client-side `settings-grid.tsx` daxilindədir
 * (RSC boundary üzərindən LucideIcon-ları ötürmək qadağandır).
 */
export default async function AyarlarHubPage() {
  const [company, stats, completeness] = await Promise.all([
    getCompany(),
    getMerkezStats(),
    getCompanyProfileCompleteness(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Tənzimləmələr</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Şirkət, istifadəçi, iş axını, avtomatlaşdırma və inteqrasiya
        </p>
      </header>

      <Card className="glass">
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-base font-bold text-white"
            style={{ background: "var(--brand-gradient)" }}
          >
            {(company?.ad ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 className="truncate text-sm font-bold">{company?.ad ?? "Şirkət"}</h2>
              {company?.voen && (
                <span className="text-[10.5px] text-muted-foreground">VÖEN {company.voen}</span>
              )}
              {company?.email && (
                <span className="hidden text-[10.5px] text-muted-foreground sm:inline">
                  · {company.email}
                </span>
              )}
            </div>
            {completeness.percent < 100 && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 w-32 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${completeness.percent}%`, background: "var(--brand-gradient)" }}
                  />
                </div>
                <span className="text-[10.5px] tabular-nums text-muted-foreground">
                  Profil {completeness.percent}%
                  {completeness.missing.length > 0 && (
                    <span className="ml-1 hidden sm:inline">
                      · doldurulmamış: {completeness.missing.slice(0, 2).join(", ")}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
          <Link
            href="/ayarlar/kompaniya"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-secondary"
          >
            Redaktə <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>

      <SettingsGrid stats={{ branchTotal: stats.branchTotal, userCount: stats.userCount }} />
    </div>
  );
}
