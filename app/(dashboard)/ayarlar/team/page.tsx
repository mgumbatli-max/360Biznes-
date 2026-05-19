import type { Metadata } from "next";
import Link from "next/link";
import { Users2, Bell, Hash, Clock, Sparkles, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveToggle } from "@/features/ayar/components/live-toggle";
import { getTeamAyar } from "@/features/team/queries";
import { toggleTeamAyar, saveTeamRetention as _saveTeamRetention, ensureGeneralChannel as _ensureGeneralChannel } from "@/features/team/actions";
import { Input } from "@/components/ui/input";

async function saveTeamRetention(fd: FormData) {
  "use server";
  await _saveTeamRetention(fd);
}

async function ensureGeneralChannel() {
  "use server";
  await _ensureGeneralChannel();
}

export const metadata: Metadata = { title: "Team modulu — Ayarlar" };
export const dynamic = "force-dynamic";

export default async function TeamAyarPage() {
  const ayar = await getTeamAyar();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
            <Users2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Team modulu</h1>
            <p className="text-sm text-muted-foreground">
              Şirkət daxili yazışma — kanal, şəxsi mesaj, filial söhbəti
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/ayarlar/team/log"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/70"
          >
            Mesaj logu
          </Link>
          <Link
            href="/team"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Users2 className="h-3.5 w-3.5" /> Modula get
          </Link>
        </div>
      </header>


      {/* Status banner */}
      <Card className={`glass ${ayar.aktiv ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
        <CardContent className="flex items-center gap-3 py-4">
          <Sparkles className={`h-5 w-5 ${ayar.aktiv ? "text-emerald-500" : "text-amber-500"}`} />
          <div className="flex-1">
            <div className={`text-sm font-bold ${ayar.aktiv ? "text-emerald-600" : "text-amber-600"}`}>
              Team modulu {ayar.aktiv ? "AKTİVDİR" : "söndürülüb"}
            </div>
            <div className="text-xs text-muted-foreground">
              {ayar.aktiv
                ? "Sidebar-da «Team / Söhbət» linki görünür və bütün əməkdaşlar istifadə edə bilər"
                : "Söndürülübsə modul gizlənir və mesaj göndərilmir"}
            </div>
          </div>
          <LiveToggle
            initial={ayar.aktiv}
            action={toggleTeamAyar}
            fields={{ field: "aktiv" }}
            successMessage={ayar.aktiv ? "Söndürüldü" : "Aktivləşdirildi"}
          />
        </CardContent>
      </Card>

      {/* General settings */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Hash className="h-4 w-4 text-primary" /> Avtomatik kanallar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <LiveToggle
            title="«Ümumi» kanal avto-yarat"
            description="Bütün aktiv əməkdaşlar avtomatik bu kanala əlavə olunur"
            initial={ayar.general_kanal_avto}
            action={toggleTeamAyar}
            fields={{ field: "general_kanal_avto" }}
            successMessage="Yeniləndi"
          />
          <LiveToggle
            title="Hər filial üçün ayrı kanal avto-yarat"
            description="Yeni filial yaradılanda avtomatik o filialın daxili kanalı açılır"
            initial={ayar.filial_kanal_avto}
            action={toggleTeamAyar}
            fields={{ field: "filial_kanal_avto" }}
            successMessage="Yeniləndi"
          />

          <form action={ensureGeneralChannel}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
            >
              <Hash className="h-3.5 w-3.5" /> «Ümumi» kanalı indi yarat
            </button>
          </form>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" /> Bildirişlər
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <LiveToggle
            title="Brauzer push bildirişi"
            description="Yeni mesaj gəldikdə browser-dəki notification panel-ində görsənir"
            initial={ayar.bildiris_push}
            action={toggleTeamAyar}
            fields={{ field: "bildiris_push" }}
            successMessage="Yeniləndi"
          />
          <LiveToggle
            title="Email bildirişi"
            description="Saytdan çıxıqda və ya 5 dəq oxumayan olduğunda email göndər"
            initial={ayar.bildiris_email}
            action={toggleTeamAyar}
            fields={{ field: "bildiris_email" }}
            successMessage="Yeniləndi"
          />
          <LiveToggle
            title="Sayt daxili (in-app)"
            description="Topbar-dakı zəng ikonasında və xəbərdarlıq panelində görsənir"
            initial={ayar.bildiris_inapp}
            action={toggleTeamAyar}
            fields={{ field: "bildiris_inapp" }}
            successMessage="Yeniləndi"
          />
        </CardContent>
      </Card>

      {/* Retention */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" /> Saxlama müddəti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveTeamRetention} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mesaj saxlama müddəti (gün)
              </label>
              <Input
                name="retention_gun"
                type="number"
                min={7}
                max={3650}
                defaultValue={ayar.retention_gun}
                className="w-40"
              />
              <p className="text-[11px] text-muted-foreground">
                Müddət bitdikdən sonra mesajlar avto-arxiv olunur (silinmir). 7-3650 gün arası.
              </p>
            </div>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              Saxla
            </button>
          </form>
        </CardContent>
      </Card>

      {/* Module overview */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Modulun imkanları</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 text-[10px]">Kanal</Badge>
              <span>Açıq və qapalı kanal — istənilən sayda üzv, layihə/şöbə əsaslı qruplaşma</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 text-[10px]">DM</Badge>
              <span>İki şəxs arasında birbaşa mesaj — qapalı, yalnız iki tərəf görür</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 text-[10px]">Filial</Badge>
              <span>Hər filial üçün avto-yaranan kanal — filial üzvləri avto-əlavə olunur</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 text-[10px]">Oxundu</Badge>
              <span>Hər istifadəçi üçün ayrı oxunmamış sayğacı, oxundu işarəsi</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 text-[10px]">Bildiriş</Badge>
              <span>Per-kanal bildirişi söndürmək olar (mute), modul səviyyəsində kanal seçimi</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 text-[10px]">Audit</Badge>
              <span>Bütün mesajlar saxlanılır — admin axtarış edə bilər, soft delete</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
