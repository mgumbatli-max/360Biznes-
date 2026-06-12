import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import Constants from "expo-constants";
import { useAuth } from "./auth-store";

const BASE =
  (Constants.expoConfig?.extra?.apiBase as string) || "http://localhost:3500";

export const api = axios.create({
  baseURL: BASE + "/api/mobile/v1",
  timeout: 20000,
});

api.interceptors.request.use((cfg) => {
  const a = useAuth.getState().access;
  if (a) cfg.headers.Authorization = "Bearer " + a;
  return cfg;
});

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const { refresh, setAccess, clear } = useAuth.getState();
  if (!refresh) {
    await clear();
    return null;
  }
  try {
    const r = await axios.post(BASE + "/api/mobile/v1/auth/refresh", {
      refreshToken: refresh,
    });
    await setAccess(r.data.accessToken as string);
    if (r.data.refreshToken) {
      await useAuth
        .getState()
        .setSession(
          r.data.accessToken as string,
          r.data.refreshToken as string,
          useAuth.getState().user
        );
    }
    return r.data.accessToken as string;
  } catch {
    await clear();
    return null;
  }
}

api.interceptors.response.use(undefined, async (err: AxiosError) => {
  const cfg = err.config as
    | (InternalAxiosRequestConfig & { _retry?: boolean })
    | undefined;
  if (err.response?.status === 401 && cfg && !cfg._retry) {
    cfg._retry = true;
    refreshing = refreshing || doRefresh();
    const newA = await refreshing;
    refreshing = null;
    if (newA) {
      cfg.headers.Authorization = "Bearer " + newA;
      return api(cfg);
    }
  }
  return Promise.reject(err);
});
