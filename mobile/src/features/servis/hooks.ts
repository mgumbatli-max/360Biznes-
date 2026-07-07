import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { ServisPage, ServisDetailResponse } from "./types";

// ─── Servis siyahısı (status filtri + axtarış) ───────────────────────────────
export function useServisList(status: string, q: string) {
  return useQuery({
    queryKey: ["servis", status, q],
    queryFn: async () =>
      (await api.get<ServisPage>("/servis", { params: { status, q } })).data,
  });
}

// ─── Servis detalı ───────────────────────────────────────────────────────────
export function useServis(id: string) {
  return useQuery({
    queryKey: ["servis-detay", id],
    queryFn: async () =>
      (await api.get<ServisDetailResponse>(`/servis/${id}`)).data,
    enabled: !!id,
  });
}
