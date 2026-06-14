import { useInfiniteQuery, useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type {
  TasksPage,
  TaskDetailResponse,
  AssignUser,
  CreateTaskBody,
  TaskStatus,
} from "./types";

// ─── Tapşırıq siyahısı (scope + status filtri) ───────────────────────────────
export function useTasks(scope: string, status: string, q: string) {
  return useInfiniteQuery({
    queryKey: ["tapshiriqlar", scope, status, q],
    queryFn: async ({ pageParam }: { pageParam: number }) =>
      (
        await api.get<TasksPage>("/tapshiriqlar", {
          params: { scope, status: status || undefined, q, page: pageParam },
        })
      ).data,
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      pages.flatMap((p) => p.items).length < last.total ? pages.length + 1 : undefined,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["tapshiriq", id],
    queryFn: async () => (await api.get<TaskDetailResponse>(`/tapshiriqlar/${id}`)).data,
    enabled: !!id,
  });
}

export function useAssignableUsers() {
  return useQuery({
    queryKey: ["tapshiriq-users"],
    queryFn: async () =>
      (await api.get<{ users: AssignUser[] }>("/tapshiriqlar/users")).data.users,
    staleTime: 5 * 60_000,
  });
}

export function useCreateTask() {
  return useMutation({
    mutationFn: async (b: CreateTaskBody) => (await api.post("/tapshiriqlar", b)).data,
  });
}

export function useChangeTaskStatus() {
  return useMutation({
    mutationFn: async (v: { id: string; status: TaskStatus }) =>
      (await api.patch(`/tapshiriqlar/${v.id}`, { status: v.status })).data,
  });
}
