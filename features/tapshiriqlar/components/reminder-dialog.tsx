"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Bell, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { setTaskReminder } from "../actions";

type UserOpt = { id: string; ad_soyad: string; vezife?: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskBasliq: string;
  defaultDatetime?: string | null;
  users?: UserOpt[];
};

const PRESETS = [
  { label: "İndi", minutes: 0, icon: Zap },
  { label: "+15 dəq", minutes: 15 },
  { label: "+1 saat", minutes: 60 },
  { label: "+3 saat", minutes: 180 },
  { label: "Sabah", minutes: 60 * 24 },
  { label: "Növbəti həftə", minutes: 60 * 24 * 7 },
];

type Gizlilik = "yalniz_alan" | "paylasilan" | "umumi";

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReminderDialog({ open, onOpenChange, taskId, taskBasliq, defaultDatetime, users = [] }: Props) {
  const [datetime, setDatetime] = useState<string>("");
  const [repeat, setRepeat] = useState<"yox" | "gunluk" | "heftelik" | "ayliq">("yox");
  const [message, setMessage] = useState<string>("");
  const [kimeId, setKimeId] = useState<string>("");
  const [gizlilik, setGizlilik] = useState<Gizlilik>("yalniz_alan");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setError(null);
      if (defaultDatetime) {
        try {
          setDatetime(toLocalInputValue(new Date(defaultDatetime)));
        } catch {
          setDatetime("");
        }
      } else {
        const d = new Date();
        d.setMinutes(d.getMinutes() + 15);
        setDatetime(toLocalInputValue(d));
      }
      setRepeat("yox");
      setMessage("");
      setKimeId("");
      setGizlilik("yalniz_alan");
    }
  }, [open, defaultDatetime]);

  function applyPreset(minutes: number) {
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutes);
    setDatetime(toLocalInputValue(d));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!datetime) {
      setError("Tarix-vaxt seçin");
      return;
    }
    startTransition(async () => {
      const res = await setTaskReminder({
        taskId,
        datetime,
        repeat,
        message: message.trim() || undefined,
        kime_id: kimeId || undefined,
        gizlilik,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success("Xatırlatma qoyuldu");
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-rose-500" />
            <span>Xatırlatma — {taskBasliq}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sürətli seçim
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const Icon = p.icon;
                const isNow = p.minutes === 0;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.minutes)}
                    disabled={pending}
                    className={
                      "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50 " +
                      (isNow
                        ? "border-rose-400 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
                        : "border-border bg-secondary/40 hover:bg-secondary")
                    }
                  >
                    {Icon && <Icon className="h-3 w-3" />}
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rem-datetime" className="text-xs uppercase tracking-wider text-muted-foreground">
              Və ya tarix-vaxt seç
            </Label>
            <Input
              id="rem-datetime"
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              disabled={pending}
            />
          </div>

          {users.length > 0 && (
            <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Kimə göndər
              </Label>
              <Combobox
                options={[
                  { value: "", label: "Məsula göndər (default)" },
                  ...users.map<ComboOption>((u) => ({
                    value: u.id,
                    label: u.vezife ? `${u.ad_soyad} (${u.vezife})` : u.ad_soyad,
                  })),
                ]}
                value={kimeId}
                onChange={setKimeId}
                placeholder="Məsula göndər (default)"
                searchPlaceholder="🔍 İstifadəçi axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />

              <div className="pt-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Görmə icazəsi
                </Label>
                <div className="mt-1.5 grid grid-cols-1 gap-1.5">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="gizlilik"
                      value="yalniz_alan"
                      checked={gizlilik === "yalniz_alan"}
                      onChange={() => setGizlilik("yalniz_alan")}
                      disabled={pending}
                    />
                    <span>Yalnız o işçi görsün</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="gizlilik"
                      value="paylasilan"
                      checked={gizlilik === "paylasilan"}
                      onChange={() => setGizlilik("paylasilan")}
                      disabled={pending}
                    />
                    <span>Mən + o işçi görsün</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="gizlilik"
                      value="umumi"
                      checked={gizlilik === "umumi"}
                      onChange={() => setGizlilik("umumi")}
                      disabled={pending}
                    />
                    <span>Hamı görsün</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="rem-repeat">Təkrarlansın?</Label>
            <select
              id="rem-repeat"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as typeof repeat)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              disabled={pending}
            >
              <option value="yox">Yox — bir dəfə</option>
              <option value="gunluk">Gündəlik</option>
              <option value="heftelik">Həftəlik</option>
              <option value="ayliq">Aylıq</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rem-message">Mesaj (opsional)</Label>
            <textarea
              id="rem-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="məs: müştəri zəng etməyi gözləyir"
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={pending}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Ləğv
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="bg-rose-500 text-white hover:bg-rose-600"
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Qoy
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
