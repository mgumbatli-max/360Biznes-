import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { AppConfigResponse, LiteConfig } from "./types";

/** Tenant-ın Lite config-i (web /ayarlar/gorunis-də qurulur). */
export function useAppConfig() {
  return useQuery({
    queryKey: ["app-config"],
    queryFn: async () => (await api.get<AppConfigResponse>("/app-config")).data,
    staleTime: 5 * 60_000,
  });
}

export type { LiteConfig };
