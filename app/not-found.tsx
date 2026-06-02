import Link from "next/link";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";

/**
 * Global 404 səhifəsi — qeyri-mövcud route-larda göstərilir.
 * Bütün dashboard və POS sub-route-ları öz layout-larında render olunur.
 */
export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="mx-auto max-w-md space-y-5 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-lg shadow-violet-500/20">
          <FileQuestion className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-6xl font-black tracking-tight text-foreground">404</h1>
          <h2 className="text-xl font-bold tracking-tight">Səhifə tapılmadı</h2>
          <p className="text-sm text-muted-foreground">
            Axtardığınız səhifə mövcud deyil və ya yeri dəyişdirilib.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md transition"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Home className="h-4 w-4" />
            Ana səhifə
          </Link>
          <Link
            href="/komekci"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Köməkçi
          </Link>
        </div>
      </div>
    </div>
  );
}
