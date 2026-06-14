import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { QA_DEFAULT } from "./catalog";

const KEY = "quick_actions_v1";

type S = {
  keys: string[];
  ready: boolean;
  load: () => Promise<void>;
  toggle: (k: string) => Promise<void>;
  reset: () => Promise<void>;
};

/** İstifadəçinin home-da seçdiyi sürətli əməliyyatlar (cihaz-lokal, SecureStore). */
export const useQuickActions = create<S>((set, get) => ({
  keys: QA_DEFAULT,
  ready: false,
  load: async () => {
    try {
      const v = await SecureStore.getItemAsync(KEY);
      if (v) {
        const arr = JSON.parse(v);
        if (Array.isArray(arr)) {
          set({ keys: arr.filter((x) => typeof x === "string"), ready: true });
          return;
        }
      }
    } catch {
      /* ignore */
    }
    set({ ready: true });
  },
  toggle: async (k) => {
    const cur = get().keys;
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
    set({ keys: next });
    try {
      await SecureStore.setItemAsync(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  },
  reset: async () => {
    set({ keys: QA_DEFAULT });
    try {
      await SecureStore.setItemAsync(KEY, JSON.stringify(QA_DEFAULT));
    } catch {
      /* ignore */
    }
  },
}));
