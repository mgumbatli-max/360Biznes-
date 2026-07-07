import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { SahibkarResponse } from "./types";

export function useSahibkar() {
  return useQuery({
    queryKey: ["sahibkar-cost"],
    queryFn: async () => (await api.get<SahibkarResponse>("/sahibkar")).data,
  });
}
