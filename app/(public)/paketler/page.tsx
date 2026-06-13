import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { prismaUnscoped } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/utils";
import { MeshHero, PublicFooter } from "@/components/public/ui";

export const metadata: Metadata = { title: "Paketlər — 360Biznes" };
export const revalidate = 300;

const HIGHLIGHTS: Record<string, string[]> = {
  baslangic: [
    "Anbar, satış, müştəri idarəsi",
    "POS / İsti satış",
    "Sadə hesabatlar",
    "1 filial",
    "Email dəstəyi",
  ],
  peshekar: [
    "Bütün başlanğıc funksiyalar",
    "Marketplace inteqrasiyaları",
    "AI cavab generatoru",
    "Çoxlu filial",
    "WhatsApp broadcast",
    "Detallı hesabatlar + P&L",
    "Prioritet dəstək",
  ],
  korporativ: [
    "Bütün Peşəkar funksiyalar",
    "Limitsiz işçi və məhsul",
    "Sahibkar gizli bölmə",
    "Custom domen",
    "API + webhook",
    "Custom hesabatlar",
    "Dedicated account manager",
  ],
};

const FEATURED = "peshekar";

export default async function PaketlerPage() {
  const plans = await prismaUnscoped.abune_planlari.findMany({
    where: { aktiv: true },
    orderBy: { ayl_q_qiymet: "asc" },
  });

  return (
    <>
      <MeshHero
        badge="15 günlük pulsuz demo — kart məlumatı yoxdur"
        title={<>Biznesinizə uyğun <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-300 bg-clip-text text-transparent">paket seçin</span></>}
        sub="Bütün paketlər aylıq və ya illik (2 ay endirimlə) seçilə bilər. İstənilən vaxt yüksəldin və ya dəyişin."
      />

      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {plans.map((p) => {
            const featured = p.kod === FEATURED;
            const features = HIGHLIGHTS[p.kod] ?? [];
            return (
              <div
                key={p.id}
                className={`relative overflow-hidden rounded-2xl border bg-card p-7 transition hover:-translate-y-1 ${
                  featured ? "border-primary/50 shadow-xl shadow-primary/10 md:scale-[1.03]" : "border-border hover:shadow-lg"
                }`}
              >
                {featured && (
                  <div className="absolute right-5 top-5 rounded-full px-3 py-1 text-[10.5px] font-bold text-white" style={{ background: "var(--brand-gradient)" }}>
                    Ən populyar
                  </div>
                )}
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{p.kod}</div>
                <h3 className="mt-1 text-2xl font-black">{p.ad}</h3>

                <div className="mt-4">
                  <span className="text-4xl font-black brand-text">{formatMoney(Number(p.ayl_q_qiymet))}</span>
                  <div className="mt-1 text-xs text-muted-foreground">aylıq · ƏDV daxil</div>
                  {p.illik_qiymet && (
                    <div className="mt-1 text-xs font-medium text-primary-light">
                      İllik: {formatMoney(Number(p.illik_qiymet))} (2 ay pulsuz)
                    </div>
                  )}
                </div>

                <ul className="mt-5 space-y-2 border-t border-border pt-5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-light" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {(p.max_istifadeci || p.max_mehsul || p.max_mesaj_ayl_q) && (
                  <div className="mt-5 space-y-2 border-t border-border pt-5 text-xs text-muted-foreground">
                    {p.max_istifadeci && <Row label="Maks. istifadəçi" value={`${p.max_istifadeci}`} />}
                    {p.max_mehsul && <Row label="Maks. məhsul" value={`${p.max_mehsul}`} />}
                    {p.max_mesaj_ayl_q && <Row label="Aylıq mesaj" value={`${p.max_mesaj_ayl_q}`} />}
                  </div>
                )}

                <Link
                  href={`/qeydiyyat?plan=${p.kod}`}
                  className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition hover:opacity-90"
                  style={
                    featured
                      ? { background: "var(--brand-gradient)", color: "#fff" }
                      : { background: "hsl(var(--secondary))", color: "hsl(var(--secondary-foreground))" }
                  }
                >
                  Pulsuz başla <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center text-sm text-muted-foreground">
          Suallar?{" "}
          <Link href="/faq" className="text-primary-light hover:underline">FAQ-a baxın</Link>
          {" "}və ya{" "}
          <Link href="/demo" className="text-primary-light hover:underline">demo sifariş edin</Link>.
        </div>
      </div>

      <PublicFooter />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}
