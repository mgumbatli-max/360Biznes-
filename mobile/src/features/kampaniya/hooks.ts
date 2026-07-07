import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { KampaniyaPage } from "./types";

export function useKampaniyalar(status: string) {
  return useQuery({
    queryKey: ["kampaniya", status],
    queryFn: async () => (await api.get<KampaniyaPage>("/kampaniya", { params: { status } })).data,
  });
}
