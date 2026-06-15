"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Power, PowerOff, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminResetUserPassword, adminSetUserActive } from "@/features/platform-admin/actions";

type Props = {
  user: { id: string; ad_soyad: string; aktiv: boolean };
};

export function UserAdminActions({ user }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwdErr, setPwdErr] = useState<string | null>(null);
  const [pwdOk, setPwdOk] = useState(false);
  const [rowErr, setRowErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function resetPassword(formData: FormData) {
    setPwdErr(null);
    setPwdOk(false);
    start(async () => {
      const r = await adminResetUserPassword(formData);
      if (r.ok) {
        setPwdOk(true);
        setPwd("");
        // qısa təsdiq göstər, sonra bağla
        setTimeout(() => {
          setOpen(false);
          setPwdOk(false);
          router.refresh();
        }, 900);
      } else {
        setPwdErr(r.error);
      }
    });
  }

  function toggleActive() {
    setRowErr(null);
    const next = user.aktiv ? "false" : "true";
    start(async () => {
      const fd = new FormData();
      fd.set("user_id", user.id);
      fd.set("aktiv", next);
      const r = await adminSetUserActive(fd);
      if (r.ok) {
        router.refresh();
      } else {
        setRowErr(r.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {rowErr ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-danger" title={rowErr}>
          <AlertCircle className="h-3 w-3" /> {rowErr}
        </span>
      ) : null}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setPwd(""); setPwdErr(null); setPwdOk(false); } }}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-7" disabled={pending}>
            <KeyRound className="h-3.5 w-3.5" /> Şifrə yenilə
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Şifrəni yenilə</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{user.ad_soyad}</span> üçün yeni şifrə təyin et. İstifadəçi növbəti girişdə şifrəni dəyişməyə məcbur olacaq.
            </DialogDescription>
          </DialogHeader>
          <form action={resetPassword} className="space-y-3">
            <input type="hidden" name="user_id" value={user.id} />
            <div className="space-y-1.5">
              <Label htmlFor={`yeni_sifre_${user.id}`}>Yeni şifrə</Label>
              <Input
                id={`yeni_sifre_${user.id}`}
                name="yeni_sifre"
                type="password"
                autoComplete="new-password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                minLength={6}
                required
                placeholder="Ən azı 6 simvol"
              />
            </div>
            {pwdErr ? (
              <p className="flex items-center gap-1.5 text-xs text-danger">
                <AlertCircle className="h-3.5 w-3.5" /> {pwdErr}
              </p>
            ) : null}
            {pwdOk ? (
              <p className="flex items-center gap-1.5 text-xs text-success">
                <Check className="h-3.5 w-3.5" /> Şifrə yeniləndi
              </p>
            ) : null}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Ləğv et
              </Button>
              <Button type="submit" disabled={pending || pwd.length < 6}>
                {pending ? "Yenilənir…" : "Şifrəni yenilə"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {user.aktiv ? (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-danger hover:bg-danger/10"
          disabled={pending}
          onClick={toggleActive}
        >
          <PowerOff className="h-3.5 w-3.5" /> Deaktiv et
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-success hover:bg-success/10"
          disabled={pending}
          onClick={toggleActive}
        >
          <Power className="h-3.5 w-3.5" /> Aktiv et
        </Button>
      )}
    </div>
  );
}
