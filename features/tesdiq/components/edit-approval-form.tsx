"use client";

import { useState, useTransition } from "react";
import { Pencil, Save, ShieldCheck, X, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { editApprovalProposal, addApprovalNote } from "@/features/tesdiq/edit-actions";

const FIELD_LABELS: Record<string, string> = {
  ad: "Ad",
  kod: "Kod",
  barkod: "Barkod",
  alish_qiymeti: "Alış qiyməti",
  satis_qiymeti: "Satış qiyməti",
  min_satis_qiymeti: "Min satış qiyməti",
  topdan_qiymeti: "Topdan qiymət",
  vip_qiymeti: "VIP qiymət",
  partnyor_qiymeti: "Partnyor qiymət",
  endirimli_qiymet: "Endirimli qiymət",
  kritik_stok: "Kritik stok",
  min_stok: "Min stok",
  max_stok: "Max stok",
  kateqoriya_id: "Kateqoriya ID",
  marka_id: "Marka ID",
  olcu_id: "Ölçü ID",
  model: "Model",
  rang: "Rəng",
  istehsalci: "İstehsalçı",
  aktiv: "Aktiv",
  sekil_url: "Şəkil URL",
  aciqlamaq: "Açıqlama",
  qisaca_tesvir: "Qısa təsvir",
  zemanet_ay: "Zəmanət (ay)",
  komissiya_faiz: "Komissiya %",
  edv_status: "ƏDV statusu",
};

function fieldLabel(k: string): string {
  return FIELD_LABELS[k] ?? k;
}

function inferType(v: unknown): "number" | "boolean" | "text" {
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  return "text";
}

type AfterObj = Record<string, unknown>;

export function EditApprovalForm({
  telepId,
  before,
  after,
  canApprove,
  isCreator,
}: {
  telepId: number;
  before: AfterObj | null;
  after: AfterObj;
  canApprove: boolean;
  isCreator: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<AfterObj>({ ...after });
  const [qeyd, setQeyd] = useState("");
  const [noteText, setNoteText] = useState("");

  function reset() {
    setValues({ ...after });
    setQeyd("");
  }

  function changed(k: string): boolean {
    return JSON.stringify(values[k]) !== JSON.stringify(after[k]);
  }

  function setValue(k: string, raw: string, type: "number" | "boolean" | "text") {
    let parsed: unknown = raw;
    if (type === "number") {
      parsed = raw === "" ? null : Number(raw);
    } else if (type === "boolean") {
      parsed = raw === "true";
    }
    setValues((prev) => ({ ...prev, [k]: parsed }));
  }

  function submit(andApprove: boolean) {
    if (!qeyd.trim()) {
      toast.error("Qeyd məcburidir — nə dəyişdiyini izah et");
      return;
    }
    const diffKeys = Object.keys(values).filter((k) => changed(k));
    if (diffKeys.length === 0) {
      toast.error("Heç bir dəyişiklik etmədin");
      return;
    }
    startTransition(async () => {
      const res = await editApprovalProposal({
        id: telepId,
        newAfter: values,
        qeyd: qeyd.trim(),
        andApprove,
      });
      if (res.ok) {
        toast.success(
          andApprove ? "Düzəldilib və təsdiqləndi" : `Düzəliş yadda saxlandı (${diffKeys.length} sahə)`,
        );
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  function submitNote() {
    if (!noteText.trim()) {
      toast.error("Qeyd boş ola bilməz");
      return;
    }
    startTransition(async () => {
      const res = await addApprovalNote({ id: telepId, qeyd: noteText.trim() });
      if (res.ok) {
        toast.success("Qeyd əlavə edildi");
        setNoteOpen(false);
        setNoteText("");
      } else toast.error(res.error);
    });
  }

  const keys = Object.keys(after).sort();

  return (
    <div className="space-y-3">
      {/* Tək düymə zolaq */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={open ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (open) {
              reset();
              setOpen(false);
            } else {
              setOpen(true);
              setNoteOpen(false);
            }
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
          {open ? "Bağla" : "Düzəliş et"}
        </Button>
        <Button
          type="button"
          variant={noteOpen ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (noteOpen) setNoteOpen(false);
            else {
              setNoteOpen(true);
              setOpen(false);
            }
          }}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {noteOpen ? "Bağla" : "Qeyd əlavə et"}
        </Button>
        <span className="text-[10.5px] text-muted-foreground">
          Düzəlişlər və qeydlər tarixçəyə yazılır
        </span>
      </div>

      {/* Düzəliş formu */}
      {open && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <Pencil className="h-3.5 w-3.5" />
            Sahələri yerində düzəlt
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {keys.map((k) => {
              const v = after[k];
              const type = inferType(v);
              const cur = values[k];
              const isDirty = changed(k);
              return (
                <div
                  key={k}
                  className={`rounded-md border px-2 py-1.5 ${
                    isDirty ? "border-amber-500/50 bg-amber-500/5" : "border-border bg-card/30"
                  }`}
                >
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {fieldLabel(k)}
                    {isDirty && <span className="ml-1 text-amber-600">●</span>}
                  </Label>
                  {type === "boolean" ? (
                    <select
                      value={String(cur ?? false)}
                      onChange={(e) => setValue(k, e.target.value, "boolean")}
                      className="mt-0.5 h-7 w-full rounded border border-input bg-background px-2 text-xs"
                    >
                      <option value="true">Hə (true)</option>
                      <option value="false">Yox (false)</option>
                    </select>
                  ) : (
                    <input
                      type={type === "number" ? "number" : "text"}
                      value={cur == null ? "" : String(cur)}
                      onChange={(e) => setValue(k, e.target.value, type)}
                      className="mt-0.5 h-7 w-full rounded border border-input bg-background px-2 text-xs tabular-nums"
                    />
                  )}
                  {before && JSON.stringify(before[k]) !== JSON.stringify(v) && (
                    <div className="mt-0.5 text-[9.5px] text-muted-foreground">
                      <span className="line-through opacity-60">{String(before[k] ?? "—")}</span> →{" "}
                      <span className="font-semibold">{String(after[k] ?? "—")}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Qeyd <span className="text-rose-500">*</span>
            </Label>
            <textarea
              value={qeyd}
              onChange={(e) => setQeyd(e.target.value)}
              rows={2}
              placeholder="Misal: «Barkod yanlış idi, düzəltdim», «Qiymət 100 yox 150 olmalıdır»"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Bu qeyd tarixçədə qalır — yaradan əməkdaş səhvi görür və öyrənir.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-primary/20 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              disabled={pending}
            >
              <X className="h-3.5 w-3.5" />
              İmtina
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => submit(false)}
              disabled={pending}
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Düzəlişi yadda saxla
            </Button>
            {canApprove && !isCreator && (
              <Button
                type="button"
                size="sm"
                onClick={() => submit(true)}
                disabled={pending}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                Düzəlt + Təsdiqlə
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Qeyd formu — düzəliş etmədən sadəcə yazı */}
      {noteOpen && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600">
            <MessageCircle className="h-3.5 w-3.5" />
            Qeyd əlavə et
          </div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            placeholder="Misal: «Yaradan, barkod sahəsində yazı səhvi var, düzəldib göndər»"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Qeyd tarixçədə görünəcək. Sorğunun statusu dəyişmir.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setNoteText("");
                setNoteOpen(false);
              }}
              disabled={pending}
            >
              <X className="h-3.5 w-3.5" />
              İmtina
            </Button>
            <Button type="button" size="sm" onClick={submitNote} disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
              Qeyd əlavə et
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
