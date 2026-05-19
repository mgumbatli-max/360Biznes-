export type ViewMode = "card" | "list" | "table";

/** Server-side helper to read view mode from searchParams */
export function getViewMode(
  searchParams: Record<string, string | string[] | undefined>,
  paramName = "view",
  defaultMode: ViewMode = "card"
): ViewMode {
  const v = searchParams[paramName];
  const value = Array.isArray(v) ? v[0] : v;
  if (value === "card" || value === "list" || value === "table") return value;
  return defaultMode;
}
