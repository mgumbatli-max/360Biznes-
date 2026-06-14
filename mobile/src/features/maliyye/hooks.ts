import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export type FinanceKpis = {
  bugun_gelir: number;
  bugun_xerc: number;
  bugun_net: number;
  ay_gelir: number;
  ay_xerc: number;
  ay_menfeet: number;
  ay_ebitda: number;
  debitor_cem: number;
  kreditor_cem: number;
  gozleyen_odenis: number;
  hesab_balans: number;
};

export type TopRow = { ad: string; mebleg: number };

export type FinanceResponse = {
  kpis: FinanceKpis | null;
  debtors: TopRow[];
  creditors: TopRow[];
};

export function useFinance() {
  return useQuery({
    queryKey: ["maliyye"],
    queryFn: async () => (await api.get<FinanceResponse>("/maliyye")).data,
    staleTime: 60_000,
  });
}
