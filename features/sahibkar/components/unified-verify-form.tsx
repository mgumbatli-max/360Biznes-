"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { verifyPinOrCode } from "../unified-verify";

export function UnifiedVerifyForm({ initialAttempts = 0, limit = 5 }: { initialAttempts?: number; limit?: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await verifyPinOrCode(fd);
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success("Daxil olundu");
        router.push("/sahibkar");
        router.refresh();
      }
    });
  }

  const remainingAttempts = Math.max(0, limit - initialAttempts);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-180px)] max-w-md flex-col items-center justify-center px-4">
      <Card className="glass w-full">
        <CardContent className="space-y-5 py-8">
          <div className="text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "var(--brand-gradient)" }}>
              <Lock className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Sahibkar bölməsi</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              PIN <span className="font-semibold text-foreground">və ya</span> axtarış kodunuzu daxil edin
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            {initialAttempts > 0 && initialAttempts < limit && !error && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
                {initialAttempts}/{limit} yanlış cəhd. {remainingAttempts} cəhd qaldı.
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="kod" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  PIN / Kod
                </label>
                <button
                  type="button"
                  onClick={() => setReveal(!reveal)}
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  {reveal ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {reveal ? "Gizlət" : "Göstər"}
                </button>
              </div>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="kod"
                  name="kod"
                  type={reveal ? "text" : "password"}
                  inputMode="numeric"
                  pattern="\d{3,12}"
                  minLength={3}
                  maxLength={12}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  value={value}
                  onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
                  disabled={pending}
                  className="h-12 w-full rounded-md border border-input bg-background pl-10 pr-3 text-center font-mono text-lg tracking-[0.5em]"
                  placeholder="••••"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full font-semibold text-white"
              style={{ background: "var(--brand-gradient)" }}
              disabled={pending || value.length < 3}
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Daxil ol
            </Button>

            <div className="rounded-md border border-border/40 bg-secondary/30 px-3 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
              <strong className="text-foreground">İpucu:</strong> 4-8 rəqəm PIN, 3-12 rəqəm gizli kod kimi qəbul edilir.
              Sistem avtomatik fərqləndirir.
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
