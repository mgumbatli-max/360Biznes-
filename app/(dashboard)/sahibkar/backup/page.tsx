import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Download, Database, Info, ShieldAlert, FileJson } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSahibkarState } from "@/lib/sahibkar/guard";
import { getBackupTables } from "@/features/sahibkar/backup/queries";

export const metadata: Metadata = { title: "Backup və eksport" };

const GROUP_LABELS: Record<string, { label: string; emoji: string }> = {
  satis: { label: "Satış", emoji: "🧾" },
  alis: { label: "Alış", emoji: "🛒" },
  anbar: { label: "Anbar", emoji: "📦" },
  elaqe: { label: "Əlaqələr", emoji: "👥" },
  maliyye: { label: "Maliyyə", emoji: "💰" },
  isci: { label: "İşçi/HR", emoji: "👤" },
  diger: { label: "Digər", emoji: "📋" },
};

export default async function SahibkarBackupPage() {
  const state = await getSahibkarState();
  if (state === "needs-setup") redirect("/sahibkar/setup");
  if (state === "needs-verify") redirect("/sahibkar/verify");
  if (state !== "ready") redirect("/dashboard");

  const tables = await getBackupTables();
  const totalRows = tables.reduce((s, t) => s + t.sayi, 0);

  // Qrup üzrə yığ
  const byGroup = new Map<string, typeof tables>();
  for (const t of tables) {
    const arr = byGroup.get(t.qrup) ?? [];
    arr.push(t);
    byGroup.set(t.qrup, arr);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex items-start gap-3">
        <BackButton fallback="/sahibkar" className="mt-1" />
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Database className="h-5 w-5 text-emerald-600" />
            Backup və eksport
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Bütün biznes datanı tək JSON faylına yüklə. Heç bir məlumat itmir — DB toxunulmaz qalır.
          </p>
        </div>
      </header>

      {/* Xülasə + əsas eksport düyməsi */}
      <Card className="glass border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-4">
            <FileJson className="h-10 w-10 text-emerald-600" />
            <div>
              <div className="text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {totalRows.toLocaleString("az-AZ")}
              </div>
              <div className="text-xs text-muted-foreground">cəmi sətr · {tables.length} cədvəl</div>
            </div>
          </div>
          <a
            href="/api/sahibkar/backup"
            download
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" />
            Tam backup yüklə (JSON)
          </a>
        </CardContent>
      </Card>

      {/* Necə işləyir */}
      <Card className="glass border-sky-500/30 bg-sky-500/5">
        <CardContent className="space-y-2 py-4 text-[12px]">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Info className="h-4 w-4 text-sky-600" />
            Backup haqda
          </div>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Tam: </strong> bütün satış, alış, anbar, müştəri,
              maliyyə və HR cədvəlləri (16 cədvəl)
            </li>
            <li>
              <strong className="text-foreground">Format: </strong> JSON, hər cədvəl ayrıca açar
            </li>
            <li>
              <strong className="text-foreground">Gizli mod təsir etmir: </strong> backup həmişə real
              data ilə yaranır
            </li>
            <li>
              <strong className="text-foreground">Şifrə hash-ları daxil deyil: </strong> istifadəçi
              parolları təhlükəsizlik üçün eksport edilmir
            </li>
            <li>
              <strong className="text-foreground">Audit log son 5000 sətr: </strong> tam tarixçə yox,
              son əməliyyatlar
            </li>
            <li>
              <strong className="text-foreground">Avto-tarix: </strong> fayl adında yaradılma tarixi
              olur — köhnə-yenisini ayırd edə bilərsən
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Cədvəl siyahısı qrup üzrə */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(["satis", "alis", "anbar", "elaqe", "maliyye", "isci", "diger"] as const).map((g) => {
          const groupTables = byGroup.get(g) ?? [];
          if (groupTables.length === 0) return null;
          const meta = GROUP_LABELS[g];
          const groupTotal = groupTables.reduce((s, t) => s + t.sayi, 0);
          return (
            <Card key={g} className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <span className="text-base">{meta.emoji}</span>
                  {meta.label}
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {groupTotal.toLocaleString("az-AZ")} sətr
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {groupTables.map((t) => (
                  <div key={t.ad} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span>{t.emoji}</span>
                      <span>{t.azAd}</span>
                    </span>
                    <span className="font-bold tabular-nums text-muted-foreground">
                      {t.sayi.toLocaleString("az-AZ")}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Təhlükəsizlik xəbərdarlığı */}
      <Card className="glass border-amber-500/30 bg-amber-500/5">
        <CardContent className="space-y-1.5 py-3 text-[11px]">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            ⚠ Təhlükəsizlik məsləhəti
          </div>
          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
            <li>
              Backup faylı bütün biznes datanızı ehtiva edir. <strong className="text-foreground">Şifrəli yerdə saxla</strong>{" "}
              (məs. parolla qorunan ZIP, şifrəli bulud).
            </li>
            <li>
              Email vasitəsilə göndərirsənsə <strong className="text-foreground">7-Zip / iZip ilə şifrə qoy</strong>.
            </li>
            <li>
              Heç vaxt rəqibə, naməlum kompüterə yükləməyin. Köhnə backup-ları periodik silin.
            </li>
            <li>
              <strong className="text-foreground">Periodiklik:</strong> ayda 1 dəfə tam backup tövsiyə olunur.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
