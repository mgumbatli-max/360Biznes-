import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { prismaUnscoped } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Abunə paketlər — 360Biznes" };
export const dynamic = "force-dynamic";

async function getActivePlans() {
  return prismaUnscoped.abune_planlari.findMany({
    where: { aktiv: true },
    orderBy: { ayl_q_qiymet: "asc" },
  });
}

export default async function PublicAbunePage() {
  const plans = await getActivePlans();

  return (
    <div className="px-6">
      <section className="mx-auto max-w-4xl pb-10 pt-12 text-center md:pt-16">
        <h1 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">
          <span className="brand-text">Şəffaf abunəlik</span>
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Aylıq, gizli xərc yox. Hər zaman ləğv edə bilərsiniz.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-5 pb-16 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p, idx) => {
          const tovsiye = idx === 1;
          const features = Array.isArray(p.funksiyalar) ? (p.funksiyalar as string[]) : [];
          return (
            <div
              key={p.id}
              className={`glass relative rounded-2xl p-6 ${tovsiye ? "border-primary/40 ring-1 ring-primary/30" : ""}`}
            >
              {tovsiye && (
                <div
                  className="absolute -top-3 right-4 rounded-full px-3 py-0.5 text-[10.5px] font-semibold text-white"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  Tövsiyə
                </div>
              )}
              <h3 className="text-xl font-bold">{p.ad}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold tabular-nums">{formatMoney(Number(p.ayl_q_qiymet))}</span>
                <span className="text-sm text-muted-foreground">/ay</span>
              </div>
              {p.illik_qiymet && (
                <p className="mt-1 text-xs text-muted-foreground">
                  və ya illik {formatMoney(Number(p.illik_qiymet))} (2 ay endirim)
                </p>
              )}

              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                  <span>{p.max_istifadeci ? `${p.max_istifadeci} istifadəçi` : "Limitsiz istifadəçi"}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                  <span>{p.max_mehsul ? `${p.max_mehsul} məhsul` : "Limitsiz məhsul"}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                  <span>{p.max_mesaj_ayl_q ? `${p.max_mesaj_ayl_q} mesaj/ay` : "Limitsiz mesaj"}</span>
                </li>
                {features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/qeydiyyat"
                className={`mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-semibold transition ${
                  tovsiye
                    ? "text-white hover:opacity-90"
                    : "border border-border bg-card/50 hover:bg-card"
                }`}
                style={tovsiye ? { background: "var(--brand-gradient)" } : undefined}
              >
                Başla <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          );
        })}
      </section>

      <section className="mx-auto max-w-3xl pb-20 text-center text-sm text-muted-foreground">
        Sualınız var?{" "}
        <Link href="/faq" className="text-primary-light hover:underline">FAQ səhifəsinə baxın</Link>{" "}
        və ya{" "}
        <Link href="/demo" className="text-primary-light hover:underline">demo sifariş edin</Link>.
      </section>
    </div>
  );
}
