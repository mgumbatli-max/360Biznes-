import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { EmekdasPage, EmekdasDetailResponse } from "./types";

export function useEmekdasList(q: string) {
  return useQuery({
    queryKey: ["emekdaslar", q],
    queryFn: async () => (await api.get<EmekdasPage>("/emekdaslar", { params: { q } })).data,
  });
}

export function useEmekdas(id: string) {
  return useQuery({
    queryKey: ["emekdas", id],
    queryFn: async () => (await api.get<EmekdasDetailResponse>(`/emekdaslar/${id}`)).data,
    enabled: !!id,
  });
}
