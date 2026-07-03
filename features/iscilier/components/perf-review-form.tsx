"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Star, Target, Plus, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { savePerformanceReview, saveOneOnOne } from "../hr-actions";
import type { PerfReview, OneOnOne } from "../hr-types";

const CRITERIA = [
  { key: "effektivlik", label: "Effektivlik" },
  { key: "komanda", label: "Komanda işi" },
  { key: "tesebbus", label: "Təşəbbüs" },
  { key: "keyfiyyet", label: "Keyfiyyət" },
  { key: "vaxtinda", label: "Vaxtında çatdırma" },
  { key: "musteri", label: "Müştəri xidməti" },
  { key: "texniki", label: "Texniki bilik" },
  { key: "liderlik", label: "Liderlik" },
];

const GOAL_STATUS: Array<{ value: "basla" | "yari" | "tamam"; label: string }> = [
  { value: "basla", label: "Başlandı" },
  { value: "yari", label: "Yarıda" },
  { value: "tamam", label: "Tamamlandı" },
];

export function PerfReviewForm({
  istifadeciId,
  history = [],
  oneOnOnes = [],
}: {
  istifadeciId: string;
  history?: PerfReview[];
  oneOnOnes?: OneOnOne[];
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(CRITERIA.map((c) => [c.key, 3])),
  );
  const [managerComment, setManagerComment] = useState("");
  const [selfAssessment, setSelfAssessment] = useState("");
  const [goals, setGoals] = useState<PerfReview["goals"]>([
    { ad: "", status: "basla" },
    { ad: "", status: "basla" },
    { ad: "", status: "basla" },
  ]);
  const [nextReview, setNextReview] = useState("");
  const [oooNote, setOooNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [pendingOoo, startOoo] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await savePerformanceReview({
        istifadeci_id: istifadeciId,
        scores,
        manager_comment: managerComment,
        self_assessment: selfAssessment,
        goals: goals.filter((g) => g.ad.trim().length > 0),
        next_review: nextReview,
      });
      if (res.ok) {
        toast.success("Review yadda saxlanıldı");
        setManagerComment("");
        setSelfAssessment("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function submitOoo() {
    if (oooNote.trim().length < 2) {
      toast.error("Qeyd daxil edin");
      return;
    }
    startOoo(async () => {
      const res = await saveOneOnOne({ istifadeci_id: istifadeciId, qeyd: oooNote });
      if (res.ok) {
        toast.success("1-on-1 qeydi yadda saxlanıldı");
        setOooNote("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const avgScore =
    Object.values(scores).reduce((s, n) => s + n, 0) / CRITERIA.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="glass lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5" /> Qiymətləndirmə (1–5)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {CRITERIA.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3">
                <span className="text-sm">{c.label}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setScores({ ...scores, [c.key]: v })}
                      className="rounded p-0.5"
                      aria-label={`${c.label} ${v}`}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          scores[c.key] >= v
                            ? "fill-warning text-warning"
                            : "text-muted-foreground/40"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-sm">
              <span className="font-semibold">Ortalama</span>
              <Badge
                variant="outline"
                className={
                  avgScore >= 4
                    ? "border-success/30 text-success"
                    : avgScore >= 3
                    ? "border-warning/30 text-warning"
                    : "border-danger/30 text-danger"
                }
              >
                {avgScore.toFixed(2)} / 5
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Şərhlər
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Manager rəyi</Label>
              <textarea
                value={managerComment}
                onChange={(e) => setManagerComment(e.target.value)}
                className="min-h-[80px] w-full rounded-md border border-border bg-card p-2 text-sm"
                placeholder="Güclü tərəflər, inkişaf üçün sahələr..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Öz qiymətləndirməsi (self-assessment)</Label>
              <textarea
                value={selfAssessment}
                onChange={(e) => setSelfAssessment(e.target.value)}
                className="min-h-[60px] w-full rounded-md border border-border bg-card p-2 text-sm"
                placeholder="İşçinin öz qiyməti..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Növbəti review tarixi</Label>
              <Input
                type="date"
                value={nextReview}
                onChange={(e) => setNextReview(e.target.value)}
                className="h-8"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" /> OKR Hədəflər
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setGoals([...goals, { ad: "", status: "basla" }])}
          >
            <Plus className="h-3.5 w-3.5" /> Hədəf
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {goals.map((g, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder={`Hədəf ${i + 1}`}
                value={g.ad}
                onChange={(e) =>
                  setGoals(goals.map((r, j) => (j === i ? { ...r, ad: e.target.value } : r)))
                }
                className="h-8 flex-1"
              />
              <select
                className="h-8 rounded-md border border-border bg-card px-2 text-sm"
                value={g.status}
                onChange={(e) =>
                  setGoals(
                    goals.map((r, j) =>
                      j === i
                        ? { ...r, status: e.target.value as "basla" | "yari" | "tamam" }
                        : r,
                    ),
                  )
                }
              >
                {GOAL_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setGoals(goals.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3.5 w-3.5 text-danger" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}{" "}
          Review yadda saxla
        </Button>
      </div>

      {/* 1-on-1 meeting */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> 1-on-1 görüş qeydi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            value={oooNote}
            onChange={(e) => setOooNote(e.target.value)}
            className="min-h-[60px] w-full rounded-md border border-border bg-card p-2 text-sm"
            placeholder="Görüş qeydi..."
          />
          <Button size="sm" onClick={submitOoo} disabled={pendingOoo}>
            {pendingOoo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Qeyd əlavə et
          </Button>
          {oneOnOnes.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {oneOnOnes.slice(0, 5).map((o, i) => (
                <div key={i} className="rounded-md border border-border/40 p-2 text-xs">
                  <div className="text-muted-foreground">
                    {formatDate(o.ts, { dateStyle: "short", timeStyle: "short" })}
                  </div>
                  <div className="mt-0.5 whitespace-pre-wrap">{o.qeyd}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Tarixçə
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {history.slice(0, 10).map((r, i) => {
              const avg =
                Object.values(r.scores ?? {}).reduce((s, n) => s + Number(n), 0) /
                Math.max(1, Object.keys(r.scores ?? {}).length);
              return (
                <div key={i} className="rounded-md border border-border/40 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {formatDate(r.ts)}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Ortalama {avg.toFixed(2)}
                    </Badge>
                  </div>
                  {r.manager_comment && (
                    <div className="mt-1 text-foreground">
                      <strong>Manager:</strong> {r.manager_comment}
                    </div>
                  )}
                  {r.self_assessment && (
                    <div className="mt-1">
                      <strong>Öz:</strong> {r.self_assessment}
                    </div>
                  )}
                  {r.goals && r.goals.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.goals.map((g, gi) => (
                        <Badge key={gi} variant="outline" className="text-[10px]">
                          {g.ad} · {g.status}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
