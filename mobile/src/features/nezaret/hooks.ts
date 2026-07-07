import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { NezaretPage } from "./types";

export function useNezaret(seviyye: string, q: string) {
  return useQuery({
    queryKey: ["nezaret", seviyye, q],
    queryFn: async () => (await api.get<NezaretPage>("/nezaret", { params: { seviyye, q } })).data,
  });
}
