"use client";

import { useEffect, useState } from "react";
import { Bike, User as UserIcon, X } from "lucide-react";

type Props = {
  user: {
    ad_soyad?: string;
    sahibkar_ad?: string;
  };
};

/**
 * Header for the standalone /market-pos window. Mirrors the POS header
 * (dark slate-900 strip, salesperson chip on the right, rose × Bağla button).
 *
 * Unlike PosHeader we do NOT pull from the POS salesperson Zustand store —
 * the marketplace flow uses the signed-in user directly (no switching).
 */
export function MarketPosHeader({ user }: Props) {
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    function tick() {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      setNow(`${hh}:${mm}`);
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  function handleClose() {
    try {
      window.close();
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      if (!window.closed) {
        window.location.href = "/dashboard";
      }
    }, 100);
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-slate-900 px-4 text-white">
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-sky-500 text-white shadow-sm">
          <Bike className="h-4 w-4" />
        </div>
        <div className="text-sm font-semibold tracking-tight text-white">
          Marketdən satış
          {user.sahibkar_ad && (
            <span className="ml-2 text-[11px] font-normal text-slate-300">
              · {user.sahibkar_ad}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {now && (
          <span className="hidden text-[11px] text-slate-300 md:inline">
            {now}
          </span>
        )}

        {user.ad_soyad && (
          <div className="inline-flex h-8 max-w-[180px] items-center gap-1.5 rounded-md bg-slate-800/60 px-3 text-xs font-medium text-slate-200">
            <UserIcon className="h-3.5 w-3.5 text-slate-300" />
            <span className="truncate">{user.ad_soyad}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleClose}
          aria-label="Pəncərəni bağla"
          title="Pəncərəni bağla"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-rose-100 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
        >
          <X className="h-3.5 w-3.5" />
          Bağla
        </button>
      </div>
    </header>
  );
}
