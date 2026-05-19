"use client";

import { useState, useTransition } from "react";
import { Bell, Loader2, Send, MessageCircle, ClipboardList, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { sendContactSms } from "../actions";
import { createDebtReminderTask } from "../debt-reminder-actions";
import { formatMoney } from "@/lib/utils";

const TEMPLATES = [
  {
    id: "soft",
    title: "Yumşaq",
    text: "Salam {{ad}}, sizdə {{borc}} qalıq borc var. Münasib vaxtda ödəməyi unutmayın, təşəkkürlər.",
  },
  {
    id: "standart",
    title: "Standart",
    text: "Hörmətli {{ad}}, hesabınızda {{borc}} borc qalmışdır. Zəhmət olmasa ödəniş tarixini bildirin.",
  },
  {
    id: "kesin",
    title: "Sərt",
    text: "Hörmətli {{ad}}, {{borc}} borcunuz {{gun}} gündən artıqdır. Xahiş edirik, ən qısa zamanda əlaqə saxlayın.",
  },
];

const WEEKDAYS = [
  { v: 1, label: "B.E" },
  { v: 2, label: "Ç.A" },
  { v: 3, label: "Ç" },
  { v: 4, label: "C.A" },
  { v: 5, label: "C" },
  { v: 6, label: "Ş" },
  { v: 0, label: "B" },
];

type StaffOption = { id: string; ad_soyad: string };

function applyVars(template: string, ad: string, borc: number, yasGun: number | null): string {
  return template
    .replace(/\{\{ad\}\}/g, ad)
    .replace(/\{\{borc\}\}/g, formatMoney(borc))
    .replace(/\{\{gun\}\}/g, String(yasGun ?? 0));
}

function digitsOnly(t: string): string {
  return t.replace(/\D/g, "");
}

export function BorcReminderDialog({
  kontragentId,
  ad,
  telefon,
  borc,
  yasGun,
  staffOptions = [],
}: {
  kontragentId: string;
  ad: string;
  telefon: string | null;
  borc: number;
  yasGun: number | null;
  staffOptions?: StaffOption[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"sms" | "whatsapp" | "task">("whatsapp");
  const [chosen, setChosen] = useState(TEMPLATES[0].id);
  const [text, setText] = useState(applyVars(TEMPLATES[0].text, ad, borc, yasGun));
  const [pending, startTransition] = useTransition();

  // Task mode state
  const [taskRecurrent, setTaskRecurrent] = useState(true);
  const [taskWeekday, setTaskWeekday] = useState(1); // Bazar ertəsi default
  const [taskHour, setTaskHour] = useState("10:00");
  const [taskMesul, setTaskMesul] = useState<string>("");

  function applyTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setChosen(id);
    setText(applyVars(t.text, ad, borc, yasGun));
  }

  function sendWhatsApp() {
    if (!telefon) {
      toast.error("Telefon yoxdur");
      return;
    }
    const phone = digitsOnly(telefon);
    if (phone.length < 9) {
      toast.error("Telefon nömrəsi yanlışdır");
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
    toast.success("WhatsApp açıldı — mesajı təsdiqləyin və göndərin");
  }

  function sendSms() {
    if (!telefon) {
      toast.error("Telefon yoxdur");
      return;
    }
    if (!text.trim()) {
      toast.error("Mətn boşdur");
      return;
    }
    startTransition(async () => {
      const res = await sendContactSms(kontragentId, text);
      if (res.ok) {
        toast.success("SMS qeyd edildi");
        setOpen(false);
      } else toast.error(res.error);
    });
  }

  function createTask() {
    startTransition(async () => {
      const res = await createDebtReminderTask({
        kontragentId,
        kontragentAd: ad,
        borc,
        recurrent: taskRecurrent,
        weekday: taskWeekday,
        hour: taskHour,
        mesulId: taskMesul || null,
        mesajMetn: text,
      });
      if (res.ok) {
        toast.success(
          taskRecurrent
            ? `Həftəlik xatırlatma yaradıldı — ${WEEKDAYS.find((w) => w.v === taskWeekday)?.label} ${taskHour}`
            : "Birdəfəlik xatırlatma yaradıldı",
        );
        setOpen(false);
      } else toast.error(res.error);
    });
  }

  function onPrimaryClick() {
    if (mode === "whatsapp") sendWhatsApp();
    else if (mode === "sms") sendSms();
    else createTask();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          title="Xatırlatma — WhatsApp, SMS və ya tapşırıq"
          className="text-warning hover:text-warning"
        >
          <Bell className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Borc xatırlatması — {ad}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Borc xülasəsi */}
          <div className="grid grid-cols-3 gap-2 rounded-md border border-border/60 bg-card/40 p-2 text-[11px]">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Borc</div>
              <div className="font-bold tabular-nums text-warning">{formatMoney(borc)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Yaş</div>
              <div className="tabular-nums">{yasGun ?? "—"} gün</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Telefon</div>
              <div className="truncate font-mono">{telefon ?? "—"}</div>
            </div>
          </div>

          {/* Mode picker — 3 yol */}
          <div className="grid grid-cols-3 gap-1.5">
            <ModeBtn
              active={mode === "whatsapp"}
              onClick={() => setMode("whatsapp")}
              icon={MessageCircle}
              label="WhatsApp"
              hint="Birbaşa göndər"
              tone="emerald"
            />
            <ModeBtn
              active={mode === "sms"}
              onClick={() => setMode("sms")}
              icon={Send}
              label="SMS"
              hint="Sistem ilə"
            />
            <ModeBtn
              active={mode === "task"}
              onClick={() => setMode("task")}
              icon={ClipboardList}
              label="Tapşırıq"
              hint="Avto xatırlatma"
              tone="primary"
            />
          </div>

          {/* Mesaj şablon — bütün rejimlərdə */}
          {(mode === "whatsapp" || mode === "sms") && (
            <>
              <div>
                <Label className="text-xs">Şablon</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTemplate(t.id)}
                      className={`rounded-full border px-2.5 py-1 text-[10.5px] transition ${
                        chosen === t.id
                          ? "border-primary/40 bg-primary/10"
                          : "border-border/40 hover:bg-secondary/30"
                      }`}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="borc-msg-text" className="text-xs">Mətn</Label>
                <textarea
                  id="borc-msg-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <div className="mt-1 text-[10.5px] text-muted-foreground">
                  {text.length} simvol
                  {mode === "whatsapp" && telefon && (
                    <> · WhatsApp <code>wa.me/{digitsOnly(telefon).slice(0, 12)}</code></>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Tapşırıq rejimi */}
          {mode === "task" && (
            <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-[11px]">
                <input
                  id="recurrent"
                  type="checkbox"
                  checked={taskRecurrent}
                  onChange={(e) => setTaskRecurrent(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                <Label htmlFor="recurrent" className="cursor-pointer text-xs">
                  Həftəlik təkrarla (avto)
                </Label>
              </div>

              {taskRecurrent && (
                <div>
                  <Label className="text-xs">Həftənin günü</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {WEEKDAYS.map((w) => (
                      <button
                        key={w.v}
                        type="button"
                        onClick={() => setTaskWeekday(w.v)}
                        className={`min-w-[36px] rounded-md border px-2 py-1 text-[10.5px] font-medium transition ${
                          taskWeekday === w.v
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-secondary/30"
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="task-hour" className="text-xs">
                    <Calendar className="mr-1 inline h-2.5 w-2.5" />
                    Saat
                  </Label>
                  <input
                    id="task-hour"
                    type="time"
                    value={taskHour}
                    onChange={(e) => setTaskHour(e.target.value)}
                    className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="task-mesul" className="text-xs">Məsul</Label>
                  <select
                    id="task-mesul"
                    value={taskMesul}
                    onChange={(e) => setTaskMesul(e.target.value)}
                    className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">— Mən —</option>
                    {staffOptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.ad_soyad}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Tapşırıq mətni</Label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                />
              </div>

              <p className="text-[10px] text-muted-foreground">
                {taskRecurrent
                  ? `Hər həftə ${WEEKDAYS.find((w) => w.v === taskWeekday)?.label} günü ${taskHour}-də tapşırıq yaranır`
                  : "Birdəfəlik tapşırıq yaranır (növbəti hədəf günün saatında)"}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Bağla
          </Button>
          <Button onClick={onPrimaryClick} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {mode === "whatsapp" && "WhatsApp ilə aç"}
            {mode === "sms" && "SMS göndər"}
            {mode === "task" && "Tapşırıq yarat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeBtn({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  tone?: "emerald" | "primary";
}) {
  const activeCls =
    tone === "emerald"
      ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : tone === "primary"
        ? "border-primary bg-primary/10 text-primary"
        : "border-foreground bg-foreground/10";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-center transition ${
        active ? activeCls : "border-border hover:border-foreground/40 hover:bg-secondary/30"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-[11px] font-bold">{label}</span>
      <span className="text-[9px] text-muted-foreground">{hint}</span>
    </button>
  );
}
