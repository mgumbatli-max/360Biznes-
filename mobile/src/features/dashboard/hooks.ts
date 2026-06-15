import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { DashboardHome } from "./types";

/** Əsas ekran — web /dashboard mobil görünüşünün bütün bölmə datası (1 sorğu). */
export function useDashboardHome() {
  return useQuery({
    queryKey: ["dashboard-home"],
    queryFn: async () => (await api.get<DashboardHome>("/dashboard/home")).data,
    staleTime: 45_000,
  });
}
