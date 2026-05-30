import type { Metadata } from "next";
import Link from "next/link";
import { Users2, Settings as SettingsIcon, AlertTriangle } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamClient } from "@/features/team/components/team-client";
import {
  getMyChannels,
  getChannelDetail,
  getChannelMessages,
  getAvailableUsers,
  getTeamAyar,
} from "@/features/team/queries";

export const metadata: Metadata = { title: "Team — Söhbətlər" };

type SearchParams = Promise<{ k?: string }>;

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { k } = await searchParams;
  const selectedId = k ? Number(k) : null;

  const [ayar, channels, users] = await Promise.all([getTeamAyar(), getMyChannels(), getAvailableUsers()]);

  if (!ayar.aktiv) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
            <Users2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Team</h1>
            <p className="text-sm text-muted-foreground">Şirkət daxili yazışma və söhbət modulu</p>
          </div>
        </header>

        <Card className="glass border-amber-500/30">
          <CardContent className="space-y-3 py-6 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
            <h2 className="text-lg font-semibold">Team modulu söndürülüb</h2>
            <p className="text-sm text-muted-foreground">
              Bu modulu istifadə etmək üçün ayarlardan aktivləşdirməlisiniz.
            </p>
            <Link
              href="/ayarlar/team"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              <SettingsIcon className="h-4 w-4" /> Ayarlara get
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [channel, messages] = selectedId
    ? await Promise.all([getChannelDetail(selectedId), getChannelMessages(selectedId)])
    : [null, []];

  const myMembership = channel?.uzvler.find((u) => u.istifadeci.id === session.user.id);
  const bildirisActive = myMembership?.bildiris ?? true;

  // Filter channel uzvler to a typed shape for the chat pane
  const channelForChat = channel
    ? {
        id: channel.id,
        ad: channel.ad,
        tesvir: channel.tesvir,
        novu: channel.novu,
        qapali: channel.qapali,
        filial: channel.filial,
        uzvler: channel.uzvler.map((u) => ({
          rolu: u.rolu,
          bildiris: u.bildiris,
          istifadeci: {
            id: u.istifadeci.id,
            ad_soyad: u.istifadeci.ad_soyad,
            email: u.istifadeci.email,
            aktiv: u.istifadeci.aktiv,
          },
        })),
      }
    : null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-3 px-2">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
            <Users2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Team</h1>
            <p className="text-xs text-muted-foreground">
              Şirkət daxili söhbət · kanal, şəxsi mesaj və filial yazışması
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{channels.length} söhbət</Badge>
          <Link
            href="/ayarlar/team"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/70"
          >
            <SettingsIcon className="h-3.5 w-3.5" /> Ayarlar
          </Link>
        </div>
      </header>

      <TeamClient
        channels={channels}
        selectedId={selectedId}
        channel={channelForChat}
        messages={messages}
        currentUserId={session.user.id}
        bildirisActive={bildirisActive}
        users={users}
      />
    </div>
  );
}
