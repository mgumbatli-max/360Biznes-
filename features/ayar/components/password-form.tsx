"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { changePassword } from "../actions";

export function PasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await changePassword(fd);
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success("Şifrə dəyişdirildi");
        e.currentTarget.reset();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="space-y-2">
        <Label htmlFor="kohne">Köhnə şifrə *</Label>
        <Input id="kohne" name="kohne" type="password" required minLength={6} disabled={pending} autoComplete="current-password" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="yeni">Yeni şifrə *</Label>
          <Input id="yeni" name="yeni" type="password" required minLength={6} maxLength={100} disabled={pending} autoComplete="new-password" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="yeni_tekrar">Yeni şifrə təkrar *</Label>
          <Input id="yeni_tekrar" name="yeni_tekrar" type="password" required minLength={6} maxLength={100} disabled={pending} autoComplete="new-password" />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Şifrəni dəyişdir
      </Button>
    </form>
  );
}
