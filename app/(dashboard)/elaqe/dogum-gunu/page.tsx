import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Cake, MessageCircle, Calendar, User, Building2, Phone, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUpcomingBirthdays } from "@/features/elaqe/birthday-queries";

export const metadata: Metadata = { title: "Doğum günü mərkəzi" };
export const dynamic = "force-dynamic";

const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun",
  "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];

const TEMPLATES: Record<"musteri" | "isci", string> = {
  musteri: "Hörmətli {{ad}}, doğum gününüz mübarək olsun! 🎂 Sağlamlıq, xoşbəxtlik və uğurlar diləyirik. Sizin üçün xüsusi endirim hazırladıq — mağazaya təşrif buyurun.",
  isci: "Əziz {{ad}}, doğum gününüz mübarək olsun! 🎉 Hər zaman komandamızın güclü tərəfi olduğun üçün təşəkkür edirik. Yeni il, yeni uğurlar diləyirik!",
};

function digitsOnly(t: string): string {
  return t.replace(/\D/g, "");
}

function whatsappLink(phone: string | null, ad: string, tip: "musteri" | "techizatci" | "her_ikisi" | "isci"): string | null {
  if (!phone) return null;
  const p = digitsOnly(phone);
  if (p.length < 9) return null;
  const t = tip === "isci" ? TEMPLATES.isci : TEMPLATES.musteri;
  const msg = t.replace(/\{\{ad\}\}/g, ad);
  return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
}

export default async function DogumGunuPage() {
  const rows = await getUpcomingBirthdays(30);
  const bugun = rows.filter((r) => r.gun_qalib === 0);
  const heftelik = rows.filter((r) => r.gun_qalib > 0 && r.gun_qalib <= 7);
  const sonra = rows.filter((r) => r.gun_qalib > 7);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/elaqe"
            className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Cake className="h-5 w-5 text-pink-500" />
              Doğum günü mərkəzi
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Növbəti 30 gün — müştəri və əməkdaş doğum günləri, WhatsApp təbrik göndərmək üçün
            </p>
          </div>
        </div>
        <div className="text-[10.5px] text-muted-foreground">
          <span>Bu gün: <strong className="text-foreground">{bugun.length}</strong></span>
          <span className="mx-2">·</span>
          <span>7 gün: <strong className="text-foreground">{heftelik.length}</strong></span>
          <span className="mx-2">·</span>
          <span>30 gün: <strong className="text-foreground">{rows.length}</strong></span>
        </div>
      </header>

      {/* İzah */}
      <Card className="glass border-sky-500/30 bg-sky-500/5">
        <CardContent className="flex items-start gap-2 py-2.5 text-[11px]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
          <div className="space-y-0.5 text-muted-foreground">
            <p>
              <strong className="text-foreground">Necə işləyir?</strong>{" "}
              Müştəri və əməkdaş profilində <strong>doğum tarixi</strong> doldurulduqda burada
              avtomatik görsənir. Sahibkar 💬 düyməsi ilə hazır təbrik mətnini WhatsApp-da açır,
              tək kliklə göndərir.
            </p>
            <p>
              <strong className="text-foreground">Mətn şablonu:</strong> avtomatik
              <code className="mx-1 rounded bg-secondary px-1 text-foreground">{"{{ad}}"}</code>
              dəyişəni ilə hər kəsə fərdi görsənir.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Bu gün */}
      {bugun.length > 0 && (
        <Card className="glass border-rose-500/30 bg-rose-500/5">
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center gap-2 text-sm font-bold text-rose-600">
              <Cake className="h-4 w-4" />
              Bu gün — {bugun.length} doğum günü
            </div>
            <BirthdayList rows={bugun} highlight />
          </CardContent>
        </Card>
      )}

      {/* Bu həftə */}
      {heftelik.length > 0 && (
        <Card className="glass">
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Calendar className="h-4 w-4 text-amber-500" />
              Bu həftə (1-7 gün)
            </div>
            <BirthdayList rows={heftelik} />
          </CardContent>
        </Card>
      )}

      {/* Sonra */}
      {sonra.length > 0 && (
        <Card className="glass">
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Növbəti 30 gün
            </div>
            <BirthdayList rows={sonra} />
          </CardContent>
        </Card>
      )}

      {rows.length === 0 && (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <Cake className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold">Növbəti 30 gündə doğum günü yoxdur</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Müştəri və əməkdaş profillərində doğum tarixi doldurularsa burada avtomatik görsənir.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BirthdayList({ rows, highlight = false }: { rows: Awaited<ReturnType<typeof getUpcomingBirthdays>>; highlight?: boolean }) {
  return (
    <div className="divide-y divide-border/30">
      {rows.map((r) => {
        const d = r.dogum_tarixi;
        const day = d.getDate();
        const month = MONTHS[d.getMonth()];
        const Icon = r.tip === "isci" ? User : Building2;
        const wa = whatsappLink(r.telefon, r.ad, r.tip);
        const profileUrl = r.tip === "isci" ? `/iscilier/${r.id}` : `/elaqe/musteriler/${r.id}`;
        return (
          <div
            key={`${r.tip}-${r.id}`}
            className={`flex flex-wrap items-center gap-3 py-2.5 ${highlight ? "bg-rose-500/5 -mx-4 px-4 rounded" : ""}`}
          >
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${r.tip === "isci" ? "bg-violet-500/15 text-violet-600" : "bg-pink-500/15 text-pink-600"}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <Link href={profileUrl} className="text-sm font-bold hover:text-primary">
                {r.ad}
              </Link>
              <div className="flex flex-wrap items-center gap-x-2 text-[10.5px] text-muted-foreground">
                <span>
                  {day} {month}
                  {r.gun_qalib === 0 && <span className="ml-1 font-bold text-rose-600">— bu gün!</span>}
                  {r.gun_qalib > 0 && <span className="ml-1">— {r.gun_qalib} gün sonra</span>}
                </span>
                <span>·</span>
                <span>{r.yas} yaş olur</span>
                {r.telefon && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-0.5 font-mono">
                      <Phone className="h-2.5 w-2.5" />
                      {r.telefon}
                    </span>
                  </>
                )}
              </div>
            </div>
            <Badge variant="outline" className={`text-[9.5px] ${r.tip === "isci" ? "border-violet-500/30 text-violet-600" : "border-pink-500/30 text-pink-600"}`}>
              {r.tip === "isci" ? "Əməkdaş" : r.tip === "techizatci" ? "Təchizatçı" : "Müştəri"}
            </Badge>
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-500 px-3 text-xs font-bold text-white hover:bg-emerald-600"
                title="WhatsApp təbrik göndər"
              >
                <MessageCircle className="h-3 w-3" />
                Təbrik göndər
              </a>
            ) : (
              <span className="text-[10px] italic text-muted-foreground">Telefon yox</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
