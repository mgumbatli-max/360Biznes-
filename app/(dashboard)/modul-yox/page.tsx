import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Home, Mail } from "lucide-react";

export const metadata: Metadata = { title: "Modul aktiv deyil" };

/**
 * PER-TENANT MODUL ENTITLEMENT — bağlı/müddəti bitmiş modula girişdə göstərilir
 * (`app/(dashboard)/layout.tsx` enforcement bura redirect edir).
 */
export default function ModuleDisabledPage() {
  return (
    <div className="mx-auto max-w-md py-12">
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-card to-emerald-500/5 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="text-lg font-bold">Modul aktiv deyil</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bu modul şirkətiniz üçün aktiv deyil — sahibkarınızla əlaqə saxlayın.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Home className="h-4 w-4" />
            Ana səhifə
          </Link>
          <Link
            href="/komekci"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:bg-secondary"
          >
            <Mail className="h-4 w-4" />
            Sahibkarla əlaqə
          </Link>
        </div>

        <p className="mt-4 text-[10.5px] text-muted-foreground">
          Modulu aktivləşdirmək (və ya demo müddətini uzatmaq) üçün sahibkar / admin ilə əlaqə saxlayın.
        </p>
      </div>
    </div>
  );
}
