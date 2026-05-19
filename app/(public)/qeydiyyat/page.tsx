import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/features/auth/signup-form";

export const metadata: Metadata = { title: "Qeydiyyat" };

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-xl flex-col items-center justify-center px-6 py-12">
      <div className="glass w-full rounded-2xl p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Pulsuz başla</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            15 günlük tam funksiyalı demo. Kart məlumatı tələb edilmir.
          </p>
        </div>

        <SignupForm />

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Hesabınız var?{" "}
          <Link href="/login" className="font-medium text-primary-light hover:underline">
            Daxil ol
          </Link>
        </div>
      </div>
    </div>
  );
}
