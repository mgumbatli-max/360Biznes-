import type { Metadata } from "next";
import { Handshake, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { KonsDialog } from "@/features/anbar/konsiqnasiya/components/kons-dialog";
import { KonsFilters } from "@/features/anbar/konsiqnasiya/components/kons-filters";
import { KonsTable } from "@/features/anbar/konsiqnasiya/components/kons-table";
import { EmptyState } from "@/components/ui/empty-state";
import { getKonsList, getKonsOptions } from "@/features/anbar/konsiqnasiya/queries";

export const metadata: Metadata = { title: "Konsiqnasiya" };

type SP = { q?: string; istiqamet?: string; kontragent?: string; status?: string };

export default async function KonsiqnasiyaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { requireAnbarPerm } = await import("@/features/anbar/access-guard");
  await requireAnbarPerm("konsiqnasiya.oxu");

  const sp = await searchParams;
  const [rows, options] = await Promise.all([
    getKonsList({ q: sp.q, istiqamet: sp.istiqamet, kontragentId: sp.kontragent, status: sp.status }),
    getKonsOptions(),
  ]);

  const hasFilters = !!(sp.q || sp.istiqamet || sp.kontragent || sp.status);
  const isEmpty = rows.length === 0 && !hasFilters;

  return (
    <div className="mx-auto max-w-7xl">
      <AnbarSubNav active="/anbar/konsiqnasiya" />
      <div className="space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Konsiqnasiya</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Satılana qədər mülkiyyəti tərəf-müqabildə qalan mallar.
            </p>
          </div>
          <KonsDialog kontragents={options.kontragents} products={options.products} />
        </header>

        {isEmpty ? (
          <EmptyState
            icon={Handshake}
            tone="primary"
            title="Hələ konsiqnasiya yoxdur"
            description="Konsiqnasiya — başqa mağazaya verdiyiniz, lakin satılana qədər sizin sayılan mallar (və ya əksinə)."
            help="Konsiqnasiyanın 2 istiqaməti var: 'Verilən' — siz başqasına vermisiniz, satılanda hesab gəlir. 'Götürülən' — siz başqasından götürmüsünüz, satılan qədər ödəmirsiniz."
            examples={[
              { icon: ArrowUpRight,  title: "Verilən (sizdən başqasına)", desc: "Siz Apple AZ MMC-ə 10 ədəd telefon vermisiniz — satılanda hesab kəsilir" },
              { icon: ArrowDownLeft, title: "Götürülən (başqasından sizə)", desc: "Siz Lidl-dən 50 məhsul almısınız — yalnız satılanı ödəyəcəksiniz" },
            ]}
            actions={[
              { label: "Yeni konsiqnasiya", tone: "primary", href: "/anbar/konsiqnasiya?yeni=1", icon: Handshake },
            ]}
          />
        ) : (
          <>
            <KonsFilters kontragents={options.kontragents.map((k) => ({ id: k.id, ad: k.ad }))} />
            <KonsTable rows={rows} />
          </>
        )}
      </div>
    </div>
  );
}
