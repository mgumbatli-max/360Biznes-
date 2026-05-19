"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Check, X, Ban, Loader2, Paperclip, Clock, User, Upload, FileText, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/utils";
import type { OperationRow } from "../operations-queries";
import { approveOperation, rejectOperation, cancelOperation, deleteFinanceAttachment } from "../actions";
import { LinkedTasksPanel, type LinkedTask } from "@/features/ticaret/components/linked-tasks-panel";
import { getLinkedTasksForFinanceOp } from "@/features/ticaret/alis-actions";

type Attachment = {
  id: number;
  ad: string | null;
  fayl_url: string;
  fayl_nov: string | null;
  fayl_olcu: number | null;
  yaradildi: string | null;
};

const STATUS_LABEL: Record<string, { ad: string; cls: string }> = {
  aktiv: { ad: "Aktiv", cls: "border-success/30 bg-success/10 text-success" },
  gozleyen_tesdiq: { ad: "Təsdiq gözləyir", cls: "border-warning/30 bg-warning/10 text-warning" },
  legv: { ad: "Ləğv", cls: "border-muted text-muted-foreground" },
  redd: { ad: "Rədd", cls: "border-danger/30 bg-danger/10 text-danger" },
};

export function OperationDetailDrawer({ op }: { op: OperationRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/maliyye/operation/${op.id}/sened`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data.items)) setAttachments(data.items);
      })
      .catch(() => {
        if (!cancelled) setAttachments([]);
      });
    // Load linked tasks for this finance operation
    getLinkedTasksForFinanceOp(op.id)
      .then((items) => {
        if (!cancelled && Array.isArray(items)) setLinkedTasks(items as LinkedTask[]);
      })
      .catch(() => {
        if (!cancelled) setLinkedTasks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, op.id]);

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    if (list.length === 0) return;
    setUploading(true);
    for (const f of list) {
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name}: 5 MB-dan böyükdür`);
        continue;
      }
      const fd = new FormData();
      fd.set("file", f);
      fd.set("ad", f.name);
      try {
        const r = await fetch(`/api/maliyye/operation/${op.id}/sened/upload`, {
          method: "POST",
          body: fd,
        });
        const j = await r.json();
        if (!r.ok) {
          toast.error(j.error ?? "Yüklənmədi");
        } else {
          setAttachments((prev) => [
            {
              id: j.id,
              ad: j.ad,
              fayl_url: j.url,
              fayl_nov: j.nov,
              fayl_olcu: j.olcu,
              yaradildi: new Date().toISOString(),
            },
            ...prev,
          ]);
          toast.success("Sənəd əlavə olundu");
        }
      } catch {
        toast.error("Yükləmə xətası");
      }
    }
    setUploading(false);
    e.target.value = "";
  }

  function onDeleteAttachment(id: number) {
    startTransition(async () => {
      const res = await deleteFinanceAttachment(id);
      if (res.ok) {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
        toast.success("Sənəd silindi");
      } else {
        toast.error(res.error);
      }
    });
  }

  const status = STATUS_LABEL[op.status] ?? { ad: op.status, cls: "border-muted text-muted-foreground" };
  const yonCls = op.yon === "daxil" ? "text-success" : op.yon === "xaric" ? "text-danger" : "text-primary-light";
  const yonSign = op.yon === "daxil" ? "+" : op.yon === "xaric" ? "−" : "";

  const canApprove = op.status === "gozleyen_tesdiq";
  const canCancel = op.status === "aktiv" || op.status === "gozleyen_tesdiq";

  function runAction(fn: () => Promise<{ ok: boolean; error?: string }>, label: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(label);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Xəta baş verdi");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[10.5px] font-semibold hover:bg-secondary"
          data-op-detail-trigger="1"
          title="Detallara bax"
        >
          <Eye className="h-3 w-3" /> Bax
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {op.type_emoji && <span>{op.type_emoji}</span>}
            <span>{op.type_ad}</span>
            <Badge variant="outline" className={`text-[10px] ${status.cls}`}>{status.ad}</Badge>
          </SheetTitle>
          <SheetDescription>
            {op.sened_nomresi ? `Sənəd № ${op.sened_nomresi} • ` : ""}
            {formatDate(op.tarix, { day: "2-digit", month: "long", year: "numeric" })}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Məbləğ</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${yonCls}`}>
              {yonSign}{formatMoney(op.mebleg)} <span className="text-sm text-muted-foreground">{op.valyuta}</span>
            </div>
            {op.valyuta !== "AZN" && (
              <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                ≈ {formatMoney(op.azn_mebleg)} AZN (məzənnə {op.mezenne})
              </div>
            )}
            {op.komissiya > 0 && (
              <div className="mt-1 text-xs text-warning">Komissiya: {formatMoney(op.komissiya)}</div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <Field label="Növ" value={op.type_ad} />
            <Field label="Qrup" value={op.type_qrup} />
            <Field label="Yön" value={<span className={`font-semibold ${yonCls}`}>{op.yon}</span>} />
            <Field label="Hesab" value={op.hesab_ad ?? "—"} />
            {op.hesab2_ad && <Field label="Hədəf hesab" value={op.hesab2_ad} />}
            <Field label="Kontragent" value={op.kontragent_ad ?? op.qarsi_teref ?? "—"} />
            {op.isci_ad && <Field label="İşçi" value={op.isci_ad} />}
            {op.sened_nomresi && <Field label="Sənəd №" value={<span className="font-mono">{op.sened_nomresi}</span>} />}
            {op.icra_tarixi && <Field label="İcra tarixi" value={formatDate(op.icra_tarixi)} />}
          </dl>

          {op.qeyd && (
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Qeyd</div>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{op.qeyd}</p>
            </div>
          )}

          {/* Audit timeline */}
          <div className="rounded-lg border border-border/50 bg-card/30 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3 w-3" /> Audit jurnalı
            </div>
            <ul className="space-y-2 text-xs">
              {op.yaradildi && (
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-info" />
                  <div>
                    <div className="font-medium">Yaradıldı</div>
                    <div className="text-muted-foreground">
                      {op.yaradan_ad ? <><User className="inline h-3 w-3 mr-0.5" />{op.yaradan_ad} • </> : ""}
                      {formatDate(op.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </li>
              )}
              {op.status === "aktiv" && (
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  <div>
                    <div className="font-medium">Təsdiqlənib</div>
                    <div className="text-muted-foreground">Status aktiv olaraq qeyd edilib</div>
                  </div>
                </li>
              )}
              {(op.status === "legv" || op.status === "redd") && (
                <li className="flex items-start gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${op.status === "redd" ? "bg-danger" : "bg-muted-foreground"}`} />
                  <div>
                    <div className="font-medium">{op.status === "redd" ? "Rədd edilib" : "Ləğv edilib"}</div>
                  </div>
                </li>
              )}
            </ul>
          </div>

          {/* Bağlı tapşırıqlar */}
          <LinkedTasksPanel
            contextType="finance_operations"
            contextId={op.id}
            tasks={linkedTasks}
            compact
          />

          {/* Sənədlər bölməsi */}
          <div className="space-y-2 rounded-lg border border-border/50 bg-card/30 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Paperclip className="h-3 w-3" /> Sənədlər ({attachments.length})
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10.5px] font-semibold hover:bg-secondary">
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                Əlavə et
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={onPickFiles}
                  disabled={uploading}
                />
              </label>
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Hələ sənəd əlavə olunmayıb</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {attachments.map((a) => {
                  const isImg = (a.fayl_nov ?? "").startsWith("image/");
                  return (
                    <div key={a.id} className="group relative overflow-hidden rounded border border-border bg-background">
                      <a href={a.fayl_url} target="_blank" rel="noopener" className="block">
                        {isImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.fayl_url}
                            alt={a.ad ?? "Sənəd"}
                            className="h-20 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-20 items-center justify-center bg-secondary/30">
                            <FileText className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </a>
                      <div className="flex items-center justify-between px-1 py-0.5">
                        <span className="truncate text-[9px] text-muted-foreground" title={a.ad ?? ""}>
                          {a.ad ?? "—"}
                        </span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-danger"
                          onClick={() => onDeleteAttachment(a.id)}
                          disabled={pending}
                          title="Sil"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="border-t border-border/40 pt-3">
          {showRejectInput ? (
            <div className="space-y-2">
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Rədd səbəbi (istəyə bağlı)"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                disabled={pending}
              />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setShowRejectInput(false); setRejectReason(""); }} disabled={pending}>
                  Geri
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={pending}
                  onClick={() => runAction(() => rejectOperation(op.id, rejectReason), "Əməliyyat rədd edildi")}
                >
                  {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  <X className="h-3.5 w-3.5" /> Rəddi təsdiqlə
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {canApprove && (
                <Button
                  size="sm"
                  className="bg-success text-white hover:bg-success/90"
                  disabled={pending}
                  onClick={() => runAction(() => approveOperation(op.id), "Təsdiqləndi")}
                >
                  {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Təsdiqlə
                </Button>
              )}
              {canApprove && (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => setShowRejectInput(true)}>
                  <X className="h-3.5 w-3.5" /> Rədd et
                </Button>
              )}
              {canCancel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-danger/30 text-danger hover:bg-danger/10"
                  disabled={pending}
                  onClick={() => runAction(() => cancelOperation(op.id, "İstifadəçi ləğv etdi"), "Əməliyyat ləğv edildi")}
                >
                  {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                  Ləğv et
                </Button>
              )}
              {!canApprove && !canCancel && (
                <p className="text-xs text-muted-foreground">Bu status üçün əlavə əməliyyat mövcud deyil.</p>
              )}
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
