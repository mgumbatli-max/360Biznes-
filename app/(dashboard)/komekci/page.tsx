import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle, BookOpen, MessageCircle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TopicsBrowser } from "@/features/komekci/components/topics-browser";

export const metadata: Metadata = { title: "Köməkçi mərkəzi" };
export const dynamic = "force-dynamic";

export default function KomekciPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <HelpCircle className="h-6 w-6 text-violet-500" />
          Köməkçi mərkəzi
        </h1>
        <p className="text-sm text-muted-foreground">
          360biznes ERP-nin hər funksiyası burada izah olunur — axtar, kateqoriya seç, aç və oxu
        </p>
      </header>

      {/* AI tövsiyə kartı */}
      <Card className="glass border-violet-500/30 bg-violet-500/5">
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <Sparkles className="h-5 w-5 shrink-0 text-violet-500" />
          <div className="flex-1 min-w-[200px] text-[11px]">
            <p className="font-bold text-foreground">Axtardığını tapa bilmədin?</p>
            <p className="text-muted-foreground">
              AI Mərkəzində sistem haqda hər hansı sual ver. Sistem-əsaslı cavab alacaqsan.
            </p>
          </div>
          <Link
            href="/ai"
            className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
          >
            <MessageCircle className="h-3 w-3" />
            AI ilə danış
          </Link>
        </CardContent>
      </Card>

      <Card className="glass border-sky-500/30 bg-sky-500/5">
        <CardContent className="flex items-start gap-2 py-3 text-[11px]">
          <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
          <div className="space-y-0.5 text-muted-foreground">
            <p>
              <strong className="text-foreground">Hər mövzuda 3 hissə var:</strong>
            </p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li><strong className="text-foreground">📖 Nədir?</strong> — funksiyanın izahı</li>
              <li><strong className="text-foreground">🎯 Necə istifadə</strong> — addım-addım təlimat</li>
              <li><strong className="text-foreground">⚠ Vacib qeydlər</strong> — diqqət edilməli olanlar</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <TopicsBrowser />
    </div>
  );
}
