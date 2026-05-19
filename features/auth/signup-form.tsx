"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signupAction, type SignupActionResult } from "./signup-action";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="w-full font-semibold text-white"
      style={{ background: "var(--brand-gradient)" }}
      disabled={pending}
    >
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Pulsuz başla
    </Button>
  );
}

export function SignupForm() {
  const [state, formAction] = useActionState<SignupActionResult | null, FormData>(signupAction, null);

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="sirket_adi">Şirkət adı *</Label>
        <Input id="sirket_adi" name="sirket_adi" required maxLength={150} placeholder="ABC MMC" />
        <FieldError state={state} field="sirket_adi" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" name="email" type="email" required maxLength={150} placeholder="ad@sirket.az" />
          <FieldError state={state} field="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefon">Telefon *</Label>
          <Input id="telefon" name="telefon" type="tel" required maxLength={30} placeholder="+994 50 123 45 67" />
          <FieldError state={state} field="telefon" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sifre">Şifrə *</Label>
          <Input id="sifre" name="sifre" type="password" required minLength={6} maxLength={100} />
          <FieldError state={state} field="sifre" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sifre_tekrar">Şifrə təkrar *</Label>
          <Input id="sifre_tekrar" name="sifre_tekrar" type="password" required minLength={6} maxLength={100} />
          <FieldError state={state} field="sifre_tekrar" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="biznes_novu">Biznes növü</Label>
          <Input id="biznes_novu" name="biznes_novu" placeholder="Elektronika, geyim, və s." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="seher">Şəhər</Label>
          <Input id="seher" name="seher" placeholder="Bakı" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="magaza_sayi">Mağaza sayı</Label>
          <Input id="magaza_sayi" name="magaza_sayi" placeholder="1, 2-5, 6-10..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="isci_sayi">İşçi sayı</Label>
          <Input id="isci_sayi" name="isci_sayi" placeholder="1-5, 6-20..." />
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="razilashma"
          required
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <span>
          <Link href="/terms" className="text-primary-light hover:underline">İstifadə şərtlərini</Link>{" "}
          oxudum və qəbul edirəm.
        </span>
      </label>
      <FieldError state={state} field="razilashma" />

      <SubmitButton />
    </form>
  );
}

function FieldError({
  state,
  field,
}: {
  state: SignupActionResult | null;
  field: string;
}) {
  if (!state || state.ok) return null;
  const msg = state.fieldErrors?.[field]?.[0];
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}
