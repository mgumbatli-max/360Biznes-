"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Pencil,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Shuffle,
  Trash2,
  ShieldAlert,
  Smartphone,
  Plus,
  X,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  updateUserProfile,
  changeUserRole,
  resetUserPassword,
  deleteUser,
  updateUserIpRestriction,
  setUserSessionLimit,
} from "../actions";

// ============= PROFILE EDIT =============

type ProfileInitial = {
  id: string;
  ad_soyad: string;
  telefon: string | null;
  vezife: string | null;
  isci_kod: string | null;
  ehtiyat_telefon: string | null;
  dil: string;
  time_zone: string;
  qeyd: string | null;
};

export function UserProfileEditDialog({ user }: { user: ProfileInitial }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", user.id);
    startTransition(async () => {
      const res = await updateUserProfile(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Profil yeniləndi");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" /> Profili redaktə
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-xl">
        <DialogHeader>
          <DialogTitle>Profili redaktə et</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p_adsoyad">Ad Soyad *</Label>
              <Input id="p_adsoyad" name="ad_soyad" required minLength={2} maxLength={100} defaultValue={user.ad_soyad} disabled={pending} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p_isci">İşçi kodu</Label>
              <Input id="p_isci" name="isci_kod" maxLength={20} defaultValue={user.isci_kod ?? ""} disabled={pending} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p_vezife">Vəzifə</Label>
              <Input id="p_vezife" name="vezife" maxLength={100} defaultValue={user.vezife ?? ""} disabled={pending} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p_tel">Telefon</Label>
              <Input id="p_tel" name="telefon" type="tel" maxLength={20} defaultValue={user.telefon ?? ""} disabled={pending} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p_etel">Ehtiyat telefon</Label>
            <Input id="p_etel" name="ehtiyat_telefon" type="tel" maxLength={30} defaultValue={user.ehtiyat_telefon ?? ""} disabled={pending} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p_dil">İnterfeys dili</Label>
              <select
                id="p_dil"
                name="dil"
                defaultValue={user.dil}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={pending}
              >
                <option value="az">Azərbaycan</option>
                <option value="en">English</option>
                <option value="ru">Русский</option>
                <option value="tr">Türkçe</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p_tz">Saat qurşağı</Label>
              <select
                id="p_tz"
                name="time_zone"
                defaultValue={user.time_zone}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={pending}
              >
                <option value="Asia/Baku">Bakı (GMT+4)</option>
                <option value="Europe/Istanbul">İstanbul (GMT+3)</option>
                <option value="Europe/Moscow">Moskva (GMT+3)</option>
                <option value="Europe/London">London (GMT+0)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p_qeyd">Daxili qeyd</Label>
            <textarea
              id="p_qeyd"
              name="qeyd"
              rows={2}
              maxLength={2000}
              defaultValue={user.qeyd ?? ""}
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={pending}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yenilə
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============= ROLE CHANGE =============

type RoleOpt = { id: number; ad: string; reng: string | null; aciqlamaq: string | null; sistem: boolean | null; _count?: { rol_icazeleri: number; istifadeciler: number } };

export function UserRoleChangeDialog({
  userId,
  currentRoleId,
  currentRoleName,
  roles,
}: {
  userId: string;
  currentRoleId: number | null;
  currentRoleName: string;
  roles: RoleOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(currentRoleId ?? roles[0]?.id ?? 0);

  function onConfirm() {
    setError(null);
    const fd = new FormData();
    fd.set("id", userId);
    fd.set("rol_id", String(selected));
    startTransition(async () => {
      const res = await changeUserRole(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Rol dəyişdirildi");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold">
          Rolu dəyiş
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto md:max-w-md">
        <DialogHeader>
          <DialogTitle>Rol dəyişikliyi</DialogTitle>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="text-xs text-muted-foreground">
          Hazırkı rol: <span className="font-semibold text-foreground">{currentRoleName}</span>
        </div>
        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {roles.map((r) => {
            const active = r.id === selected;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r.id)}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${
                  active ? "border-primary bg-primary/5" : "border-border/40 hover:border-border hover:bg-secondary/40"
                }`}
              >
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white text-xs font-bold"
                  style={{ background: r.reng ?? "#6366F1" }}
                >
                  {r.ad.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold capitalize">{r.ad}</span>
                    {r.sistem && <Badge variant="outline" className="text-[9px]">sistem</Badge>}
                    {r.id === currentRoleId && <Badge variant="outline" className="text-[9px] text-primary border-primary/40">cari</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {r._count?.rol_icazeleri ?? "—"} icazə · {r._count?.istifadeciler ?? "—"} istifadəçi
                  </div>
                  {r.aciqlamaq && <div className="line-clamp-1 text-[11px] text-muted-foreground">{r.aciqlamaq}</div>}
                </div>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
          <Button type="button" onClick={onConfirm} disabled={pending || selected === currentRoleId}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Təsdiqlə
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= PASSWORD RESET =============

export function UserPasswordResetDialog({ userId, userName }: { userId: string; userName: string }) {
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
    fd.set("id", userId);
    fd.set("yeni_sifre", password);
    startTransition(async () => {
      const res = await resetUserPassword(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(`${userName} üçün yeni şifrə təyin edildi: ${password}`);
        setOpen(false);
        setPassword("");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <KeyRound className="h-3.5 w-3.5" /> Şifrəni dəyiş
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-500" /> «{userName}» — yeni şifrə
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <Alert>
            <AlertDescription className="text-xs">
              Yeni şifrə istifadəçiyə birbaşa verilməlidir. İstifadəçi ilk girişdə dəyişməyə məcbur ola bilər.
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label htmlFor="r_sifre">Yeni şifrə *</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="r_sifre"
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
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="mecburi_deyis" value="true" defaultChecked className="h-4 w-4 accent-primary" disabled={pending} />
            İstifadəçi ilk girişdə şifrəni dəyişməlidir
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending || password.length < 6} className="bg-amber-600 hover:bg-amber-700">
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Şifrəni təyin et
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============= IP RESTRICTION =============

export function UserIpRestrictionDialog({
  userId,
  currentIps,
}: {
  userId: string;
  currentIps: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [newIp, setNewIp] = useState("");

  function addIp() {
    if (!newIp.trim()) return;
    const fd = new FormData();
    fd.set("id", userId);
    fd.set("action", "add");
    fd.set("ip", newIp.trim());
    startTransition(async () => {
      const res = await updateUserIpRestriction(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("IP əlavə olundu");
        setNewIp("");
        router.refresh();
      }
    });
  }

  function removeIp(ip: string) {
    const fd = new FormData();
    fd.set("id", userId);
    fd.set("action", "remove");
    fd.set("ip", ip);
    startTransition(async () => {
      const res = await updateUserIpRestriction(fd);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success("IP silindi");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Shield className="h-3.5 w-3.5" /> IP məhdudiyyəti
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> İcazəli IP-lər
          </DialogTitle>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Alert>
          <AlertDescription className="text-xs">
            Siyahı boş = bütün IP-lərdən girişə icazəlidir. IP əlavə etdikdən sonra yalnız o IP-lərdən giriş mümkün olar.
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Input
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            placeholder="192.168.1.50 və ya 10.0.0.0/8"
            disabled={pending}
            className="font-mono"
          />
          <Button type="button" onClick={addIp} disabled={pending || !newIp.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1">
          {currentIps.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              Heç bir IP məhdudiyyəti yoxdur
            </div>
          ) : (
            currentIps.map((ip) => (
              <div key={ip} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-1.5">
                <span className="font-mono text-sm">{ip}</span>
                <button
                  type="button"
                  onClick={() => removeIp(ip)}
                  disabled={pending}
                  className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Bağla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= SESSION LIMIT =============

export function UserSessionLimitDialog({
  userId,
  currentLimit,
}: {
  userId: string;
  currentLimit: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [limit, setLimit] = useState(currentLimit);

  function save() {
    const fd = new FormData();
    fd.set("id", userId);
    fd.set("limit", String(limit));
    startTransition(async () => {
      const res = await setUserSessionLimit(fd);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success("Sessiya limiti yeniləndi");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Smartphone className="h-3.5 w-3.5" /> Sessiya limiti
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Sessiya limiti</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Eyni anda maksimum sessiya</Label>
            <Input
              type="number"
              min={0}
              max={50}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={pending}
            />
            <p className="text-[11px] text-muted-foreground">
              0 = limitsiz · 1 = yalnız 1 qurğudan giriş · 3+ = paralel sessiya icazəsi
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2, 3, 5, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setLimit(n)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  limit === n ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {n === 0 ? "Limitsiz" : n}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
          <Button type="button" onClick={save} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Saxla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= DELETE USER =============

export function UserDeleteButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`«${userName}» istifadəçisini deaktiv etmək istədiyinizə əminsiniz?\n\nQeyd: tarixçə qorunur — istifadəçi yalnız bağlanır.`)) return;
    const fd = new FormData();
    fd.set("id", userId);
    startTransition(async () => {
      const res = await deleteUser(fd);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success("İstifadəçi deaktiv edildi");
        router.refresh();
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onDelete}
      disabled={pending}
      className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
      Deaktiv et
    </Button>
  );
}

// Re-export action types for type-safe usage in callers
export type { ProfileInitial as UserProfileInitial };
