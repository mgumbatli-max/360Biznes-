import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

export type AppMode = "lite" | "pro";
const KEY = "app_mode";

type S = {
  mode: AppMode;
  ready: boolean;
  load: () => Promise<void>;
  setMode: (m: AppMode) => Promise<void>;
};

/** Cihaz-lokal Lite/Pro rejimi (SecureStore). Default Lite. */
export const useAppModeStore = create<S>((set) => ({
  mode: "lite",
  ready: false,
  load: async () => {
    const v = await SecureStore.getItemAsync(KEY);
    set({ mode: v === "pro" ? "pro" : "lite", ready: true });
  },
  setMode: async (m) => {
    await SecureStore.setItemAsync(KEY, m);
    set({ mode: m });
  },
}));
