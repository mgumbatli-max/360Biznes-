import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const ACCESS = "mobil_access";
const REFRESH = "mobil_refresh";

export type AuthUser = {
  id: string;
  ad_soyad: string;
  email: string;
  sahibkar_ad?: string;
  rol_ad?: string;
} | null;

type AuthState = {
  access: string | null;
  refresh: string | null;
  user: AuthUser;
  ready: boolean;
  load: () => Promise<void>;
  setSession: (a: string, r: string, u: AuthUser) => Promise<void>;
  setAccess: (a: string) => Promise<void>;
  clear: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  access: null,
  refresh: null,
  user: null,
  ready: false,
  load: async () => {
    const [a, r] = await Promise.all([
      SecureStore.getItemAsync(ACCESS),
      SecureStore.getItemAsync(REFRESH),
    ]);
    set({ access: a, refresh: r, ready: true });
  },
  setSession: async (a, r, u) => {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS, a),
      SecureStore.setItemAsync(REFRESH, r),
    ]);
    set({ access: a, refresh: r, user: u });
  },
  setAccess: async (a) => {
    await SecureStore.setItemAsync(ACCESS, a);
    set({ access: a });
  },
  clear: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS),
      SecureStore.deleteItemAsync(REFRESH),
    ]);
    set({ access: null, refresh: null, user: null });
  },
}));
