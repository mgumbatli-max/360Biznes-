"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, UserPlus, Eye, EyeOff, Shuffle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { createUser } from "../actions";

type Role = { id: number; ad: string; reng: string | null; sistem: boolean | null };
type Filial = { id: number; ad: string };

export function UserCreateDialog({
  roles,
  filiallar,
  defaultRoleId,
  trigger,
}: {
  roles: Role[];
  filiallar: Filial[];
  /** Forma açılanda öncədən seçili olan rol id-si (rol detalından çağırılanda). */
  defaultRoleId?: number;
  /** Standart "+ Yeni" düyməsi əvəzinə xüsusi trigger element. */
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let p = "";
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p);
    setShowPw(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("sifre", password);
    startTransition(async () => {
      const res = await createUser(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(`İstifadəçi yaradıldı. Şifrə: ${password}`);
        setOpen(false);
        setPassword("");
        router.refresh();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setError(null);
          setPassword("");
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
            <Plus className="h-4 w-4" /> Yeni
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto md:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Yeni istifadəçi
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ad_soyad">Ad Soyad *</Label>
              <Input id="ad_soyad" name="ad_soyad" required minLength={2} maxLength={100} autoFocus disabled={pending} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="isci_kod">İşçi kodu</Label>
              <Input id="isci_kod" name="isci_kod" maxLength={20} placeholder="EMP-001" disabled={pending} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" required maxLength={150} placeholder="istifadeci@firma.az" disabled={pending} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefon">Telefon</Label>
              <Input id="telefon" name="telefon" type="tel" maxLength={20} placeholder="+994..." disabled={pending} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vezife">Vəzifə</Label>
            <Input id="vezife" name="vezife" maxLength={100} placeholder="Satıcı, Anbardar, Müdir..." disabled={pending} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rol_id">Rol *</Label>
              <select
                id="rol_id"
                name="rol_id"
                required
                defaultValue={defaultRoleId ? String(defaultRoleId) : ""}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={pending}
              >
                <option value="">— Rol seçin —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.ad} {r.sistem ? "(sistem)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="default_filial_id">Default filial</Label>
              <select
                id="default_filial_id"
                name="default_filial_id"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={pending}
              >
                <option value="">— Hamısı —</option>
                {filiallar.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.ad}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sifre">Başlanğıc şifrəsi *</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="sifre"
                  type={showPw ? "text" : "password"}
                  required
                  minLength={6}
                  maxLength={100}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pending}
                  className="pr-9 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={generatePassword}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/70"
                disabled={pending}
              >
                <Shuffle className="h-3.5 w-3.5" /> Random
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">Ən az 6 simvol. İstifadəçi ilk girişdə dəyişməyə məcbur edilə bilər.</p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="mecburi_sifre_deyis"
              value="true"
              defaultChecked
              className="h-4 w-4 accent-primary"
              disabled={pending}
            />
            İlk girişdə şifrə dəyişikliyini məcbur et
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" disabled={pending || !password || password.length < 6}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yarat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
