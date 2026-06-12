# Pro/Lite + per-tenant fərdiləşdirmə (mobil + paylaşılan config) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`). Branch: `mobil-faza1`.

**Goal:** Mobil app-a Pro/Lite rejimini gətirmək — Pro = tam funksional, Lite = web-də qurulan per-tenant config (hansı modul görünsün + funksiya blokları), mobil ona əməl edir; modeli "tam modul gizlət" (`visible`) ilə genişləndirmək.

**Architecture:** Paylaşılan `LiteConfig` (`ayarlar` cədvəli) `visible` sahəsi ilə genişlənir (Lite-scoped; Pro hamısını göstərir). `getLiteConfig` core-u tenant-parametrli `getLiteConfigForTenant`-a çıxarılır (web `auth()`, mobil token paylaşır). Web nav + `/ayarlar/gorunis` `visible`-ə əməl edir/qurur. Yeni `GET /api/mobile/v1/app-config` config-i qaytarır. Mobil: cihaz-lokal Lite/Pro store + config hook + gating helper-ləri + ekran wiring.

**Tech Stack:** Next.js 16 (server actions, route handlers), Prisma, NextAuth; Expo SDK 56 (RN), TanStack Query, zustand, expo-secure-store, NativeWind.

**Verification:** Web/backend — `npx tsc --noEmit` (köklə) + canlı `:3500` curl testi. Mobil — `cd mobile && npx tsc --noEmit` + iOS/Android `npx expo export`. Yekun — adversarial yoxlama (paylaşılan `getLiteConfig` refaktoru).

**Spec:** `docs/superpowers/specs/2026-06-12-pro-lite-app-mode-design.md`.

---

## File Structure

| Fayl | Məsuliyyət | Əməliyyat |
|---|---|---|
| `lib/lite/config.ts` | `LiteModuleConfig.visible` + default/merge + `liteModuleVisible`/`moduleVisibleGate`/`hiddenLiteModules` + `getLiteConfigForTenant` | Modify |
| `features/ayar/lite-actions.ts` | `sanitize` → `visible` (dashboard məcburi true) | Modify |
| `features/ayar/components/lite-settings.tsx` | `buildDefaultConfig` visible + "modulu göstər/gizlət" keçidi | Modify |
| `app/(dashboard)/layout.tsx` | Lite-da gizli modulları hesabla, Sidebar-a ötür | Modify |
| `components/layout/sidebar.tsx` | `hiddenModules` prop ilə nav filtri | Modify |
| `app/api/mobile/v1/app-config/route.ts` | `GET → { lite }` | Create |
| `docs/superpowers/specs/mobil-api-kontrakt.md` | app-config kontraktı | Modify |
| `mobile/src/lib/app-mode-store.ts` | cihaz-lokal Lite/Pro (SecureStore) | Create |
| `mobile/src/features/app-config/types.ts` | `LiteConfig` mobil tipi | Create |
| `mobile/src/features/app-config/hooks.ts` | `useAppConfig` (TanStack Query) | Create |
| `mobile/src/lib/gating.ts` | `moduleVisible`/`blockOn` | Create |
| `mobile/app/(tabs)/menyu.tsx` | Lite/Pro keçidi | Modify |
| `mobile/app/(tabs)/index.tsx` | Home tile-ları `moduleVisible('anbar')` | Modify |

---

## Task 1: Model — `visible` sahəsi + helper-lər (`lib/lite/config.ts`)

**Files:** Modify `lib/lite/config.ts`

- [ ] **Step 1:** `LiteModuleConfig` tipinə `visible` əlavə et (mövcud `enabled`-dən əvvəl):
```ts
export type LiteModuleConfig = {
  /** YENİ — Lite-da naviqasiyada görünsün/görünməsin. Default true. Pro-da nəzərə alınmır. */
  visible: boolean;
  enabled: boolean;
  blocks: Record<string, boolean>;
  /** İcmal bağlı olanda modulun açıldığı səhifə (MODULE_LANDINGS-dən). */
  landing?: string;
};
```

- [ ] **Step 2:** `defaultLiteConfig()`-də modul obyektinə `visible: true` əlavə et:
```ts
    modules[m.kod] = {
      visible: true,
      enabled: true,
      blocks,
      landing: MODULE_LANDINGS[m.kod]?.[0]?.href,
    };
```

- [ ] **Step 3:** `mergeConfig()`-də modul birləşməsinə `visible` əlavə et (dashboard həmişə true):
```ts
    modules[kod] = {
      visible: kod === "dashboard" ? true : (savedMod?.visible ?? defMod.visible),
      enabled: savedMod?.enabled ?? defMod.enabled,
      blocks: { ...defMod.blocks, ...(savedMod?.blocks ?? {}) },
      landing:
        savedMod?.landing && allowedLandings.includes(savedMod.landing)
          ? savedMod.landing
          : defMod.landing,
    };
```

- [ ] **Step 4:** Faylın sonuna (helper-lər) əlavə et:
```ts
/** Lite-da modul naviqasiyada görünürmü (Pro-da həmişə true; dashboard həmişə true). */
export function liteModuleVisible(config: LiteConfig, modul: string): boolean {
  if (modul === "dashboard") return true;
  return config.modules[modul]?.visible !== false;
}

/** Lite-da gizlədilmiş modul kodları (Pro-da boş massiv qaytarmaq çağıranın işidir). */
export function hiddenLiteModules(config: LiteConfig): string[] {
  return Object.entries(config.modules)
    .filter(([kod, m]) => kod !== "dashboard" && m.visible === false)
    .map(([kod]) => kod);
}

/** Server gate: Pro → true, Lite → liteModuleVisible. */
export async function moduleVisibleGate(modul: string): Promise<boolean> {
  const mode = await getAppMode();
  if (mode !== "lite") return true;
  return liteModuleVisible(await getLiteConfig(), modul);
}
```

- [ ] **Step 5: Verify** — `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "lib/lite/config|error TS" | head` → `lib/lite/config` ilə bağlı xəta YOXdur (FormData kimi əvvəlcədən mövcud, əlaqəsiz xətaları nəzərə alma).

- [ ] **Step 6: Commit**
```bash
git add lib/lite/config.ts
git commit -m "feat(lite): modul visible sahəsi + liteModuleVisible/hiddenLiteModules/moduleVisibleGate"
```

---

## Task 2: `getLiteConfig` → `getLiteConfigForTenant` refaktoru (`lib/lite/config.ts`)

**Files:** Modify `lib/lite/config.ts`

**Kontekst:** Mövcud `getLiteConfig` `auth()`-dan `sahibkar_id` götürür. Mobil endpoint web session-a malik deyil (token + tenant-context). Nüvə oxumanı `sahibkarId` parametrli funksiyaya çıxarırıq; web wrapper davranışı 1:1 saxlanır (eyni `unstable_cache` açarı/tag-i, eyni merge).

- [ ] **Step 1:** Mövcud `getLiteConfig` (cache(async...)) gövdəsini yeni funksiyaya çıxar:
```ts
/** Verilmiş sahibkar üçün Lite config (tenant-context-dən və ya session-dan asılı deyil). */
export async function getLiteConfigForTenant(sahibkarId: string): Promise<LiteConfig> {
  const def = defaultLiteConfig();
  try {
    const readDeyer = unstable_cache(
      async () => {
        const row = await prismaUnscoped.ayarlar.findFirst({
          where: { sahibkar_id: sahibkarId, qrup: COOKIE_GROUP, acar: CONFIG_KEY },
          select: { deyer: true },
        });
        return row?.deyer ?? null;
      },
      ["lite-config", sahibkarId],
      { revalidate: 300, tags: [`lite-config:${sahibkarId}`] },
    );
    const deyer = await readDeyer();
    if (!deyer) return def;
    return mergeConfig(def, JSON.parse(deyer) as Partial<LiteConfig>);
  } catch {
    return def;
  }
}
```

- [ ] **Step 2:** `getLiteConfig`-i nazik wrapper et (mövcud davranış):
```ts
export const getLiteConfig = cache(async (): Promise<LiteConfig> => {
  try {
    const session = await auth();
    const sahibkarId = session?.user?.sahibkar_id;
    if (!sahibkarId) return defaultLiteConfig();
    return await getLiteConfigForTenant(sahibkarId);
  } catch {
    return defaultLiteConfig();
  }
});
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "lib/lite/config|error TS" | head` → əlaqəli xəta yox.

- [ ] **Step 4: Commit**
```bash
git add lib/lite/config.ts
git commit -m "refactor(lite): getLiteConfigForTenant çıxar (web+mobil paylaşır, web nəticəsi 1:1)"
```

---

## Task 3: `/ayarlar/gorunis` — `visible` toggle (`lite-actions.ts` + `lite-settings.tsx`)

**Files:** Modify `features/ayar/lite-actions.ts`, `features/ayar/components/lite-settings.tsx`

- [ ] **Step 1:** `lite-actions.ts` `sanitize()`-də modul obyektinə `visible` əlavə et (dashboard məcburi true):
```ts
    modules[m.kod] = {
      visible: m.kod === "dashboard" ? true : (typeof sm.visible === "boolean" ? sm.visible : true),
      enabled: typeof sm.enabled === "boolean" ? sm.enabled : true,
      blocks,
      landing: allowedL.includes(String(sm.landing)) ? String(sm.landing) : allowedL[0],
    };
```

- [ ] **Step 2:** `lite-settings.tsx` `buildDefaultConfig()`-də `visible: true`:
```ts
    modules[m.kod] = { visible: true, enabled: true, blocks };
```

- [ ] **Step 3:** `lite-settings.tsx`-ə `toggleVisible` əlavə et (`toggleModule`-dan sonra):
```ts
  const toggleVisible = (m: string) =>
    setCfg((c) => ({
      ...c,
      modules: { ...c.modules, [m]: { ...c.modules[m], visible: !c.modules[m].visible } },
    }));
```

- [ ] **Step 4:** `lite-settings.tsx` modul kartının başlıq sətrində (`<span ...>{m.ad}</span>` ilə eyni sətirdə) `visible` keçidi əlavə et. `dashboard` üçün keçid göstərilmir (həmişə açıq). Mövcud başlıq blokunu belə əvəz et:
```tsx
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{m.ad}</span>
                <div className="flex items-center gap-3">
                  {m.kod !== "dashboard" && (
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      {mc.visible ? "Görünür" : "Gizli"}
                      <input
                        type="checkbox"
                        checked={mc.visible}
                        onChange={() => toggleVisible(m.kod)}
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                  )}
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    {mc.enabled ? "Lite-da sadələşdir" : "Tam göstərilir"}
                    <input
                      type="checkbox"
                      checked={mc.enabled}
                      onChange={() => toggleModule(m.kod)}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                </div>
              </div>
```

- [ ] **Step 5:** `lite-settings.tsx`-də modul gizli olanda landing/blok seçimlərini söndür — `{mc.enabled && (` şərtini `{mc.visible && mc.enabled && (` et; landing bloku `{MODULE_LANDINGS[m.kod] && (` → `{mc.visible && MODULE_LANDINGS[m.kod] && (`. Modul gizli olanda altına məlumat sətri əlavə et:
```tsx
              {!mc.visible && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Bu modul Lite rejimində naviqasiyada görünməyəcək (Pro-da görünür).
                </p>
              )}
```

- [ ] **Step 6:** Bölmə təsvirini yenilə (`<p>` "Hər modulu Lite-da sadələşdirin..."): sonuna əlavə et: ` "Görünür" keçidini söndürsəniz, modul Lite naviqasiyasından tamamilə çıxır.`

- [ ] **Step 7: Verify** — `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "lite-actions|lite-settings|error TS" | head` → əlaqəli xəta yox.

- [ ] **Step 8: Commit**
```bash
git add features/ayar/lite-actions.ts features/ayar/components/lite-settings.tsx
git commit -m "feat(ayar): /ayarlar/gorunis modul göstər/gizlət keçidi (visible)"
```

---

## Task 4: Web nav gating — Lite-da gizli modullar (`layout.tsx` + `sidebar.tsx`)

**Files:** Modify `app/(dashboard)/layout.tsx`, `components/layout/sidebar.tsx`

**Kontekst:** Sidebar `NAV_SECTIONS`-ı `canSeeNavItem` ilə filtrləyir (sidebar.tsx:84-91). Modul kodu `href`-in ilk seqmentidir (`/anbar` → `anbar`). Lite-da `hiddenModules` set-indəki kodları çıxarırıq.

- [ ] **Step 1:** ƏVVƏLCƏ `app/(dashboard)/layout.tsx`-i oxu. `<Sidebar .../>` render olunan komponenti/scope-u tap (layout və ya alt-komponent ola bilər; faylda birdən çox `getAppMode()` çağırışı var — Sidebar-ın render olunduğu scope-u hədəflə). Həmin scope-da `getLiteConfig` və `hiddenLiteModules` (`@/lib/lite/config`-dən) import edib gizli modulları hesabla:
```ts
  const liteCfg = appMode === "lite" ? await getLiteConfig() : null;
  const hiddenModules = liteCfg ? hiddenLiteModules(liteCfg) : [];
```
Əgər həmin scope-da `liteDesign` artıq `(await getLiteConfig()).design`-dən hesablanırsa, `getLiteConfig`-i bir dəfə çağır (`const liteCfg = ...`) və hər ikisini ondan götür (`cache()` dedupe etsə də təmiz saxla). `appMode` artıq mövcud dəyişəndir.

- [ ] **Step 2:** Həmin render nöqtəsində `<Sidebar ... hiddenModules={hiddenModules} />` prop-u ötür. Sidebar birdən çox yerdə (desktop + mobil drawer) render olunursa, hər ikisinə eyni `hiddenModules` ötür.

- [ ] **Step 3:** `components/layout/sidebar.tsx`-də props tipinə `hiddenModules?: string[]` əlavə et (default `[]`), və nav filtrinə (line ~86 `sec.items.filter`) modul-gizlətmə əlavə et:
```ts
    return NAV_SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter((i) => {
        const modul = i.href.split("/")[1] ?? "";
        if (hiddenModules.includes(modul)) return false;
        return canSeeNavItem(i, ctx);
      }),
    })).filter((sec) => sec.items.length > 0);
```
`hiddenModules`-u `useMemo` asılılıq massivinə əlavə et.

- [ ] **Step 4: Verify** — `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "layout|sidebar|error TS" | head` → əlaqəli xəta yox.

- [ ] **Step 5: Commit**
```bash
git add "app/(dashboard)/layout.tsx" components/layout/sidebar.tsx
git commit -m "feat(nav): Lite-da gizlədilmiş modullar sidebar-dan çıxarılır (Pro-da qalır)"
```

---

## Task 5: Mobil endpoint `GET /api/mobile/v1/app-config`

**Files:** Create `app/api/mobile/v1/app-config/route.ts`; Modify `docs/superpowers/specs/mobil-api-kontrakt.md`

- [ ] **Step 1:** `app/api/mobile/v1/app-config/route.ts` yarat:
```ts
import { NextRequest } from "next/server";
import { withMobile } from "@/lib/mobile/session";
import { getLiteConfigForTenant } from "@/lib/lite/config";

/**
 * GET — tenant-ın Lite/Pro config-i (mobil app oxuyur).
 * Mobil mode (Lite/Pro) cihaz-lokaldır; bu endpoint yalnız per-tenant
 * fərdiləşdirməni (modul görünüşü + bloklar + dizayn) qaytarır.
 */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    const lite = await getLiteConfigForTenant(ctx.sahibkarId);
    return { lite };
  });
}
```

- [ ] **Step 2:** `mobil-api-kontrakt.md`-ə (referanslar bölməsindən sonra) əlavə et:
```
### GET `/api/mobile/v1/app-config`
Auth: Bearer. Tenant-ın Lite/Pro fərdiləşdirməsi (mobil mode cihaz-lokaldır).
200: `{ "lite": { "design": {density,mobileLayout,fontScale,accent}, "modules": { "<kod>": { "visible":bool, "enabled":bool, "blocks":{<blok>:bool}, "landing"?:string } } } }`
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "app-config|error TS" | head` → əlaqəli xəta yox.

- [ ] **Step 4: Commit**
```bash
git add "app/api/mobile/v1/app-config/route.ts" docs/superpowers/specs/mobil-api-kontrakt.md
git commit -m "feat(mobil-api): /app-config endpoint (tenant Lite config)"
```

---

## Task 6: Mobil — mode store + config tipi

**Files:** Create `mobile/src/lib/app-mode-store.ts`, `mobile/src/features/app-config/types.ts`

- [ ] **Step 1:** `mobile/src/lib/app-mode-store.ts`:
```ts
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
```

- [ ] **Step 2:** `mobile/src/features/app-config/types.ts`:
```ts
export type LiteModuleConfig = {
  visible: boolean;
  enabled: boolean;
  blocks: Record<string, boolean>;
  landing?: string;
};
export type LiteDesign = {
  density: string;
  mobileLayout: string;
  fontScale: string;
  accent: string;
};
export type LiteConfig = {
  design: LiteDesign;
  modules: Record<string, LiteModuleConfig>;
};
export type AppConfigResponse = { lite: LiteConfig };
```

- [ ] **Step 3: Verify** — `cd /Users/mr.maqa/Projects/360biznes-next/mobile && npx tsc --noEmit` təmiz.

- [ ] **Step 4: Commit**
```bash
cd /Users/mr.maqa/Projects/360biznes-next
git add mobile/src/lib/app-mode-store.ts mobile/src/features/app-config/types.ts
git commit -m "feat(mobil-rn): app-mode store (SecureStore) + Lite config tipləri"
```

---

## Task 7: Mobil — config hook + gating helper-ləri

**Files:** Create `mobile/src/features/app-config/hooks.ts`, `mobile/src/lib/gating.ts`

- [ ] **Step 1:** `mobile/src/features/app-config/hooks.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { AppConfigResponse, LiteConfig } from "./types";

export function useAppConfig() {
  return useQuery({
    queryKey: ["app-config"],
    queryFn: async () => (await api.get<AppConfigResponse>("/app-config")).data,
    staleTime: 5 * 60_000,
  });
}
export type { LiteConfig };
```

- [ ] **Step 2:** `mobile/src/lib/gating.ts`:
```ts
import type { AppMode } from "./app-mode-store";
import type { LiteConfig } from "../features/app-config/types";

/** Pro → həmişə true. Lite → modul görünür (dashboard həmişə true). */
export function moduleVisible(
  cfg: LiteConfig | undefined,
  mode: AppMode,
  kod: string,
): boolean {
  if (mode !== "lite") return true;
  if (kod === "dashboard") return true;
  return cfg?.modules?.[kod]?.visible !== false;
}

/** Pro → həmişə true. Lite → blok aktiv (modul enabled=false isə hamısı görünür). */
export function blockOn(
  cfg: LiteConfig | undefined,
  mode: AppMode,
  modul: string,
  blok: string,
): boolean {
  if (mode !== "lite") return true;
  const m = cfg?.modules?.[modul];
  if (!m) return true;
  if (!m.enabled) return true;
  return m.blocks?.[blok] ?? false;
}
```

- [ ] **Step 3: Verify** — `cd /Users/mr.maqa/Projects/360biznes-next/mobile && npx tsc --noEmit` təmiz.

- [ ] **Step 4: Commit**
```bash
cd /Users/mr.maqa/Projects/360biznes-next
git add mobile/src/features/app-config/hooks.ts mobile/src/lib/gating.ts
git commit -m "feat(mobil-rn): useAppConfig hook + moduleVisible/blockOn gating helper-ləri"
```

---

## Task 8: Mobil wiring — Menyu Lite/Pro keçidi + Home tile gating + mode load

**Files:** Modify `mobile/app/(tabs)/menyu.tsx`, `mobile/app/(tabs)/index.tsx`, `mobile/app/_layout.tsx`

- [ ] **Step 1:** `mobile/app/_layout.tsx` — mövcud auth `load()` effekti yanında app-mode load et. Import `useAppModeStore`, və mövcud `useEffect(() => { load(); }, [load])` yanına:
```tsx
  const loadMode = useAppModeStore((s) => s.load);
  useEffect(() => { loadMode(); }, [loadMode]);
```
(Auth gate dəyişmir; mode yüklənməsi paraleldir.)

- [ ] **Step 2:** `mobile/app/(tabs)/menyu.tsx` — profil kartından sonra Lite/Pro segmented control əlavə et. Import:
```tsx
import { useAppModeStore } from "../../src/lib/app-mode-store";
```
Komponent içində:
```tsx
  const mode = useAppModeStore((s) => s.mode);
  const setMode = useAppModeStore((s) => s.setMode);
```
JSX (profil kartından sonra, `Card` içində):
```tsx
        <Card className="mb-3">
          <Text className="text-sub text-xs font-semibold mb-2">Rejim</Text>
          <View className="flex-row rounded-xl bg-bg p-1">
            {(["lite", "pro"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                className={`flex-1 rounded-lg py-2 items-center ${mode === m ? "bg-brand" : ""}`}
              >
                <Text className={`text-sm font-semibold ${mode === m ? "text-white" : "text-sub"}`}>
                  {m === "lite" ? "Lite (sadə)" : "Pro (tam)"}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="text-sub text-xs mt-2">
            Lite — yalnız vacib funksiyalar (web ayarlarına görə). Pro — hər şey aktiv.
          </Text>
        </Card>
```
(`Pressable`, `View`, `Text` `react-native`-dən; `Card` barrel-dən — import-ları yoxla/əlavə et.)

- [ ] **Step 3:** `mobile/app/(tabs)/index.tsx` (Home) — Məhsul/Skan tile-larını `anbar` modul görünüşünə görə gizlət. Import:
```tsx
import { useAppModeStore } from "../../src/lib/app-mode-store";
import { useAppConfig } from "../../src/features/app-config/hooks";
import { moduleVisible } from "../../src/lib/gating";
```
Komponent içində:
```tsx
  const mode = useAppModeStore((s) => s.mode);
  const { data: appCfg } = useAppConfig();
  const anbarOn = moduleVisible(appCfg?.lite, mode, "anbar");
```
Məhsul/Skan tile-larını `{anbarOn && ( ... )}` ilə əhatə et (mövcud tile JSX-ini şərti et). "Yeni məhsul" tile-ı da anbar-a aiddir → `anbarOn`-a bağla. Bütün tile-lar gizlənirsə, qısa məlumat göstər:
```tsx
        {!anbarOn && (
          <Text className="text-sub text-sm">Lite rejimində modullar gizlədilib. Menyu → Pro ilə hamısını aç.</Text>
        )}
```

- [ ] **Step 4: Verify** — `cd /Users/mr.maqa/Projects/360biznes-next/mobile && npx tsc --noEmit` təmiz.

- [ ] **Step 5: Commit**
```bash
cd /Users/mr.maqa/Projects/360biznes-next
git add mobile/app
git commit -m "feat(mobil-rn): Menyu Lite/Pro keçidi + Home tile gating + mode load"
```

---

## Task 9: Yekun yoxlama (backend canlı + mobil bundle + adversarial)

**Files:** yox (yoxlama)

- [ ] **Step 1: Backend canlı test** — dev server `:3500` işləkdir. Login → `/app-config` çağır, `lite.modules` `visible` ilə gəlir:
```bash
node -e 'const B="http://localhost:3500/api/mobile/v1";(async()=>{const l=await(await fetch(B+"/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"test-sahibkar@example.com",password:"Test1234!"})})).json();const r=await fetch(B+"/app-config",{headers:{Authorization:"Bearer "+l.accessToken}});const j=await r.json();console.log("status",r.status);const a=j.lite?.modules?.anbar;console.log("anbar:",JSON.stringify(a));console.log("modul sayı:",Object.keys(j.lite?.modules||{}).length);})()'
```
Gözlənilən: `status 200`, `anbar` obyektində `visible:true` (default), modul sayı 10.

- [ ] **Step 2: Web parity** — `getLiteConfigForTenant` web `getLiteConfig` ilə eyni nəticə (refaktor regressiya yaratmayıb): dev server-də `/ayarlar/gorunis` səhifəsi xətasız açılır (manual və ya `curl -s -o /dev/null -w "%{http_code}" http://localhost:3500/ayarlar/gorunis` auth tələb etdiyi üçün 200/307 — login-li yoxlama istifadəçidə).

- [ ] **Step 3: Mobil** — `cd /Users/mr.maqa/Projects/360biznes-next/mobile && npx tsc --noEmit` təmiz; `npx expo export --platform ios --output-dir /tmp/expmode` xətasız (bundle OK).

- [ ] **Step 4: Adversarial** — paylaşılan dəyişiklikləri (config.ts model+refaktor, sidebar nav filtri) müstəqil yoxla: (a) `getLiteConfigForTenant` web nəticəsini dəyişmir; (b) `hiddenModules` filtri yalnız registry modullarını gizlədir, POS/ayarlar/dashboard kimi qeyri-registry linkləri toxunmur; (c) `visible` additiv, köhnə config-ləri pozmur.

- [ ] **Step 5:** (commit yox — yoxlama tapşırığı)

---

## Out of scope (sonra)
- Mobil-də Lite config-redaktə ekranı (yalnız web qurur).
- Plan/abunəyə bağlama.
- Mobil-də Lite dizayn token-ləri (density/şrift/accent) — mobil Emerald-Teal qalır.
- Web nav-ın bütün ikincil nöqtələri (command-palette, breadcrumb) — yalnız əsas sidebar.
