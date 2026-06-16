"use client";

import { createContext, useContext, useMemo } from "react";

type PermissionsCtx = {
  /** İstifadəçinin icazə kodları (qeyri-privileged rollar üçün filtrə əsas). */
  codes: string[];
  /** Sahibkar/admin/owner — tam-giriş, icazə kataloqundan asılı deyil. */
  privileged: boolean;
};

const PermissionsContext = createContext<PermissionsCtx>({ codes: [], privileged: false });

export function PermissionsProvider({
  icazeler,
  privileged = false,
  children,
}: {
  icazeler: string[];
  /** Sahibkar/admin/owner-dirsə true — bütün client gate-lər keçir (server ilə eyni). */
  privileged?: boolean;
  children: React.ReactNode;
}) {
  // Stabil reference — yalnız icazələr siyahısı və ya privileged dəyişəndə yenilənir.
  // Bu olmadan hər layout re-render-də Sidebar daxili usePermissions consumer-ləri
  // re-render olur (NAV_SECTIONS filter təkrar hesablanır).
  const codesKey = icazeler.join(",");
  const stable = useMemo<PermissionsCtx>(
    () => ({ codes: icazeler, privileged }),
    // codesKey dəyər-stabilliyi üçün (server hər render-də yeni massiv qaytarır)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [codesKey, privileged],
  );
  return <PermissionsContext.Provider value={stable}>{children}</PermissionsContext.Provider>;
}

/** Read the current user's permission codes inside a Client Component. */
export function usePermissions(): string[] {
  return useContext(PermissionsContext).codes;
}

/**
 * Cari istifadəçi sahibkar/admin/owner-dirmi (tam-giriş).
 * Raw `usePermissions().includes(...)` yoxlamalarında owner bypass üçün istifadə et.
 */
export function useIsPrivileged(): boolean {
  return useContext(PermissionsContext).privileged;
}

/**
 * Check whether the current user has at least one of the given codes.
 * Sahibkar/admin/owner həmişə `true` qaytarır — icazə kataloqundan asılı deyil
 * (server guard-ları ilə eyni davranış; owner kataloq boşluğu üzündən kilidlənmir).
 */
export function useHasPermission(...codes: string[]): boolean {
  const { codes: icazeler, privileged } = useContext(PermissionsContext);
  if (privileged) return true;
  if (codes.length === 0) return true;
  return codes.some((c) => icazeler.includes(c));
}
