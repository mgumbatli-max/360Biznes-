import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { PosContext, PosLookupResponse, CreateSaleBody, CreateSaleResult } from "./types";

// ─── POS konteksti (açıq kassa + anbarlar + şirkət) ──────────────────────────
export function usePosContext() {
  return useQuery({
    queryKey: ["pos-context"],
    queryFn: async () => (await api.get<PosContext>("/pos/context")).data,
    staleTime: 15_000,
  });
}

// ─── Manual axtarış (ad/kod) — seçilmiş anbarın stoku ilə ────────────────────
export function usePosSearch(q: string, anbarId: number | null) {
  return useQuery({
    queryKey: ["pos-search", q, anbarId],
    queryFn: async () =>
      (await api.get<PosLookupResponse>("/pos/lookup", { params: { q, anbar_id: anbarId } })).data,
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });
}

// ─── Barkod skanı (imperativ) ────────────────────────────────────────────────
export function useScanLookup() {
  return useMutation({
    mutationFn: async ({ code, anbarId }: { code: string; anbarId: number | null }) =>
      (await api.get<PosLookupResponse>("/pos/lookup", {
        params: { q: code, anbar_id: anbarId, scan: 1 },
      })).data,
  });
}

// ─── Satış yarat (POS) ───────────────────────────────────────────────────────
export function useCreateSale() {
  return useMutation({
    mutationFn: async (body: CreateSaleBody) =>
      (await api.post<CreateSaleResult>("/satislar", body)).data,
  });
}

// ─── Kassa aç ────────────────────────────────────────────────────────────────
export function useOpenKassa() {
  return useMutation({
    mutationFn: async (body: { ad?: string; acilis_qaligi?: number }) =>
      (await api.post<{ ok: boolean; data?: { id: string }; error?: string }>("/pos/session", body)).data,
  });
}
