"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Send as SendIcon,
  Clock,
  CheckCircle2,
  XCircle,
  FileEdit,
  Loader2,
  Calendar,
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { deletePost, publishPost, schedulePost } from "../social-actions";
import type { SocialPost, SocialAccount, PostStatus } from "../social-types";

const STATUS_INFO: Record<PostStatus, { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  qaralama:         { label: "Qaralama",          cls: "border-border text-muted-foreground bg-secondary/40",        Icon: FileEdit },
  planlasdirilmis:  { label: "Planlaşdırılıb",     cls: "border-sky-500/30 text-sky-600 bg-sky-500/10",                Icon: Clock },
  gonderildi:       { label: "Göndərildi",         cls: "border-emerald-500/30 text-emerald-600 bg-emerald-500/10",    Icon: CheckCircle2 },
  xeta:             { label: "Xəta",               cls: "border-rose-500/30 text-rose-600 bg-rose-500/10",             Icon: XCircle },
};

export function PostsList({
  posts,
  accounts,
}: {
  posts: SocialPost[];
  accounts: SocialAccount[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState("");

  function onDelete(id: string) {
    if (!confirm("Bu post silinsin?")) return;
    setPendingId(id);
    startTransition(async () => {
      const r = await deletePost(id);
      setPendingId(null);
      if (r.ok) {
        toast.success("Silindi");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function onPublishNow(id: string) {
    if (!confirm("İndi dərc edilsin?")) return;
    setPendingId(id);
    startTransition(async () => {
      const r = await publishPost(id);
      setPendingId(null);
      if (r.ok) {
        toast.success("Dərc edildi");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function onSchedule(id: string) {
    if (!scheduleTime) return toast.error("Tarix lazımdır");
    setPendingId(id);
    startTransition(async () => {
      const r = await schedulePost(id, new Date(scheduleTime).toISOString());
      setPendingId(null);
      if (r.ok) {
        toast.success("Planlaşdırıldı");
        setScheduleId(null);
        setScheduleTime("");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function accountLabels(ids: string[]): string {
    return ids
      .map((id) => accounts.find((a) => a.id === id)?.ad ?? "?")
      .join(", ");
  }

  if (posts.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Hələ post yoxdur. Yuxarıdakı composer ilə ilkini yarat.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardContent className="p-0">
        <header className="border-b border-border/60 px-4 py-2">
          <h3 className="text-sm font-bold">Postlar ({posts.length})</h3>
        </header>
        <ul className="divide-y divide-border/30">
          {posts.map((p) => {
            const status = STATUS_INFO[p.status];
            const isPending = pendingId === p.id;
            const isScheduling = scheduleId === p.id;
            return (
              <li key={p.id} className="p-3 hover:bg-secondary/20">
                <div className="flex flex-wrap items-start gap-3">
                  {/* Şəkil önbax */}
                  {p.sekil_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.sekil_url} alt="" className="h-14 w-14 shrink-0 rounded-md border border-border/40 object-cover" />
                  ) : (
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-secondary/40 text-muted-foreground/40">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="line-clamp-1 text-sm font-bold">{p.basliq}</h4>
                      <Badge variant="outline" className={`gap-1 text-[10px] ${status.cls}`}>
                        <status.Icon className="h-2.5 w-2.5" />
                        {status.label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground" title={p.metn}>
                      {p.metn}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-muted-foreground">
                      <span>📱 {accountLabels(p.hesab_ids)}</span>
                      <span>· Yaradıldı: {formatDate(new Date(p.yaradildi), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      {p.planlasdirilan && (
                        <span className="font-semibold text-sky-600">
                          · 📅 {formatDate(new Date(p.planlasdirilan), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      {p.gonderildi && (
                        <span className="font-semibold text-emerald-600">
                          · ✓ {formatDate(new Date(p.gonderildi), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    {p.xeta && (
                      <div className="mt-1 rounded bg-rose-500/10 px-2 py-0.5 text-[10.5px] text-rose-600">
                        ⚠ {p.xeta}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-start gap-1">
                    {(p.status === "qaralama" || p.status === "xeta") && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onPublishNow(p.id)}
                        disabled={isPending}
                        title="İndi dərc et"
                        className="h-7 text-[10.5px]"
                      >
                        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <SendIcon className="h-3 w-3" />}
                      </Button>
                    )}
                    {p.status === "qaralama" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setScheduleId(p.id);
                          setScheduleTime(p.planlasdirilan ?? "");
                        }}
                        disabled={isPending}
                        title="Planlaşdır"
                        className="h-7 text-[10.5px]"
                      >
                        <Calendar className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onDelete(p.id)}
                      disabled={isPending}
                      title="Sil"
                      className="h-7 text-[10.5px] text-rose-500 hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Schedule inline form */}
                {isScheduling && (
                  <div className="mt-2 flex items-center gap-2 rounded-md bg-sky-500/5 p-2">
                    <input
                      type="datetime-local"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onSchedule(p.id)}
                      disabled={isPending || !scheduleTime}
                      className="h-8 text-[10.5px]"
                    >
                      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Saxla"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => { setScheduleId(null); setScheduleTime(""); }}
                      className="h-8 text-[10.5px]"
                    >
                      İmtina
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
