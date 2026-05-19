import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prismaUnscoped } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Paketlər" };
export const dynamic = "force-dynamic";

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
    "Marketplace inteqrasiyaları (Umico, Birmarket)",
    "AI cavab generator",
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
    <div className="mx-auto max-w-6xl space-y-12 px-6 pb-20 pt-12">
      <header className="text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary-light" />
          15 günlük pulsuz demo — kart məlumatı yoxdur
        </div>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Biznesinizə uyğun
          <br />
          <span className="brand-text">paket seçin</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-muted-foreground">
          Bütün paketlər aylıq və ya illik (2 ay endirimlə) seçilə bilər. İstənilən vaxt dəyişdirə bilərsiniz.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {plans.map((p) => {
          const featured = p.kod === FEATURED;
          const features = HIGHLIGHTS[p.kod] ?? [];
          return (
            <Card
              key={p.id}
              className={`glass relative overflow-hidden ${featured ? "border-primary/50 md:scale-[1.03]" : ""}`}
            >
              {featured && (
                <div className="absolute right-4 top-4">
                  <Badge style={{ background: "var(--brand-gradient)" }} className="border-0 text-white">
                    Ən populyar
                  </Badge>
                </div>
              )}
              <CardContent className="space-y-5 py-7">
                <div>
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{p.kod}</div>
                  <h3 className="mt-1 text-2xl font-bold">{p.ad}</h3>
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold brand-text">{formatMoney(Number(p.ayl_q_qiymet))}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">aylıq · ƏDV daxil</div>
                  {p.illik_qiymet && (
                    <div className="mt-1 text-xs text-success">
                      İllik: {formatMoney(Number(p.illik_qiymet))} (2 ay pulsuz)
                    </div>
                  )}
                </div>

                <ul className="space-y-2 border-t border-border/40 pt-4">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2 border-t border-border/40 pt-4 text-xs text-muted-foreground">
                  {p.max_istifadeci && <Row label="Maks. istifadəçi" value={`${p.max_istifadeci}`} />}
                  {p.max_mehsul && <Row label="Maks. məhsul" value={`${p.max_mehsul}`} />}
                  {p.max_mesaj_ayl_q && <Row label="Aylıq mesaj" value={`${p.max_mesaj_ayl_q}`} />}
                </div>

                <Link
                  href={`/qeydiyyat?plan=${p.kod}`}
                  className="block w-full rounded-md py-2.5 text-center text-sm font-semibold transition hover:opacity-90"
                  style={
                    featured
                      ? { background: "var(--brand-gradient)", color: "#fff" }
                      : { background: "hsl(var(--secondary))", color: "hsl(var(--secondary-foreground))" }
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    Pulsuz başla
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Suallar?{" "}
        <Link href="/faq" className="text-primary-light hover:underline">FAQ-a baxın</Link>
        {" "}və ya{" "}
        <Link href="/demo" className="text-primary-light hover:underline">demo xahiş edin</Link>.
      </div>
    </div>
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
