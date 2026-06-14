import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { ChannelsResponse, MessagesResponse } from "./types";

// ─── Kanal siyahısı (8 saniyədə bir təzələnir — yarı-canlı) ──────────────────
export function useChannels() {
  return useQuery({
    queryKey: ["team-channels"],
    queryFn: async () => (await api.get<ChannelsResponse>("/team")).data,
    refetchInterval: 8000,
  });
}

// ─── Kanal mesajları (4 saniyədə bir — WhatsApp kimi yarı-canlı) ─────────────
export function useChannelMessages(id: string) {
  return useQuery({
    queryKey: ["team-messages", id],
    queryFn: async () => (await api.get<MessagesResponse>(`/team/${id}`)).data,
    enabled: !!id,
    refetchInterval: 4000,
  });
}

export function useSendMessage(id: string) {
  return useMutation({
    mutationFn: async (mesaj: string) =>
      (await api.post(`/team/${id}`, { mesaj })).data,
  });
}

export type TeamUser = { id: string; ad_soyad: string; vezife: string | null };

export function useTeamUsers() {
  return useQuery({
    queryKey: ["team-users"],
    queryFn: async () => (await api.get<{ users: TeamUser[] }>("/team/users")).data.users,
    staleTime: 5 * 60_000,
  });
}

export function useCreateDM() {
  return useMutation({
    mutationFn: async (userId: string) =>
      (await api.post<{ ok?: boolean; id?: number; error?: string }>("/team", { userId })).data,
  });
}
