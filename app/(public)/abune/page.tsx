import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { prismaUnscoped } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/utils";
import { MeshHero, PublicFooter } from "@/components/public/ui";

export const metadata: Metadata = { title: "Abunə paketlər — 360Biznes" };
export const revalidate = 300;

async function getActivePlans() {
  return prismaUnscoped.abune_planlari.findMany({
    where: { aktiv: true },
    orderBy: { ayl_q_qiymet: "asc" },
  });
}

export default async function PublicAbunePage() {
  const plans = await getActivePlans();

  return (
    <>
      <MeshHero
        badge="Şəffaf qiymət — gizli xərc yox"
        title={<>Şəffaf <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-300 bg-clip-text text-transparent">abunəlik</span></>}
        sub="Aylıq və ya illik ödəyin, istənilən vaxt ləğv edin. Bütün paketlərdə 15 günlük pulsuz demo."
      />

      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p, idx) => {
            const tovsiye = idx === 1;
            const features = Array.isArray(p.funksiyalar) ? (p.funksiyalar as string[]) : [];
            return (
              <div
                key={p.id}
                className={`relative overflow-hidden rounded-2xl border bg-card p-7 transition hover:-translate-y-1 ${
                  tovsiye ? "border-primary/50 shadow-xl shadow-primary/10 md:scale-[1.03]" : "border-border hover:shadow-lg"
                }`}
              >
                {tovsiye && (
                  <div className="absolute right-5 top-5 rounded-full px-3 py-1 text-[10.5px] font-bold text-white" style={{ background: "var(--brand-gradient)" }}>
                    Tövsiyə
                  </div>
                )}
                <h3 className="text-xl font-black">{p.ad}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-black brand-text tabular-nums">{formatMoney(Number(p.ayl_q_qiymet))}</span>
                  <span className="text-sm text-muted-foreground">/ay</span>
                </div>
                {p.illik_qiymet && (
                  <p className="mt-1 text-xs font-medium text-primary-light">
                    İllik {formatMoney(Number(p.illik_qiymet))} (2 ay endirim)
                  </p>
                )}

                <ul className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
                  <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-light" /><span>{p.max_istifadeci ? `${p.max_istifadeci} istifadəçi` : "Limitsiz istifadəçi"}</span></li>
                  <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-light" /><span>{p.max_mehsul ? `${p.max_mehsul} məhsul` : "Limitsiz məhsul"}</span></li>
                  <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-light" /><span>{p.max_mesaj_ayl_q ? `${p.max_mesaj_ayl_q} mesaj/ay` : "Limitsiz mesaj"}</span></li>
                  {features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-light" /><span>{f}</span></li>
                  ))}
                </ul>

                <Link
                  href="/qeydiyyat"
                  className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition hover:opacity-90"
                  style={tovsiye ? { background: "var(--brand-gradient)", color: "#fff" } : { background: "hsl(var(--secondary))", color: "hsl(var(--secondary-foreground))" }}
                >
                  Başla <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center text-sm text-muted-foreground">
          Sualınız var?{" "}
          <Link href="/faq" className="text-primary-light hover:underline">FAQ səhifəsinə baxın</Link>{" "}
          və ya{" "}
          <Link href="/demo" className="text-primary-light hover:underline">demo sifariş edin</Link>.
        </div>
      </div>

      <PublicFooter />
    </>
  );
}
