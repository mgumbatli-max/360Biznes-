"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  KeyRound,
  Power,
  PowerOff,
  LogOut,
  ShieldOff,
  Trash2,
  RotateCcw,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminResetUserPassword,
  adminSetUserActive,
  adminForceLogout,
  adminDisable2FA,
  adminSoftDeleteUser,
  adminRestoreUser,
} from "@/features/platform-admin/actions";

type Props = {
  user: {
    id: string;
    ad_soyad: string;
    aktiv: boolean;
    deleted_at?: Date | string | null;
    iki_fa_aktiv?: boolean;
  };
};

type Toast = { kind: "ok" | "err"; msg: string } | null;

export function UserAdminActions({ user }: Props) {
  const router = useRouter();
  const isDeleted = Boolean(user.deleted_at);

  // Şifrə dialoqu
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwdErr, setPwdErr] = useState<string | null>(null);
  const [pwdOk, setPwdOk] = useState(false);

  // Sil dialoqu (səbəb)
  const [delOpen, setDelOpen] = useState(false);
  const [sebeb, setSebeb] = useState("");
  const [delErr, setDelErr] = useState<string | null>(null);

  // Sətir bildirişi (qısa müddətli)
  const [toast, setToast] = useState<Toast>(null);
  const [pending, start] = useTransition();

  function flash(t: Toast) {
    setToast(t);
    if (t) setTimeout(() => setToast(null), 3000);
  }

  function run(
    action: (fd: FormData) => Promise<{ ok: true } | { ok: false; error: string }>,
    fields: Record<string, string>,
    okMsg: string,
  ) {
    start(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const r = await action(fd);
      if (r.ok) {
        flash({ kind: "ok", msg: okMsg });
        router.refresh();
      } else {
        flash({ kind: "err", msg: r.error });
      }
    });
  }

  function resetPassword(formData: FormData) {
    setPwdErr(null);
    setPwdOk(false);
    start(async () => {
      const r = await adminResetUserPassword(formData);
      if (r.ok) {
        setPwdOk(true);
        setPwd("");
        setTimeout(() => {
          setPwdOpen(false);
          setPwdOk(false);
          router.refresh();
        }, 900);
      } else {
        setPwdErr(r.error);
      }
    });
  }

  function confirmDelete() {
    setDelErr(null);
    start(async () => {
      const fd = new FormData();
      fd.set("user_id", user.id);
      fd.set("sebeb", sebeb.trim());
      const r = await adminSoftDeleteUser(fd);
      if (r.ok) {
        setDelOpen(false);
        setSebeb("");
        flash({ kind: "ok", msg: "İstifadəçi silindi" });
        router.refresh();
      } else {
        setDelErr(r.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {toast ? (
        <span
          className={`inline-flex max-w-[200px] items-center gap-1 truncate text-[11px] ${
            toast.kind === "ok" ? "text-success" : "text-danger"
          }`}
          title={toast.msg}
        >
          {toast.kind === "ok" ? (
            <Check className="h-3 w-3 shrink-0" />
          ) : (
            <AlertCircle className="h-3 w-3 shrink-0" />
          )}
          {toast.msg}
        </span>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={pending}
            aria-label="Əməliyyatlar"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="truncate text-xs text-muted-foreground">
            {user.ad_soyad}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setPwdOpen(true);
            }}
          >
            <KeyRound className="h-4 w-4" /> Şifrə yenilə
          </DropdownMenuItem>

          {user.aktiv ? (
            <DropdownMenuItem
              onSelect={() =>
                run(
                  adminSetUserActive,
                  { user_id: user.id, aktiv: "false" },
                  "İstifadəçi deaktiv edildi",
                )
              }
            >
              <PowerOff className="h-4 w-4" /> Deaktiv et
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() =>
                run(
                  adminSetUserActive,
                  { user_id: user.id, aktiv: "true" },
                  "İstifadəçi aktiv edildi",
                )
              }
            >
              <Power className="h-4 w-4" /> Aktiv et
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onSelect={() => {
              if (!confirm(`${user.ad_soyad} üçün bütün sessiyalar bağlansın?`)) return;
              run(
                adminForceLogout,
                { user_id: user.id },
                "Sessiyalar bağlandı",
              );
            }}
          >
            <LogOut className="h-4 w-4" /> Sessiyaları bağla
          </DropdownMenuItem>

          {user.iki_fa_aktiv !== false ? (
            <DropdownMenuItem
              onSelect={() => {
                if (!confirm(`${user.ad_soyad} üçün 2FA söndürülsün?`)) return;
                run(adminDisable2FA, { user_id: user.id }, "2FA söndürüldü");
              }}
            >
              <ShieldOff className="h-4 w-4" /> 2FA söndür
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSeparator />

          {isDeleted ? (
            <DropdownMenuItem
              onSelect={() =>
                run(adminRestoreUser, { user_id: user.id }, "İstifadəçi bərpa edildi")
              }
            >
              <RotateCcw className="h-4 w-4" /> Bərpa et
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault();
                setDelOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" /> Sil
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Şifrə yenilə dialoqu */}
      <Dialog
        open={pwdOpen}
        onOpenChange={(o) => {
          setPwdOpen(o);
          if (!o) {
            setPwd("");
            setPwdErr(null);
            setPwdOk(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Şifrəni yenilə</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{user.ad_soyad}</span> üçün yeni şifrə
              təyin et. İstifadəçi növbəti girişdə şifrəni dəyişməyə məcbur olacaq.
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setPwdOpen(false)}
                disabled={pending}
              >
                Ləğv et
              </Button>
              <Button type="submit" disabled={pending || pwd.length < 6}>
                {pending ? "Yenilənir…" : "Şifrəni yenilə"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sil dialoqu (səbəb) */}
      <Dialog
        open={delOpen}
        onOpenChange={(o) => {
          setDelOpen(o);
          if (!o) {
            setSebeb("");
            setDelErr(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>İstifadəçini sil</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{user.ad_soyad}</span> silinəcək (yumşaq
              silmə). İstifadəçi deaktiv olacaq və sonradan bərpa edilə bilər.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`del_sebeb_${user.id}`}>Səbəb (istəyə bağlı)</Label>
              <Input
                id={`del_sebeb_${user.id}`}
                value={sebeb}
                onChange={(e) => setSebeb(e.target.value)}
                placeholder="Məsələn: işdən çıxıb"
              />
            </div>
            {delErr ? (
              <p className="flex items-center gap-1.5 text-xs text-danger">
                <AlertCircle className="h-3.5 w-3.5" /> {delErr}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDelOpen(false)}
              disabled={pending}
            >
              Ləğv et
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={pending}
            >
              {pending ? "Silinir…" : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
