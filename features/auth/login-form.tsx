"use client";

import { use, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = {
  searchParamsPromise: Promise<{ callbackUrl?: string; error?: string }>;
};

export function LoginForm({ searchParamsPromise }: Props) {
  const searchParams = use(searchParamsPromise);
  const callbackUrl = searchParams.callbackUrl ?? "/dashboard";
  const initialError = searchParams.error ? translateAuthError(searchParams.error) : null;

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialError);
  const [showPassword, setShowPassword] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    startTransition(async () => {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Email və ya şifrə yanlışdır. Yenidən cəhd edin.");
        return;
      }
      router.push(callbackUrl);
    });
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="ad@sirket.az"
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Şifrə</Label>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((s) => !s)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPassword ? "Gizlət" : "Göstər"}
          </button>
        </div>
        <Input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          minLength={6}
          placeholder="••••••••"
          disabled={pending}
        />
      </div>

      <Button
        type="submit"
        className="w-full font-semibold text-white"
        style={{ background: "var(--brand-gradient)" }}
        disabled={pending}
      >
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Daxil ol
      </Button>
    </form>
  );
}

function translateAuthError(code: string): string {
  switch (code) {
    case "CredentialsSignin":
      return "Email və ya şifrə yanlışdır.";
    case "OAuthAccountNotLinked":
      return "Bu email başqa metoda ilə qeydiyyatdan keçib.";
    case "AccessDenied":
      return "Girişə icazə yoxdur. Abunə bitmiş ola bilər.";
    default:
      return "Giriş zamanı xəta baş verdi.";
  }
}
