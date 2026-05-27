"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";

export default function PosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[pos-error]", error);
  }, [error]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-rose-100 text-rose-700">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-center text-lg font-bold text-slate-900">POS xətası</h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Kassa əməliyyatı tamamlana bilmədi. Yenidən cəhd edin.
        </p>
        {process.env.NODE_ENV !== "production" && (
          <pre className="mt-3 overflow-x-auto rounded-md bg-rose-50 p-2 text-[11px] text-rose-900">
            {error.message}
          </pre>
        )}
        {error.digest && (
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Xəta kodu: {error.digest}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={reset}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Yenidən cəhd
          </button>
          <a
            href="/"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            Çıxış
          </a>
        </div>
      </div>
    </div>
  );
}
