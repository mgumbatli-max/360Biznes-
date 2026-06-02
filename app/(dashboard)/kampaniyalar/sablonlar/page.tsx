import type { Metadata } from "next";
import { Sparkles, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { TEMPLATES } from "@/features/kampaniyalar/templates";
import { TemplateCard } from "@/features/kampaniyalar/components/template-card";

export const metadata: Metadata = { title: "Hazır kampaniya şablonları" };

export default function SablonlarPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/kampaniyalar" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" /> Kampaniyalar
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Sparkles className="h-6 w-6 text-violet-500" />
          Hazır şablonlar
        </h1>
        <p className="text-sm text-muted-foreground">
          Dünya praktikasından inspirasiya ilə hazırlanmış {TEMPLATES.length} şablon. Bir kliklə götür, sonra adı və şərtləri öz biznesinə uyğunlaşdır.
        </p>
      </header>

      <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-muted-foreground">
        💡 <strong className="text-foreground">Yaratdıqdan sonra</strong> kampaniya <strong>«Qaralama»</strong> vəziyyətində olur — son baxış edib aktivləşdirməlisən.
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((tpl) => (
          <TemplateCard key={tpl.kod} template={tpl} />
        ))}
      </div>
    </div>
  );
}
