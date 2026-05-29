import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { getEmailSettings } from "@/features/email/actions";
import { EmailConfigForm } from "@/features/email/components/email-config-form";

export const metadata: Metadata = { title: "Email bildirişləri" };
export const dynamic = "force-dynamic";

export default async function EmailPage() {
  const settings = await getEmailSettings();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Mail className="h-5 w-5 text-primary-light" />
          Email bildirişləri
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Marketplace sifariş, günlük xülasə və digər hadisələrdə email ünvanınıza bildiriş.
          Resend ya SendGrid env-də konfiqurasiya olunmalıdır.
        </p>
      </header>

      <EmailConfigForm initial={settings} />
    </div>
  );
}
