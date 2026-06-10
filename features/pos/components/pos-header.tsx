"use client";

import { useEffect, useRef, useState } from "react";
import { ScanLine, User as UserIcon, X, Zap } from "lucide-react";
import { usePosSalesperson } from "@/stores/pos-salesperson";
import { useAppMode } from "@/stores/app-mode";

type Props = {
  user: {
    ad_soyad: string;
    sahibkar_ad: string;
  };
  sessionInfo?: {
    acilisQaligi: number;
    acilisTarixi: string;
  };
};

export function PosHeader({ user, sessionInfo }: Props) {
  const [now, setNow] = useState<string>("");
  const [salesPopover, setSalesPopover] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  // Salesperson chip is fed by <PosClient /> via the shared Zustand store.
  const saticilar = usePosSalesperson((s) => s.saticilar);
  const salespersonId = usePosSalesperson((s) => s.salespersonId);
  const canSwitch = usePosSalesperson((s) => s.canSwitch);
  const setSalespersonId = usePosSalesperson((s) => s.setSalespersonId);

  // Qlobal Lite/Pro rejimi — mount-da cookie-dən oxunur (sayt ilə eyni).
  const posMode = useAppMode((s) => s.mode);
  const setPosMode = useAppMode((s) => s.setMode);
  const hydratePosMode = useAppMode((s) => s.hydrate);
  useEffect(() => {
    hydratePosMode();
  }, [hydratePosMode]);

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

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target as Node)) setSalesPopover(false);
    }
    if (salesPopover) {
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }
  }, [salesPopover]);

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

  // Compute the current salesperson display name (falls back to the signed-in user).
  const currentSalesperson =
    saticilar.length > 0 && salespersonId
      ? saticilar.find((s) => s.id === salespersonId)?.ad_soyad ?? user.ad_soyad
      : user.ad_soyad;

  void now;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-slate-900 px-4 text-white">
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-rose-500 text-white shadow-sm">
          <ScanLine className="h-4 w-4" />
        </div>
        <div className="text-sm font-semibold tracking-tight text-white">
          POS — İsti satış
        </div>
      </div>

      <div className="flex items-center gap-2">
        {sessionInfo && (
          <span className="hidden text-[11px] text-slate-300 md:inline">
            Sessiya açıq · Açılış {sessionInfo.acilisQaligi}₼
          </span>
        )}

        {/* Lite / Pro rejim keçidi — Lite mobil-doğma sadə satış, Pro tam funksiya */}
        <div
          className="inline-flex h-8 items-center rounded-md bg-slate-800 p-0.5 text-[11px] font-semibold"
          role="group"
          aria-label="POS rejimi"
        >
          <button
            type="button"
            onClick={() => setPosMode("lite")}
            className={`inline-flex h-7 items-center gap-1 rounded px-2.5 transition ${
              posMode === "lite"
                ? "bg-rose-500 text-white shadow-sm"
                : "text-slate-300 hover:text-white"
            }`}
            title="Lite — sadə, sürətli satış (telefon üçün)"
            aria-pressed={posMode === "lite"}
          >
            Lite
          </button>
          <button
            type="button"
            onClick={() => setPosMode("pro")}
            className={`inline-flex h-7 items-center gap-1 rounded px-2.5 transition ${
              posMode === "pro"
                ? "bg-rose-500 text-white shadow-sm"
                : "text-slate-300 hover:text-white"
            }`}
            title="Pro — bütün funksiyalar (endirim, kupon, kreditlə, taksit…)"
            aria-pressed={posMode === "pro"}
          >
            <Zap className="h-3 w-3" />
            Pro
          </button>
        </div>

        {/* Salesperson chip (sourced from PosClient via shared store) */}
        {saticilar.length > 0 && (
          <div className="relative" ref={popRef}>
            <button
              type="button"
              onClick={() => {
                if (canSwitch) setSalesPopover((s) => !s);
              }}
              className="inline-flex h-8 max-w-[180px] items-center gap-1.5 rounded-md bg-slate-800/60 px-3 text-xs font-medium text-slate-200 transition hover:bg-slate-700/70"
              title={canSwitch ? "Satıcı dəyiş" : `Satıcı: ${currentSalesperson}`}
              aria-haspopup={canSwitch ? "true" : undefined}
            >
              <UserIcon className="h-3.5 w-3.5 text-slate-300" />
              <span className="truncate">{currentSalesperson}</span>
            </button>
            {salesPopover && canSwitch && (
              <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border border-slate-700 bg-slate-900 p-2 text-xs shadow-2xl">
                <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Satıcı dəyiş
                </div>
                <select
                  value={salespersonId ?? ""}
                  onChange={(e) => {
                    setSalespersonId(e.target.value);
                    setSalesPopover(false);
                  }}
                  className="h-8 w-full rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                >
                  {saticilar.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.ad_soyad}
                    </option>
                  ))}
                </select>
                <div className="mt-1.5 px-1 text-[10px] text-slate-500">
                  Aktiv satış bu satıcının adına yazılır.
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("pos:open-close-session"))
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-800 px-3 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
          title="Sessiyanı bağla"
        >
          Sessiya
        </button>
        <button
          type="button"
          onClick={handleClose}
          aria-label="POS-u bağla"
          title="POS-u bağla"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-rose-100 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
        >
          <X className="h-3.5 w-3.5" />
          Bağla
        </button>
      </div>
    </header>
  );
}
