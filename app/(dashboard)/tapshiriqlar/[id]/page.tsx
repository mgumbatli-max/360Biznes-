import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, User, Users, MessageSquare, CheckSquare, Eye } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PriorityBadge, TaskStatusBadge } from "@/features/tapshiriqlar/components/task-badges";
import { CommentForm } from "@/features/tapshiriqlar/components/comment-form";
import { ChecklistItem } from "@/features/tapshiriqlar/components/checklist-item";
import { getTaskDetail } from "@/features/tapshiriqlar/detail-queries";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Tapşırıq detayı" };

const ROL_LABEL: Record<string, string> = {
  mesul: "Məsul",
  icraci: "İcraçı",
  musahide: "Müşahidəçi",
};

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTaskDetail(id);
  if (!t) notFound();

  const overdue = t.deadline && t.deadline < new Date() && t.status !== "tamamlandi" && t.status !== "legv";
  const checklistDone = t.tapshiriq_checklist.filter((c) => c.tamamlandi).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-start gap-3">
        <BackButton fallback="/tapshiriqlar" className="mt-1" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{t.basliq}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <TaskStatusBadge value={t.status ?? "yeni"} />
            <PriorityBadge value={t.prioritet ?? "normal"} />
            {overdue && (
              <span className="inline-flex items-center rounded-full bg-danger/15 px-2 py-0.5 text-[10.5px] font-medium text-danger">
                Gecikib
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {t.tesvir && (
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Təsvir</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{t.tesvir}</p>
              </CardContent>
            </Card>
          )}

          {t.tapshiriq_checklist.length > 0 && (
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckSquare className="h-4 w-4" />
                  Checklist <span className="text-xs font-normal text-muted-foreground">({checklistDone}/{t.tapshiriq_checklist.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {t.tapshiriq_checklist.map((c) => (
                  <ChecklistItem
                    key={c.id.toString()}
                    id={c.id.toString()}
                    metn={c.metn}
                    tamamlandi={c.tamamlandi ?? false}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                Şərhlər <span className="text-xs font-normal text-muted-foreground">({t.tapshiriq_kommentleri.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CommentForm taskId={t.id} />
              {t.tapshiriq_kommentleri.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Hələ şərh yoxdur</p>
              ) : (
                <div className="space-y-3 border-t border-border/40 pt-3">
                  {t.tapshiriq_kommentleri.map((c) => (
                    <div key={c.id.toString()} className="flex gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-secondary text-[10px]">
                          {c.istifadeciler.ad_soyad.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 rounded-md border border-border/40 bg-secondary/40 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{c.istifadeciler.ad_soyad}</span>
                          {c.yaradildi && (
                            <span>{formatDate(c.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          )}
                        </div>
                        <div className="mt-1 whitespace-pre-wrap">{c.metn}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Komanda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Yaradan</div>
                  <div className="font-medium">{t.istifadeciler_tapshiriqlar_yaradan_idToistifadeciler?.ad_soyad ?? "—"}</div>
                </div>
              </div>
              {t.istifadeciler_tapshiriqlar_mesul_idToistifadeciler && (
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-primary-light" />
                  <div>
                    <div className="text-xs text-muted-foreground">Məsul</div>
                    <div className="font-medium">{t.istifadeciler_tapshiriqlar_mesul_idToistifadeciler.ad_soyad}</div>
                  </div>
                </div>
              )}
              {t.tapshiriq_iscilier.length > 0 && (
                <div className="space-y-1 border-t border-border/40 pt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" /> İştirakçılar
                  </div>
                  {t.tapshiriq_iscilier.map((i) => (
                    <div key={i.istifadeci_id} className="flex items-center justify-between text-xs">
                      <span>{i.istifadeciler.ad_soyad}</span>
                      <span className="text-muted-foreground">{ROL_LABEL[i.rol ?? "icraci"] ?? i.rol}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Tarixlər</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {t.deadline && (
                <Row
                  icon={CalendarClock}
                  label="Deadline"
                  value={formatDate(t.deadline, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  tone={overdue ? "danger" : undefined}
                />
              )}
              {t.baslandi_de && (
                <Row icon={CalendarClock} label="Başlandı" value={formatDate(t.baslandi_de, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} />
              )}
              {t.tamamlandi_de && (
                <Row icon={CalendarClock} label="Tamamlandı" value={formatDate(t.tamamlandi_de, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} />
              )}
              {t.yaradildi && (
                <Row icon={CalendarClock} label="Yaradılıb" value={formatDate(t.yaradildi)} />
              )}
              {t.gorunurluk && (
                <Row icon={Eye} label="Görünürlük" value={t.gorunurluk === "sexsi" ? "Şəxsi" : t.gorunurluk === "umumi" ? "Hamı" : "Seçilmiş"} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon, label, value, tone,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: "danger" }) {
  return (
    <div className={`flex items-center gap-2 ${tone === "danger" ? "text-danger" : ""}`}>
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}
