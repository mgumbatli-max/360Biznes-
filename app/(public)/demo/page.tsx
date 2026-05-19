import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Sparkles, ArrowRight, Zap, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Demo" };

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 pb-20 pt-12">
      <header className="text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary-light" />
          15 günlük tam funksiyalı sınaq
        </div>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          <span className="brand-text">Bir kliklə</span> başlayın
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Kart məlumatı, kompromis yox. Qeydiyyatdan sonra dərhal bütün modullara giriş.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="glass">
          <CardContent className="space-y-2 py-5 text-center">
            <Zap className="mx-auto h-6 w-6 text-primary-light" />
            <div className="font-semibold">Dərhal başla</div>
            <div className="text-xs text-muted-foreground">2 dəqiqədə hesab açılır</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="space-y-2 py-5 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-success" />
            <div className="font-semibold">Tam funksiya</div>
            <div className="text-xs text-muted-foreground">Bütün modullar açıq</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="space-y-2 py-5 text-center">
            <ShieldCheck className="mx-auto h-6 w-6 text-info" />
            <div className="font-semibold">Risk yox</div>
            <div className="text-xs text-muted-foreground">15 gün sonra avtomatik bitir</div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-2xl border border-primary/30 p-8 text-center" style={{ background: "linear-gradient(135deg, hsl(239 84% 67% / 0.12), hsl(262 83% 67% / 0.08))" }}>
        <h2 className="text-2xl font-bold tracking-tight">Hazırsınız?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Şirkət adı, email və telefon yetər. Bir neçə saniyədə dashboard-a daxil olun.
        </p>
        <Link
          href="/qeydiyyat"
          className="mt-6 inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold text-white shadow-lg"
          style={{ background: "var(--brand-gradient)", boxShadow: "var(--brand-glow)" }}
        >
          Pulsuz demo başlat
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Suallar?{" "}
        <Link href="/faq" className="text-primary-light hover:underline">FAQ</Link>
        {" "}və ya{" "}
        <a href="mailto:salam@360biznes.az" className="text-primary-light hover:underline">salam@360biznes.az</a>
      </div>
    </div>
  );
}
