import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { MarketplaceResponse } from "./types";

export function useMarketplace() {
  return useQuery({
    queryKey: ["marketplace"],
    queryFn: async () => (await api.get<MarketplaceResponse>("/marketplace")).data,
  });
}
