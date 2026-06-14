import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { SalesPage, SaleDetailResponse } from "./types";

// ─── Sonsuz satış siyahısı ───────────────────────────────────────────────────
export function useSales(q: string) {
  return useInfiniteQuery({
    queryKey: ["satislar", q],
    queryFn: async ({ pageParam }: { pageParam: number }) =>
      (await api.get<SalesPage>("/satislar", { params: { q, page: pageParam } }))
        .data,
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      pages.flatMap((p) => p.items).length < last.total
        ? pages.length + 1
        : undefined,
  });
}

// ─── Tək satış detalı ────────────────────────────────────────────────────────
export function useSale(id: string) {
  return useQuery({
    queryKey: ["satis", id],
    queryFn: async () =>
      (await api.get<SaleDetailResponse>(`/satislar/${id}`)).data,
    enabled: !!id,
  });
}
