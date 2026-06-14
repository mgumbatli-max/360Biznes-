import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

export type OzetSales = {
  bugun: { count: number; mebleg: number };
  bu_hefte: { count: number; mebleg: number };
  bu_ay: { count: number; mebleg: number };
  borc_mebleg: number;
};

export type OzetProducts = {
  toplam_aktiv: number;
  stoksuz: number;
  kritik: number;
  az_qalib: number;
  qiymetsiz: number;
  sekilsiz: number;
  [key: string]: number;
};

export type OzetResponse = {
  sales: OzetSales | null;
  products: OzetProducts | null;
};

export function useOzet() {
  return useQuery({
    queryKey: ["ozet"],
    queryFn: async () => (await api.get<OzetResponse>("/ozet")).data,
    staleTime: 60_000,
  });
}
