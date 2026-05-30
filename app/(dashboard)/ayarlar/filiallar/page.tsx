import type { Metadata } from "next";
import { MapPin, Eye, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilialList } from "@/features/ayar/components/filial-list";
import { FilialDetailPanel } from "@/features/ayar/components/filial-detail-panel";
import { FilialGorunushMatrix } from "@/features/ayar/components/filial-gorunush-matrix";
import { FilialMessages } from "@/features/ayar/components/filial-messages";
import {
  getFiliallar,
  getFilialStats,
  getFilialDetail,
  getFilialGorunushMatrix as getMatrix,
  getFilialMessagePartners,
  getFilialConversation,
  getCavabdehOptions,
} from "@/features/ayar/queries";

export const metadata: Metadata = { title: "Filiallar" };

type SearchParams = Promise<{ selected?: string; tab?: string; dm?: string }>;

export default async function FiliallarPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [filiallar, stats, cavabdehOptions] = await Promise.all([
    getFiliallar(),
    getFilialStats(),
    getCavabdehOptions(),
  ]);

  const selectedId = params.selected
    ? Number(params.selected)
    : filiallar[0]?.id ?? null;

  const [detail, gorunushRows] = selectedId
    ? await Promise.all([getFilialDetail(selectedId), getMatrix(selectedId)])
    : [null, []];

  const showMatrix = params.tab === "izole" && detail;
  const showMessages = params.tab === "yazisma" && detail;

  const dmId = params.dm ? Number(params.dm) : null;
  const [partners, conversation] = showMessages && detail
    ? await Promise.all([
        getFilialMessagePartners(detail.id),
        dmId ? getFilialConversation(detail.id, dmId) : Promise.resolve([]),
      ])
    : [[], []];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
          <MapPin className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Filiallar və icazələr</h1>
          <p className="text-sm text-muted-foreground">
            Filial idarəetmə, müqayisə, dashboard və lokasiya bazlı icazələr
          </p>
        </div>
      </header>


      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatBox label="Ümumi filial" value={stats.umumi} />
        <StatBox label="Aktiv" value={stats.aktiv} tone="primary" />
        <StatBox label="Passiv" value={stats.passiv} tone={stats.passiv > 0 ? "warn" : "muted"} />
        <StatBox label="İzolə" value={stats.izole} tone={stats.izole > 0 ? "rose" : "muted"} />
        <StatBox label="İstifadəçi bağlamaları" value={stats.baglamaSayi} />
      </div>

      {filiallar.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-16 text-center">
            <MapPin className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <h3 className="mt-3 font-semibold">Filial yoxdur</h3>
            <p className="mt-1 text-sm text-muted-foreground">«+ Yeni» düyməsi ilə ilk filialı əlavə edin.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
            <FilialList
              filiallar={filiallar}
              selectedId={selectedId}
              cavabdehOptions={cavabdehOptions}
            />
            {detail ? (
              <FilialDetailPanel
                filial={detail}
                cavabdehOptions={cavabdehOptions}
                gorunushRows={gorunushRows}
              />
            ) : (
              <Card className="glass">
                <CardContent className="py-16 text-center text-sm text-muted-foreground">
                  Sol paneldən filial seçin
                </CardContent>
              </Card>
            )}
          </div>

          {showMatrix && detail && (
            <Card className="glass">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="h-4 w-4 text-primary" />
                  Filiallar arası görünüş matrisi —{" "}
                  <span className="text-primary">«{detail.ad}»</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Bu filial hər digər filialın hansı məlumatlarını görəcəyini seç. İstiqamətlidir — başqa filial üçün ayrıca tənzimləyin.
                </p>
              </CardHeader>
              <CardContent>
                <FilialGorunushMatrix
                  sourceFilial={{ id: detail.id, ad: detail.ad, kod: detail.kod }}
                  rows={gorunushRows}
                />
              </CardContent>
            </Card>
          )}

          {showMessages && detail && (
            <Card className="glass">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Filiallar arası yazışma — <span className="text-primary">«{detail.ad}»</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Filiala sorğu göndər, sənəd istə, danış. Cmd/Ctrl + Enter ilə tez göndər.
                </p>
              </CardHeader>
              <CardContent>
                <FilialMessages
                  sourceFilial={{ id: detail.id, ad: detail.ad, kod: detail.kod }}
                  partners={partners}
                  selectedPartnerId={dmId}
                  conversation={conversation}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "primary" | "warn" | "rose" | "muted";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warn"
      ? "text-amber-500"
      : tone === "rose"
      ? "text-rose-500"
      : tone === "muted"
      ? "text-muted-foreground"
      : "text-foreground";
  return (
    <div className="glass rounded-xl border border-border/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
