# Mobil Faza 1B — React Native App (Expo) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Work on branch `mobil-faza1`.

**Goal:** Faza 1A-da qurulan `/api/mobile/v1` API-sini işlədən professional Expo (React Native) app — Splash, Login, Home, və Anbar/Məhsul şaquli dilimi (siyahı/axtarış, detal akkordeon, yarat/redaktə çox-şəkil + barkod), hal ekranları (loading/empty/error/offline), Android emulator + iOS simulatorda işlək; EAS build hazırlığı.

**Architecture:** `mobile/` qovluğu (eyni repoda, Vercel toxunmur). Expo Router (file-based nav), TanStack Query (server state + cache + retry), Axios (Bearer + 401 auto-refresh interceptor), expo-secure-store (token). Dizayn: NativeWind + Emerald-Teal tema + lucide-react-native. API kontraktı: `docs/superpowers/specs/mobil-api-kontrakt.md`.

**Tech Stack:** Expo SDK (latest), TypeScript, expo-router, @tanstack/react-query, axios, expo-secure-store, nativewind + tailwindcss, lucide-react-native, expo-camera, expo-image-picker, expo-image, expo-linking, react-native-safe-area-context, expo-status-bar.

**Verification:** RN-də jest/unit yox. Hər task: `cd mobile && npx tsc --noEmit` (tip) + lazımi yerdə `npx expo-doctor`. Yekun tasklar: **manual run** — `npx expo start`, Android emulator + iOS simulatorda ekranları aç/sürüş (login → məhsul siyahı → detal → yarat → barkod skan → upload), offline halı. Screenshot ilə təsdiq.

**Prerequisite:** Faza 1A backend branch `mobil-faza1`-da hazırdır və dev server lokal `http://localhost:3500`-də işləyir (mobil app simulator-dan bu API-ya çıxır). Real cihaz üçün eyni şəbəkədə host IP işlədilir.

---

## File Structure (`mobile/`)

| Fayl | Məsuliyyət |
|---|---|
| `mobile/app.json` | Expo config: name, slug, bundle id `az.360biznes.app`, icon, splash, icazə mətnləri |
| `mobile/eas.json` | EAS build profilləri (development/preview/production) |
| `mobile/package.json`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `nativewind-env.d.ts` | Layihə konfiqurasiyası |
| `mobile/global.css` | NativeWind Tailwind direktivləri |
| `mobile/src/theme.ts` | Rəng/spacing token-ləri (Emerald-Teal) |
| `mobile/src/lib/api.ts` | Axios instance + Bearer + 401 auto-refresh |
| `mobile/src/lib/auth-store.ts` | Token saxlama (SecureStore) + auth state (Zustand və ya Context) |
| `mobile/src/lib/query.ts` | TanStack QueryClient + provider |
| `mobile/src/components/` | Ui: Button, Input, Card, Screen, EmptyState, ErrorState, LoadingSkeleton, OfflineBanner, Accordion, ImagePickerRow |
| `mobile/src/features/mehsul/` | hooks (useProducts, useProduct, useSaveProduct, useBarcodeLookup, useUpload) |
| `mobile/app/_layout.tsx` | Root layout (providers, auth gate, splash) |
| `mobile/app/(auth)/login.tsx` | Login ekranı |
| `mobile/app/(tabs)/_layout.tsx` | Bottom tabs (Ana·Satış·➕·Bildiriş·Menyu) |
| `mobile/app/(tabs)/index.tsx` | Home (quick actions) |
| `mobile/app/(tabs)/mehsullar/index.tsx` | Məhsul siyahı + axtarış |
| `mobile/app/mehsul/[id].tsx` | Məhsul detal (akkordeon) |
| `mobile/app/mehsul/form.tsx` | Yarat/redaktə form (çox-şəkil, Ətraflı, barkod) |
| `mobile/assets/` | icon.png, splash.png, adaptive-icon.png |

---

## Task 1: Expo layihə scaffold (`mobile/`)

**Files:** Create `mobile/` (Expo app)

- [ ] **Step 1: Expo app yarat** (repo kökündən):
```bash
cd /Users/mr.maqa/Projects/360biznes-next
npx create-expo-app@latest mobile --template blank-typescript --no-install
cd mobile && npm install
```
- [ ] **Step 2: Expo Router + əsas asılılıqlar:**
```bash
cd mobile
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar expo-secure-store expo-image expo-image-picker expo-camera
npm install @tanstack/react-query axios zustand lucide-react-native nativewind tailwindcss@3
```
- [ ] **Step 3: Expo Router-ə keç** — `package.json` `"main": "expo-router/entry"`; `app.json`-da `"scheme": "biznes360"`, `"plugins": ["expo-router"]`. `app/_layout.tsx` yarat (sadə `<Stack />` ilə başla). Köhnə `App.tsx`/`index.ts` sil.
- [ ] **Step 4: Verify** — `cd mobile && npx tsc --noEmit` təmiz; `npx expo-doctor` kritik xəta yox.
- [ ] **Step 5: Commit** — `git add mobile && git commit -m "feat(mobil-rn): Expo scaffold + router + asılılıqlar"`

> Qeyd: `.gitignore`-a `mobile/node_modules`, `mobile/.expo` əlavə et (Expo template adətən əlavə edir — yoxla).

---

## Task 2: NativeWind + tema (Emerald-Teal)

**Files:** `mobile/tailwind.config.js`, `mobile/global.css`, `mobile/babel.config.js`, `mobile/metro.config.js`, `mobile/nativewind-env.d.ts`, `mobile/src/theme.ts`

- [ ] **Step 1: NativeWind quraşdır** (rəsmi addımlar): `babel.config.js`-ə `nativewind/babel` preset; `metro.config.js`-ə `withNativeWind`; `global.css`-ə `@tailwind base/components/utilities`; `nativewind-env.d.ts` → `/// <reference types="nativewind/types" />`.
- [ ] **Step 2: `tailwind.config.js`** — content `["./app/**/*.{ts,tsx}","./src/**/*.{ts,tsx}"]`, tema rəngləri:
```js
theme: { extend: { colors: {
  brand: { DEFAULT: "#0d9488", dark: "#0f766e", light: "#ccfbf1", 50: "#f0fdfa" },
  ink: "#0f172a", sub: "#64748b", line: "#eef0f4",
  pos: "#16a34a", neg: "#dc2626", warn: "#d97706",
}}},
```
- [ ] **Step 3: `src/theme.ts`** — eyni token-lər JS obyekti kimi (chart/ikon rəngləri üçün): `export const C = { brand:"#0d9488", brandDark:"#0f766e", brandLight:"#ccfbf1", ink:"#0f172a", sub:"#64748b", line:"#eef0f4", pos:"#16a34a", neg:"#dc2626", warn:"#d97706", bg:"#f7f8fb" } as const;`
- [ ] **Step 4: `app/_layout.tsx`-ə `import "../global.css";`** əlavə et.
- [ ] **Step 5: Verify** — `npx tsc --noEmit`; sadə bir ekranda `className="bg-brand"` işləyir (Step sonrakı taskda görünəcək).
- [ ] **Step 6: Commit** — `git add mobile && git commit -m "feat(mobil-rn): NativeWind + Emerald-Teal tema"`

---

## Task 3: API client (axios + Bearer + 401 auto-refresh) + auth store

**Files:** `mobile/src/lib/auth-store.ts`, `mobile/src/lib/api.ts`

- [ ] **Step 1: `src/lib/auth-store.ts`** (Zustand + SecureStore):
```ts
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const ACCESS = "mobil_access", REFRESH = "mobil_refresh";
export type AuthUser = { id: string; ad_soyad: string; email: string; sahibkar_ad?: string; rol_ad?: string } | null;

type AuthState = {
  access: string | null; refresh: string | null; user: AuthUser; ready: boolean;
  load: () => Promise<void>;
  setSession: (a: string, r: string, u: AuthUser) => Promise<void>;
  setAccess: (a: string) => Promise<void>;
  clear: () => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
  access: null, refresh: null, user: null, ready: false,
  load: async () => {
    const [a, r] = await Promise.all([SecureStore.getItemAsync(ACCESS), SecureStore.getItemAsync(REFRESH)]);
    set({ access: a, refresh: r, ready: true });
  },
  setSession: async (a, r, u) => {
    await Promise.all([SecureStore.setItemAsync(ACCESS, a), SecureStore.setItemAsync(REFRESH, r)]);
    set({ access: a, refresh: r, user: u });
  },
  setAccess: async (a) => { await SecureStore.setItemAsync(ACCESS, a); set({ access: a }); },
  clear: async () => { await Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH)]); set({ access: null, refresh: null, user: null }); },
}));
```
- [ ] **Step 2: `src/lib/api.ts`** (axios + interceptors). BaseURL `app.json extra` və ya `expo-constants`-dan; default lokal:
```ts
import axios from "axios";
import Constants from "expo-constants";
import { useAuth } from "./auth-store";

const BASE = (Constants.expoConfig?.extra?.apiBase as string) || "http://localhost:3500";
export const api = axios.create({ baseURL: BASE + "/api/mobile/v1", timeout: 20000 });

api.interceptors.request.use((cfg) => {
  const a = useAuth.getState().access;
  if (a) cfg.headers.Authorization = "Bearer " + a;
  return cfg;
});

let refreshing: Promise<string | null> | null = null;
async function doRefresh(): Promise<string | null> {
  const { refresh, setAccess, clear } = useAuth.getState();
  if (!refresh) { await clear(); return null; }
  try {
    const r = await axios.post(BASE + "/api/mobile/v1/auth/refresh", { refreshToken: refresh });
    await setAccess(r.data.accessToken);
    if (r.data.refreshToken) await useAuth.getState().setSession(r.data.accessToken, r.data.refreshToken, useAuth.getState().user);
    return r.data.accessToken as string;
  } catch { await clear(); return null; }
}

api.interceptors.response.use(undefined, async (err) => {
  const cfg = err.config;
  if (err.response?.status === 401 && cfg && !cfg._retry) {
    cfg._retry = true;
    refreshing = refreshing || doRefresh();
    const newA = await refreshing; refreshing = null;
    if (newA) { cfg.headers.Authorization = "Bearer " + newA; return api(cfg); }
  }
  return Promise.reject(err);
});
```
- [ ] **Step 3: `app.json` extra.apiBase** əlavə et (dev üçün host IP və ya localhost): `"extra": { "apiBase": "http://localhost:3500" }`.
- [ ] **Step 4: Verify** — `npx tsc --noEmit` təmiz.
- [ ] **Step 5: Commit** — `git add mobile && git commit -m "feat(mobil-rn): API client (Bearer + 401 auto-refresh) + secure auth store"`

---

## Task 4: Query provider + root layout + auth gate + Splash

**Files:** `mobile/src/lib/query.ts`, `mobile/app/_layout.tsx`, `mobile/app/index.tsx`

- [ ] **Step 1: `src/lib/query.ts`** — `export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 2, staleTime: 30_000 } } });`
- [ ] **Step 2: `app/_layout.tsx`** — providers + auth load + splash:
```tsx
import "../global.css";
import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { queryClient } from "../src/lib/query";
import { useAuth } from "../src/lib/auth-store";
import { SplashScreen } from "../src/components/SplashScreen";

export default function Root() {
  const { ready, access, load } = useAuth();
  const segments = useSegments(); const router = useRouter();
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === "(auth)";
    if (!access && !inAuth) router.replace("/(auth)/login");
    else if (access && inAuth) router.replace("/(tabs)");
  }, [ready, access, segments]);
  if (!ready) return <SplashScreen />;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```
- [ ] **Step 3: `src/components/SplashScreen.tsx`** — Emerald gradient + logo + "360Biznes" (sadə View, `expo-linear-gradient` istifadə et: `npx expo install expo-linear-gradient`).
- [ ] **Step 4: `app/index.tsx`** — boş redirect: `import { Redirect } from "expo-router"; export default () => <Redirect href="/(tabs)" />;`
- [ ] **Step 5: Verify** — `npx tsc --noEmit`; `npx expo start` ilə app açılır, login-ə yönəlir (token yoxdur).
- [ ] **Step 6: Commit** — `git add mobile && git commit -m "feat(mobil-rn): query provider + auth gate + splash"`

---

## Task 5: UI komponent kitabxanası

**Files:** `mobile/src/components/{Button,Input,Card,Screen,EmptyState,ErrorState,LoadingSkeleton,OfflineBanner,Accordion}.tsx`

- [ ] **Step 1:** Hər komponenti NativeWind className ilə yarat (Emerald-Teal). Konkret:
  - `Button` — `bg-brand` (primary) / `border border-brand` (outline), `rounded-2xl py-3`, `pressed` opacity, loading spinner (`ActivityIndicator`).
  - `Input` — `border border-line rounded-xl px-3 py-2.5`, label (`text-sub text-xs font-semibold`).
  - `Card` — `bg-white border border-line rounded-2xl p-3`.
  - `Screen` — SafeArea + `bg-[#f7f8fb] flex-1` wrapper + optional header (back + title).
  - `EmptyState` / `ErrorState` (retry düyməsi) / `LoadingSkeleton` (sətir/kart skeleton) / `OfflineBanner` (amber).
  - `Accordion` — başlıq sətri (ikon + ad + chevron) + açılan content (state ilə).
- [ ] **Step 2:** lucide-react-native ikonları işlət (Home, ShoppingCart, Bell, Menu, Plus, Package, User, ScanLine, Camera, Image, ChevronRight, Search).
- [ ] **Step 3: Verify** — `npx tsc --noEmit`.
- [ ] **Step 4: Commit** — `git add mobile && git commit -m "feat(mobil-rn): UI komponent kitabxanası (Emerald-Teal)"`

---

## Task 6: Login ekranı

**Files:** `mobile/app/(auth)/_layout.tsx`, `mobile/app/(auth)/login.tsx`

- [ ] **Step 1:** `(auth)/_layout.tsx` — `<Stack screenOptions={{ headerShown:false }} />`.
- [ ] **Step 2:** `login.tsx` — logo + email/şifrə Input + "Daxil ol" Button. Submit:
```tsx
const onLogin = async () => {
  setLoading(true); setErr(null);
  try {
    const r = await api.post("/auth/login", { email, password });
    await useAuth.getState().setSession(r.data.accessToken, r.data.refreshToken, r.data.user);
    router.replace("/(tabs)");
  } catch (e: any) {
    setErr(e?.response?.data?.error ?? "Giriş alınmadı");
  } finally { setLoading(false); }
};
```
- [ ] **Step 3: Verify** — `npx tsc --noEmit`; manual: emulator-da login (test-sahibkar@example.com / Test1234!) → tabs-a keçir (dev API :3500 işləməlidir; iOS simulator localhost-u görür, Android emulator üçün `app.json extra.apiBase`-i `http://10.0.2.2:3500` et).
- [ ] **Step 4: Commit** — `git add mobile && git commit -m "feat(mobil-rn): Login ekranı (token saxlama)"`

---

## Task 7: Bottom tabs shell + Home

**Files:** `mobile/app/(tabs)/_layout.tsx`, `mobile/app/(tabs)/index.tsx`, placeholder tab-lar

- [ ] **Step 1:** `(tabs)/_layout.tsx` — expo-router `Tabs` ilə 5 tab: Ana (`index`), Satış (`satis` placeholder "tezliklə"), mərkəzi ➕ FAB (custom tabBarButton → Yeni satış/məhsul seçimi və ya birbaşa məhsul forma), Bildiriş (`bildiris` placeholder), Menyu (`menyu` — profil/ayarlar/çıxış siyahısı). lucide ikonlar, aktiv rəng `brand`.
- [ ] **Step 2:** `(tabs)/index.tsx` (Home) — `/me`-dən salam (user adı) + sürətli düymə tile-ları (Məhsullar, Yeni məhsul, Skan) → naviqasiya. (Faza 1B-də Home sadədir; tam KPI dashboard sonrakı fazada.)
- [ ] **Step 3:** `menyu.tsx` — profil kartı (user) + sətirlər (Çıxış → `useAuth.clear()` + `/auth/logout` çağır + login-ə). Placeholder tab-lar sadə "Tezliklə" EmptyState.
- [ ] **Step 4: Verify** — `npx tsc --noEmit`; manual: tab-lar arası keçid, Çıxış işləyir (login-ə qayıdır).
- [ ] **Step 5: Commit** — `git add mobile && git commit -m "feat(mobil-rn): bottom tabs shell + Home + Menyu/Çıxış"`

---

## Task 8: Məhsul data hook-ları

**Files:** `mobile/src/features/mehsul/hooks.ts`, `mobile/src/features/mehsul/types.ts`

- [ ] **Step 1:** `types.ts` — API kontraktına uyğun tiplər (Product list item, ProductDetail). Kontrakt: `docs/superpowers/specs/mobil-api-kontrakt.md`. (Sahələri /mehsullar cavabından dəqiqləşdir: ad, kod, barkod, satis_qiymeti, stok, sekil_url və s.)
- [ ] **Step 2:** `hooks.ts` (TanStack Query):
```ts
import { useInfiniteQuery, useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";

export function useProducts(q: string) {
  return useInfiniteQuery({
    queryKey: ["mehsullar", q],
    queryFn: async ({ pageParam = 1 }) => (await api.get("/mehsullar", { params: { q, page: pageParam } })).data,
    getNextPageParam: (last, pages) => (pages.flatMap(p => p.items).length < last.total ? pages.length + 1 : undefined),
    initialPageParam: 1,
  });
}
export function useProduct(id: string) {
  return useQuery({ queryKey: ["mehsul", id], queryFn: async () => (await api.get(`/mehsullar/${id}`)).data.item });
}
export function useSaveProduct() {
  return useMutation({ mutationFn: async (b: { id?: string } & Record<string, unknown>) =>
    b.id ? (await api.put(`/mehsullar/${b.id}`, b)).data : (await api.post("/mehsullar", b)).data });
}
export function useBarcodeLookup() {
  return useMutation({ mutationFn: async (code: string) => (await api.get(`/mehsullar/barkod/${encodeURIComponent(code)}`)).data });
}
export async function uploadImage(uri: string): Promise<string> {
  const form = new FormData();
  const name = uri.split("/").pop() || "photo.jpg";
  // @ts-expect-error RN FormData file
  form.append("file", { uri, name, type: "image/jpeg" });
  const r = await api.post("/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
  return r.data.url;
}
```
- [ ] **Step 3: Verify** — `npx tsc --noEmit`.
- [ ] **Step 4: Commit** — `git add mobile && git commit -m "feat(mobil-rn): məhsul data hook-ları (TanStack Query)"`

---

## Task 9: Məhsul siyahı + axtarış ekranı

**Files:** `mobile/app/(tabs)/mehsullar/index.tsx`

- [ ] **Step 1:** `FlatList` + axtarış Input (debounce 300ms) + `useProducts(q)`. Hər element Card (şəkil/ad/kod/stok/qiymət, kritik stok qırmızı). `onEndReached` → `fetchNextPage` (infinite scroll). FAB (`+`) → `/mehsul/form`. Element tap → `/mehsul/[id]`.
- [ ] **Step 2:** Hallar: `isLoading` → LoadingSkeleton; boş → EmptyState ("Məhsul yoxdur" + Yeni məhsul); `isError` → ErrorState (retry `refetch`).
- [ ] **Step 3: Verify** — `npx tsc --noEmit`; manual: siyahı yüklənir (dev API), axtarış işləyir, scroll, boş/error halları.
- [ ] **Step 4: Commit** — `git add mobile && git commit -m "feat(mobil-rn): məhsul siyahı + axtarış + infinite scroll"`

---

## Task 10: Məhsul detal ekranı (akkordeon)

**Files:** `mobile/app/mehsul/[id].tsx`

- [ ] **Step 1:** `useProduct(id)` → şəkil/ad/kateqoriya/qiymət + stok + qiymət pillələri. Akkordeon sətirlər (Accordion komponenti): "Son hərəkətlər", "Servis tarixçəsi", "Statistika", "Ətraflı" — detal cavabında olan sahələrlə doldur (yoxdursa sətir gizlət). Aşağıda "Redaktə" (→ `/mehsul/form?id=`) + "Sat" (placeholder/sonrakı faza).
- [ ] **Step 2:** Hallar (loading/error). 
- [ ] **Step 3: Verify** — `npx tsc --noEmit`; manual: siyahıdan elementə → detal açılır, akkordeon işləyir.
- [ ] **Step 4: Commit** — `git add mobile && git commit -m "feat(mobil-rn): məhsul detal (akkordeon)"`

---

## Task 11: Məhsul yarat/redaktə formu (çox-şəkil + Ətraflı + barkod)

**Files:** `mobile/app/mehsul/form.tsx`, `mobile/src/components/ImagePickerRow.tsx`, `mobile/src/components/BarcodeScanner.tsx`

- [ ] **Step 1:** `ImagePickerRow` — 4 slot; "kamera" (`expo-image-picker launchCameraAsync`) + "qalereya" (`launchImageLibraryAsync`); seçilən şəkli `uploadImage(uri)` ilə yüklə → URL-ləri state-də saxla; hər şəkildə sil (✕). İcazə: `expo-image-picker` runtime permission.
- [ ] **Step 2:** `BarcodeScanner` — `expo-camera`/`expo-barcode-scanner` ilə modal skan; nəticəni callback-ə qaytar (barkod sahəsinə yaz və/və ya `useBarcodeLookup`).
- [ ] **Step 3:** `form.tsx` — əsas sahələr (şəkillər · ad* · satış qiyməti* · kateqoriya); **maya YOX**; "Satışdan auto" düyməsi (qiymət pillələrini doldur — sadə client hesab və ya sonradan); **"Ətraflı" akkordeon**: barkod (skan + auto) · kod · marka · vahid · rəng · təsvir · kritik/min stok · serial/IMEI switch. Sticky "Yadda saxla" → `useSaveProduct().mutate(body)` → uğurda geri + siyahını invalidate (`queryClient.invalidateQueries(["mehsullar"])`). `id` query param varsa redaktə (mövcud dəyərlərlə doldur — `useProduct`).
- [ ] **Step 4: Verify** — `npx tsc --noEmit`; manual: yeni məhsul yarat (şəkil çək/seç → yüklənir, ad+qiymət, yadda saxla → siyahıda görünür), barkod skan sahəni doldurur, redaktə işləyir.
- [ ] **Step 5: Commit** — `git add mobile && git commit -m "feat(mobil-rn): məhsul yarat/redaktə (çox-şəkil + barkod skan + Ətraflı)"`

---

## Task 12: App icon, splash, icazə mətnləri, EAS config

**Files:** `mobile/app.json`, `mobile/eas.json`, `mobile/assets/*`

- [ ] **Step 1:** `assets/` — icon.png (1024², Emerald-Teal "360" loqo), splash.png, adaptive-icon.png (placeholder dizayn — sadə brend loqo). `app.json`: name "360Biznes", slug, `ios.bundleIdentifier="az.360biznes.app"`, `android.package="az.360biznes.app"`, icon/splash, `version "1.0.0"`.
- [ ] **Step 2:** İcazə mətnləri — `ios.infoPlist`: `NSCameraUsageDescription`="Məhsul şəkli çəkmək və barkod skan üçün", `NSPhotoLibraryUsageDescription`="Məhsula şəkil əlavə etmək üçün". `android.permissions`: CAMERA. (expo-camera/image-picker plugin-ləri də `app.json plugins`-ə əlavə et icazə mətnləri ilə.)
- [ ] **Step 3:** `eas.json` — profillər:
```json
{ "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": {}
  } }
```
- [ ] **Step 4: Verify** — `npx expo-doctor` təmiz; `npx expo prebuild --no-install` xətasız (config düzgün).
- [ ] **Step 5: Commit** — `git add mobile && git commit -m "feat(mobil-rn): app icon/splash + icazə mətnləri + EAS config"`

---

## Task 13: Yekun manual run + sənədləşmə

- [ ] **Step 1: Android** — emulator işə sal; `app.json extra.apiBase="http://10.0.2.2:3500"` (emulator host-a belə çıxır), dev API :3500 işlək. `npx expo start` → Android-də aç. Sına: splash → login → tabs → məhsul siyahı (axtarış/scroll) → detal → yeni məhsul (kamera/qalereya şəkil + barkod skan + yadda saxla) → redaktə → çıxış. Offline (təyyarə rejimi) → OfflineBanner + retry. Screenshot götür.
- [ ] **Step 2: iOS** — iPhone simulator; `apiBase="http://localhost:3500"`; eyni axını sına. Screenshot.
- [ ] **Step 3:** `cd mobile && npx tsc --noEmit` təmiz; `npx expo-doctor` təmiz.
- [ ] **Step 4: Sənəd** — `mobile/README.md`: necə işə salmaq (apiBase qeydi iOS vs Android), EAS build əmrləri (`eas build -p android --profile preview`, `eas build -p ios --profile preview`), TestFlight/Play internal qeydləri (Apple/Google hesab + EAS login istifadəçi tərəfindən).
- [ ] **Step 5: Commit** — `git add mobile && git commit -m "docs(mobil-rn): README + run/build təlimatı; Faza 1B tamam"`

---

## Out of scope (1B)
- Satış/POS, Müştəri, Maliyyə ekranları (sonrakı fazalar) — tab-lar placeholder.
- Push notification (Faza 5).
- Tam KPI dashboard (Home sadədir — Faza 2+).
- Faktiki store submission (icon dizaynı, screenshots, EAS build run, Apple/Google hesab) — istifadəçi credential-ları ilə.
- 1A bilinən məhdudiyyətləri (mobil siyahıda maya gizli) — backend follow-up.

## Prod qeydi
EAS build prod API işlədəcək — `app.json extra.apiBase` build profilinə görə prod domenə (`https://www.360biznes.az`) qoyulmalı. `mobil-faza1` branch main-ə merge olunmalı (API prod-da olsun) + Vercel-ə `MOBILE_JWT_SECRET`.
