import { useInfiniteQuery, useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type {
  CustomersPage,
  CustomerDetailResponse,
  SaveCustomerBody,
} from "./types";

// ─── Sonsuz siyahı (infinite scroll) ─────────────────────────────────────────
export function useCustomers(q: string) {
  return useInfiniteQuery({
    queryKey: ["musteriler", q],
    queryFn: async ({ pageParam }: { pageParam: number }) =>
      (
        await api.get<CustomersPage>("/musteriler", {
          params: { q, page: pageParam },
        })
      ).data,
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      pages.flatMap((p) => p.items).length < last.total
        ? pages.length + 1
        : undefined,
  });
}

// ─── Tək müştəri detalları ───────────────────────────────────────────────────
export function useCustomer(id: string) {
  return useQuery({
    queryKey: ["musteri", id],
    queryFn: async () =>
      (await api.get<CustomerDetailResponse>(`/musteriler/${id}`)).data,
    enabled: !!id,
  });
}

// ─── Yaratma mutasiyası ──────────────────────────────────────────────────────
export function useCreateCustomer() {
  return useMutation({
    mutationFn: async (b: SaveCustomerBody) =>
      (await api.post("/musteriler", b)).data,
  });
}
