"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2, User } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { notifySuccess, notifyError } from "@/features/shared/toast-helpers";
import { createTask } from "../actions";
import { TaskColorPicker } from "./color-picker";
import { MultiUserSelect } from "./multi-user-select";

type UserOpt = { id: string; ad_soyad: string; vezife?: string | null };

const ERP_OBJEKTLER = [
  { value: "", label: "— Bağlanma yoxdur —" },
  { value: "satish", label: "Satış" },
  { value: "alish", label: "Alış" },
  { value: "servis", label: "Servis" },
  { value: "musteri", label: "Müştəri" },
  { value: "isci", label: "İşçi" },
  { value: "mehsul", label: "Məhsul" },
];

type Props = {
  users: UserOpt[];
  currentUserId: string;
  defaultObyektNov?: string;
  defaultObyektId?: string;
  defaultObyektBasliq?: string;
  triggerLabel?: string;
};

export function NewTaskDialog({
  users,
  currentUserId,
  defaultObyektNov,
  defaultObyektId,
  defaultObyektBasliq,
  triggerLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mesulId, setMesulId] = useState<string>(currentUserId);
  const [obyektNov, setObyektNov] = useState<string>(defaultObyektNov ?? "");
  const [reng, setReng] = useState<string>("");
  const [icracilar, setIcracilar] = useState<string[]>([]);

  function setSelf() {
    setMesulId(currentUserId);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    // Multi icracilar — handled via hidden inputs (one per id)
    icracilar.forEach((id) => fd.append("icracilar", id));
    if (reng) fd.set("reng", reng);
    startTransition(async () => {
      const res = await createTask(fd);
      if (!res.ok) {
        setError(res.error);
        notifyError("Tapşırıq yaradılmadı", res.error);
      } else {
        notifySuccess("Tapşırıq yaradıldı", {
          description: "Yeni tapşırıq siyahıya əlavə olundu",
        });
        setOpen(false);
        // reset local state
        setIcracilar([]);
        setReng("");
        setMesulId(currentUserId);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="font-semibold text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="h-4 w-4" />
          {triggerLabel ?? "Yeni tapşırıq"}
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni tapşırıq</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          onKeyDown={(e) => {
            // Enter — sahə (input/select) içində növbəti sahəyə keç,
            // final-da Submit. Textarea üçün adi Enter (yeni sətir) saxlanılır.
            const t = e.target as HTMLElement;
            if (e.key !== "Enter" || e.shiftKey) return;
            if (t.tagName === "TEXTAREA") return;
            if (t.tagName === "BUTTON" && (t as HTMLButtonElement).type === "submit") return;
            // Native form içində Enter form submit-i aşağıdakı tək input
            // halında olur — multi-sahəli formlarda növbəti element-ə keçirik.
            const form = e.currentTarget as HTMLFormElement;
            const focusables = Array.from(
              form.querySelectorAll<HTMLElement>(
                "input:not([type=hidden]), select, [role=combobox], button[type=submit]",
              ),
            ).filter((el) => !el.hasAttribute("disabled"));
            const idx = focusables.indexOf(t);
            if (idx < 0) return;
            const next = focusables[idx + 1];
            if (next && next.tagName !== "BUTTON") {
              e.preventDefault();
              next.focus();
            }
          }}
          className="space-y-4"
        >
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="basliq">
              Başlıq <span className="text-rose-500" aria-label="məcburi">*</span>
            </Label>
            <Input id="basliq" name="basliq" required maxLength={200} autoFocus disabled={pending} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tesvir">Təsvir</Label>
            <textarea
              id="tesvir"
              name="tesvir"
              rows={3}
              maxLength={5000}
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={pending}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tip">Tip</Label>
              <select
                id="tip"
                name="tip"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                defaultValue="adi"
                disabled={pending}
              >
                <option value="adi">Adi tapşırıq</option>
                <option value="cagrish">Çağrış</option>
                <option value="gorush">Görüş</option>
                <option value="email">E-poçt</option>
                <option value="senedlesme">Sənədləşmə</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prioritet">Prioritet</Label>
              <select
                id="prioritet"
                name="prioritet"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                defaultValue="normal"
                disabled={pending}
              >
                <option value="asagi">Aşağı</option>
                <option value="normal">Normal</option>
                <option value="yuksek">Yüksək</option>
                <option value="tecili">Təcili</option>
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="mesul_id">Məsul (əsas)</Label>
                <button
                  type="button"
                  onClick={setSelf}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                  title="Özümə tapşır"
                >
                  <User className="h-3 w-3" /> Mən özüm
                </button>
              </div>
              <Combobox
                options={users.map<ComboOption>((u) => ({
                  value: u.id,
                  label: u.vezife ? `${u.ad_soyad} (${u.vezife})` : u.ad_soyad,
                }))}
                value={mesulId}
                onChange={setMesulId}
                placeholder="— Seçin —"
                searchPlaceholder="🔍 İstifadəçi axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
              <input type="hidden" name="mesul_id" value={mesulId} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Əlavə icraçılar (multi)</Label>
            <MultiUserSelect
              users={users}
              value={icracilar}
              onChange={setIcracilar}
              excludeId={mesulId}
              placeholder="Əlavə icraçılar seçin..."
              disabled={pending}
            />
            <p className="text-[10.5px] text-muted-foreground">Bir tapşırığı eyni anda bir neçə işçiyə verə bilərsiniz</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="deadline">Son tarix</Label>
              <Input
                id="deadline"
                name="deadline"
                type="datetime-local"
                disabled={pending}
              />
              <div className="flex flex-wrap gap-1">
                {[
                  { label: "Bu gün 18:00", today18: true },
                  { label: "Sabah", days: 1 },
                  { label: "3 gün", days: 3 },
                  { label: "1 həftə", days: 7 },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      const input = document.getElementById("deadline") as HTMLInputElement | null;
                      if (!input) return;
                      let d = new Date();
                      if (p.today18) { d.setHours(18, 0, 0, 0); }
                      else if (p.days) { d.setDate(d.getDate() + p.days); d.setHours(18, 0, 0, 0); }
                      const pad = (n: number) => String(n).padStart(2, "0");
                      input.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    }}
                    disabled={pending}
                    className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[10.5px] font-medium hover:bg-secondary"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="xatirlatma">Xatırlatma</Label>
              <Input
                id="xatirlatma"
                name="xatirlatma"
                type="datetime-local"
                disabled={pending}
              />
              <div className="flex flex-wrap gap-1">
                {[
                  { label: "10 dəq", min: 10 },
                  { label: "1 saat", min: 60 },
                  { label: "Sabah 09:00", tomorrow9: true },
                  { label: "Həftə sonu", weekend: true },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      const input = document.getElementById("xatirlatma") as HTMLInputElement | null;
                      if (!input) return;
                      let d = new Date();
                      if (p.min) d = new Date(Date.now() + p.min * 60000);
                      else if (p.tomorrow9) { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
                      else if (p.weekend) { const dow = d.getDay(); const offset = (6 - dow + 7) % 7 || 7; d.setDate(d.getDate() + offset); d.setHours(9, 0, 0, 0); }
                      // datetime-local format: YYYY-MM-DDTHH:mm
                      const pad = (n: number) => String(n).padStart(2, "0");
                      input.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    }}
                    disabled={pending}
                    className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[10.5px] font-medium hover:bg-secondary"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-3">
            <Label>Rəng (kart sol kənarında strip)</Label>
            <TaskColorPicker value={reng} onChange={setReng} disabled={pending} />
          </div>

          <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ERP obyektinə bağla
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="obyekt_nov" className="text-xs">Növ</Label>
                <select
                  id="obyekt_nov"
                  name="obyekt_nov"
                  value={obyektNov}
                  onChange={(e) => setObyektNov(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  disabled={pending}
                >
                  {ERP_OBJEKTLER.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obyekt_id" className="text-xs">Obyekt ID</Label>
                <Input
                  id="obyekt_id"
                  name="obyekt_id"
                  placeholder="məs. uuid və ya kod"
                  disabled={pending || !obyektNov}
                  defaultValue={defaultObyektId ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obyekt_basliq" className="text-xs">Obyekt başlığı</Label>
                <Input
                  id="obyekt_basliq"
                  name="obyekt_basliq"
                  placeholder="(opsional)"
                  disabled={pending || !obyektNov}
                  defaultValue={defaultObyektBasliq ?? ""}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gorunurluk">Görünürlük</Label>
              <select
                id="gorunurluk"
                name="gorunurluk"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                defaultValue="sexsi"
                disabled={pending}
              >
                <option value="sexsi">Şəxsi</option>
                <option value="secilmish">Seçilmiş şəxslər</option>
                <option value="umumi">Hamı</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border bg-secondary/30 p-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="requires_approval"
                value="1"
                className="h-4 w-4 rounded border-input"
                disabled={pending}
              />
              <span>Rəhbər təsdiqi tələb olunur</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="escalation_enabled"
                value="1"
                className="h-4 w-4 rounded border-input"
                disabled={pending}
              />
              <span>Gecikəndə rəhbərə avto bildiriş</span>
            </label>
            {/* QA-orta: eskalasiya hədəfi seçimi — əvvəl heç bir formada yox idi,
                escalation_to həmişə NULL qalırdı və rəhbər bildirişi işləmirdi */}
            <select
              name="escalation_to"
              aria-label="Eskalasiya rəhbəri"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              defaultValue=""
              disabled={pending}
            >
              <option value="">— Eskalasiya rəhbəri (opsional) —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.vezife ? `${u.ad_soyad} (${u.vezife})` : u.ad_soyad}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="broadcast_all"
                value="1"
                className="h-4 w-4 rounded border-input"
                disabled={pending}
              />
              <span className="inline-flex items-center gap-1">
                📣 <b>Hamı işçiyə paylaş</b>
                <span className="text-[10.5px] text-muted-foreground">(bütün aktiv əməkdaşlar icraçı olur)</span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="send_telegram"
                value="1"
                className="h-4 w-4 rounded border-input"
                disabled={pending}
              />
              <span className="inline-flex items-center gap-1">
                ✈️ <b>Telegram-a göndər</b>
                <span className="text-[10.5px] text-muted-foreground">(şirkət chat-inə)</span>
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Ləğv
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yarat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
