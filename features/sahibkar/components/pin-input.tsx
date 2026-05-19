"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { setupPin, verifyPin } from "../actions";

type Mode = "setup" | "verify";

export function PinInput({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = mode === "setup" ? await setupPin(fd) : await verifyPin(fd);
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success(mode === "setup" ? "PIN qoyuldu" : "Daxil olundu");
        router.push("/sahibkar");
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-180px)] max-w-md flex-col items-center justify-center px-4">
      <Card className="glass w-full">
        <CardContent className="space-y-5 py-8">
          <div className="text-center">
            <div
              className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl"
              style={{ background: "var(--brand-gradient)" }}
            >
              {mode === "setup" ? <ShieldCheck className="h-6 w-6 text-white" /> : <Lock className="h-6 w-6 text-white" />}
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              {mode === "setup" ? "Sahibkar PIN-ni qurun" : "Sahibkar PIN-ni daxil edin"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === "setup"
                ? "Bu PIN sahibkar bölməsinə daxil olmaq üçün lazım olacaq. 4-8 rəqəm seçin."
                : "Sessiya 15 dəqiqə aktiv qalır."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <div className="space-y-2">
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="\d{4,8}"
                minLength={4}
                maxLength={8}
                required
                autoFocus
                autoComplete="off"
                disabled={pending}
                className="text-center font-mono text-lg tracking-[0.5em]"
              />
            </div>

            {mode === "setup" && (
              <div className="space-y-2">
                <Label htmlFor="pin_tekrar">PIN təkrar</Label>
                <Input
                  id="pin_tekrar"
                  name="pin_tekrar"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4,8}"
                  minLength={4}
                  maxLength={8}
                  required
                  autoComplete="off"
                  disabled={pending}
                  className="text-center font-mono text-lg tracking-[0.5em]"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full font-semibold text-white"
              style={{ background: "var(--brand-gradient)" }}
              disabled={pending}
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "setup" ? "PIN qoy və daxil ol" : "Daxil ol"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
