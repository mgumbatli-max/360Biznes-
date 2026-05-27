"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="az">
      <body className="min-h-screen bg-slate-50">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-rose-100 text-rose-700">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Gözlənilməz xəta</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sistemdə bir nasazlıq baş verdi. Əməliyyatınız tamamlanmadı.
          </p>
          {error.digest && (
            <p className="mt-2 text-[11px] text-slate-400">Xəta kodu: {error.digest}</p>
          )}
          <div className="mt-6 flex gap-2">
            <button
              onClick={reset}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Yenidən cəhd et
            </button>
            <a
              href="/"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Ana səhifə
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
