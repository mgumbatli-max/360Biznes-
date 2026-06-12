import { useInfiniteQuery, useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type {
  ProductsPage,
  ProductDetailResponse,
  SaveProductBody,
  ReferencesResponse,
} from "./types";

// ─── Sonsuz siyahı (infinite scroll) ─────────────────────────────────────────
export function useProducts(q: string) {
  return useInfiniteQuery({
    queryKey: ["mehsullar", q],
    queryFn: async ({ pageParam }: { pageParam: number }) =>
      (
        await api.get<ProductsPage>("/mehsullar", {
          params: { q, page: pageParam },
        })
      ).data,
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      pages.flatMap((p) => p.items).length < last.total
        ? pages.length + 1
        : undefined,
  });
}

// ─── Tək məhsul detalları ────────────────────────────────────────────────────
export function useProduct(id: string) {
  return useQuery({
    queryKey: ["mehsul", id],
    queryFn: async () =>
      (await api.get<ProductDetailResponse>(`/mehsullar/${id}`)).data,
    enabled: !!id,
  });
}

// ─── Yaratma / yeniləmə mutasiyası ───────────────────────────────────────────
export function useSaveProduct() {
  return useMutation({
    mutationFn: async (b: SaveProductBody) =>
      b.id
        ? (await api.put(`/mehsullar/${b.id}`, b)).data
        : (await api.post("/mehsullar", b)).data,
  });
}

// ─── Kateqoriya / Marka / Vahid referansları ──────────────────────────────────
export function useReferences() {
  return useQuery({
    queryKey: ["referanslar"],
    queryFn: async () =>
      (await api.get<ReferencesResponse>("/referanslar")).data,
    staleTime: 5 * 60_000,
  });
}

// ─── Barkod axtarışı ─────────────────────────────────────────────────────────
export function useBarcodeLookup() {
  return useMutation({
    mutationFn: async (code: string) =>
      (await api.get(`/mehsullar/barkod/${encodeURIComponent(code)}`)).data,
  });
}

// ─── Şəkil yükləmə (React Native FormData) ───────────────────────────────────
export async function uploadImage(uri: string): Promise<string> {
  const form = new FormData();
  const name = uri.split("/").pop() || "photo.jpg";
  // RN FormData fayl descriptor obyektini qəbul edir; TS DOM FormData tipləməsi
  // buna razılaşmır — buna görə məcburi cast.
  form.append("file", { uri, name, type: "image/jpeg" } as unknown as Blob);
  const r = await api.post<{ url: string }>("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data.url;
}
