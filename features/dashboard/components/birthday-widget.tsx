import Link from "next/link";
import { Cake, MessageCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUpcomingBirthdays } from "@/features/elaqe/birthday-queries";

const MONTHS = [
  "Yan", "Fev", "Mar", "Apr", "May", "İyn",
  "İyl", "Avq", "Sen", "Okt", "Noy", "Dek",
];

function digitsOnly(t: string): string {
  return t.replace(/\D/g, "");
}

function waLink(phone: string | null, ad: string): string | null {
  if (!phone) return null;
  const p = digitsOnly(phone);
  if (p.length < 9) return null;
  const msg = `Hörmətli ${ad}, doğum gününüz mübarək olsun! 🎂 Sizin üçün xüsusi endirim hazırladıq.`;
  return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
}

/**
 * Dashboard üçün kompakt doğum günü widget-i.
 * Yalnız bu gün və növbəti 7 gün üçün.
 */
export async function BirthdayWidget() {
  const all = await getUpcomingBirthdays(7).catch(() => []);
  if (all.length === 0) return null;

  const bugun = all.filter((r) => r.gun_qalib === 0);
  const heftelik = all.filter((r) => r.gun_qalib > 0);

  return (
    <Card className={bugun.length > 0 ? "glass border-pink-500/30 bg-pink-500/5" : "glass"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Cake className={`h-4 w-4 ${bugun.length > 0 ? "text-pink-500" : "text-muted-foreground"}`} />
          Doğum günləri
          {bugun.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-pink-500/40 text-pink-700 dark:text-pink-300 animate-pulse">
              Bu gün {bugun.length}
            </Badge>
          )}
          <Link
            href="/elaqe/dogum-gunu"
            className="ml-auto inline-flex items-center gap-0.5 text-[10.5px] text-primary hover:underline"
          >
            Hamısı <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {bugun.length > 0 && (
          <div className="space-y-1">
            {bugun.map((r) => {
              const wa = waLink(r.telefon, r.ad);
              return (
                <div key={`b-${r.tip}-${r.id}`} className="flex items-center gap-2 rounded-md bg-pink-500/10 px-2 py-1.5">
                  <span className="text-base">🎂</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold">{r.ad}</div>
                    <div className="text-[9.5px] text-muted-foreground">{r.yas} yaş · {r.tip === "isci" ? "əməkdaş" : "müştəri"}</div>
                  </div>
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-6 items-center gap-0.5 rounded bg-emerald-500 px-2 text-[10px] font-bold text-white hover:bg-emerald-600"
                    >
                      <MessageCircle className="h-2.5 w-2.5" />
                      Təbrik
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {heftelik.slice(0, 4).map((r) => {
          const d = r.dogum_tarixi;
          return (
            <div key={`h-${r.tip}-${r.id}`} className="flex items-center gap-2 px-2 py-1 text-[11px]">
              <span className="w-9 text-[9.5px] tabular-nums text-muted-foreground">{d.getDate()} {MONTHS[d.getMonth()]}</span>
              <span className="min-w-0 flex-1 truncate">{r.ad}</span>
              <span className="text-[9.5px] text-muted-foreground">{r.gun_qalib} gün</span>
            </div>
          );
        })}
        {heftelik.length === 0 && bugun.length === 0 && (
          <p className="py-2 text-center text-[10.5px] text-muted-foreground">7 gün ərzində doğum günü yoxdur</p>
        )}
      </CardContent>
    </Card>
  );
}
