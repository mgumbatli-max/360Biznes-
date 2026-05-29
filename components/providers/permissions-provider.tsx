"use client";

import { createContext, useContext, useMemo } from "react";

const PermissionsContext = createContext<string[]>([]);

export function PermissionsProvider({
  icazeler,
  children,
}: {
  icazeler: string[];
  children: React.ReactNode;
}) {
  // Stabil reference — yalnız icazələr siyahısı dəyişəndə context yenilənir.
  // Bu olmadan hər layout re-render-də Sidebar daxili usePermissions consumer-ləri
  // re-render olur (NAV_SECTIONS filter təkrar hesablanır).
  const stable = useMemo(() => icazeler, [icazeler.join(",")]);
  return <PermissionsContext.Provider value={stable}>{children}</PermissionsContext.Provider>;
}

/** Read the current user's permission codes inside a Client Component. */
export function usePermissions(): string[] {
  return useContext(PermissionsContext);
}

/** Check whether the current user has at least one of the given codes. */
export function useHasPermission(...codes: string[]): boolean {
  const icazeler = usePermissions();
  if (codes.length === 0) return true;
  return codes.some((c) => icazeler.includes(c));
}
