import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { AiHistoryResponse, AiSendResponse } from "./types";

// ─── Söhbət tarixçəsi + rejim bayraqları ────────────────────────────────────
export function useAiHistory() {
  return useQuery({
    queryKey: ["ai-history"],
    queryFn: async () => (await api.get<AiHistoryResponse>("/ai")).data,
    staleTime: 30_000,
  });
}

// ─── AI-ya mesaj göndər ──────────────────────────────────────────────────────
export function useAiSend() {
  return useMutation({
    mutationFn: async (message: string) =>
      (await api.post<AiSendResponse>("/ai", { message })).data,
  });
}

// ─── Tarixçəni təmizlə ───────────────────────────────────────────────────────
export function useAiClear() {
  return useMutation({
    mutationFn: async () =>
      (await api.delete<{ ok: boolean; silinen: number }>("/ai")).data,
  });
}
