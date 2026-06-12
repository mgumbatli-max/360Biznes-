# Pro/Lite + per-tenant fərdiləşdirmə (mobil + paylaşılan config) — Dizayn

**Tarix:** 2026-06-12 · **Branch:** `mobil-faza1`

## Məqsəd
Mobil app-a Pro/Lite rejimi gətirmək: **Pro** = tam funksional (hər şey aktiv), **Lite** = müştəri tərəfindən fərdiləşdirilən (hansı modul görünsün, açıq modulda hansı funksiya/blok aktiv olsun). Mobil app web-də artıq mövcud per-tenant Lite config-ini oxuyub tətbiq edir (tək mənbə, DRY). Müştəri konfiqurasiyanı **web-də** (`/ayarlar/gorunis`) edir; mobil ona əməl edir + cihaz-lokal Lite/Pro keçidi olur.

## Qərarlar (təsdiqlənmiş)
- **Yanaşma A** — paylaşılan config, `visible` ilə genişləndirilmiş; mobil oxuyur, web konfiqurasiya edir.
- **Granularlıq** — tam modul gizlət **+** açıq modullarda funksiya/blok aç-bağla.
- **Config yeri** — web (`/ayarlar/gorunis`); mobil yalnız oxuyur + Lite/Pro keçidi.
- **`visible` Lite-scoped-dur** — yalnız Lite-da təsir edir; **Pro hər şeyi göstərir** (Lite-da gizlədilmiş modul Pro-da qayıdır).

## Mövcud sistem (kontekst)
- `lib/app-mode.ts`: `AppMode = "lite"|"pro"`, `app-mode` cookie (proxy mobil UA → lite); `getAppMode()`.
- `lib/lite/registry.ts`: `LITE_MODULES` (10 modul: dashboard, ticaret, anbar, hesabatlar, maliyye, servis, elaqe, kampaniyalar, iscilier, tapshiriqlar), hər birində `bloklar` (`{kod, ad, liteDefault}`). Dizayn seçimləri (density/font/accent/mobileLayout).
- `lib/lite/config.ts`: per-tenant `LiteConfig` (`ayarlar` cədvəli, `qrup='gorunis'`, `acar='lite_config'`, JSON). `getLiteConfig()` (`auth()`-dan `sahibkar_id`, `unstable_cache` tag `lite-config:<id>`). `mergeConfig` (saxlanmış üstünə default). `liteBlockOn`, `liteGate`, `getModuleEntry`. `saveLiteConfig` → `revalidateTag(liteConfigCacheTag(id), "max")`.
- `LiteModuleConfig = { enabled, blocks: Record<string,bool>, landing? }` — `enabled=false` "sadələşdirmə yox = hamısı göstər" deməkdir. Tam-modul-gizlətmə **yoxdur** (bu işin əsas əlavəsi).

---

## 1. Data model (additiv)
`lib/lite/config.ts` → `LiteModuleConfig`-ə əlavə:
```ts
export type LiteModuleConfig = {
  visible: boolean;        // YENİ — default true. Lite-da naviqasiyada görünsün/görünməsin.
  enabled: boolean;        // mövcud
  blocks: Record<string, boolean>;
  landing?: string;
};
```
- `defaultLiteConfig()`: hər modul üçün `visible: true`.
- `mergeConfig()`: `visible: savedMod?.visible ?? defMod.visible`.
- Geriyə uyğun: köhnə saxlanmış config-lərdə `visible` yoxdursa → default `true` (heç nə gizlənmir).
- **Qoruyucu:** `dashboard` modulu həmişə görünür (UI saxlamadan əvvəl `visible=true` məcbur edir; boş naviqasiya riski yox).

Yeni helper-lər (`lib/lite/config.ts`):
```ts
// Lite-da modul görünürmü (Pro → həmişə true).
export function liteModuleVisible(cfg: LiteConfig, modul: string): boolean {
  if (modul === "dashboard") return true;
  return cfg.modules[modul]?.visible !== false;
}
// Server gate (mode oxuyur): Pro → true, Lite → liteModuleVisible.
export async function moduleVisibleGate(modul: string): Promise<boolean> {
  const mode = await getAppMode();
  if (mode !== "lite") return true;
  return liteModuleVisible(await getLiteConfig(), modul);
}
```

`getLiteConfig` refaktoru (mobil paylaşması üçün): nüvə oxuma `auth()`-dan ayrılır →
```ts
// sahibkarId-ni parametr alan ortaq nüvə (unstable_cache + merge).
export async function getLiteConfigForTenant(sahibkarId: string): Promise<LiteConfig> { /* mövcud oxuma məntiqi */ }
// Web wrapper — auth()-dan sahibkarId götürür (mövcud davranış 1:1).
export const getLiteConfig = cache(async (): Promise<LiteConfig> => { /* auth() → getLiteConfigForTenant */ });
```
Web davranışı dəyişmir (eyni nəticə, eyni cache tag).

## 2. Web tərəfi
- **Naviqasiya gating:** modul siyahısını render edən komponent(lər) Lite-da `liteModuleVisible`-a görə filtrlənir (Pro-da hamısı). (Sidebar/menyu/mobil-web nav — modul linkləri burada gizlənir.)
- **`/ayarlar/gorunis` UI:** hər modul başlığında **"Modulu göstər/gizlət"** keçidi (`visible`). `dashboard` üçün keçid deaktiv/yox (həmişə açıq). `saveLiteConfig` `visible`-i validate edib saxlayır.
- `saveLiteConfig` cache invalidation dəyişmir (`revalidateTag(lite-config:<id>, "max")`).

## 3. Mobil API
Yeni endpoint:
```
GET /api/mobile/v1/app-config   (Bearer; xüsusi icazə yox)
200: { "lite": LiteConfig }     // tenant-context sahibkar_id ilə getLiteConfigForTenant
```
- `withMobile(req, async (ctx) => ({ lite: await getLiteConfigForTenant(ctx.sahibkarId) }))`.
- Kontrakt sənədi (`docs/superpowers/specs/mobil-api-kontrakt.md`) yenilənir.

## 4. Mobil app (`mobile/`)
- **Mode store** `src/lib/app-mode-store.ts` (zustand + SecureStore): `{ mode: "lite"|"pro", ready, load(), setMode(m) }`; açar `app_mode`, default **"lite"**.
- **Config hook** `src/features/app-config/hooks.ts`: `useAppConfig()` → TanStack Query `/app-config`, `staleTime: 5dq`. Flicker-siz hidrasiya üçün son-bilinən `lite` config SecureStore-da (`app_config_cache`) saxlanır və `initialData` kimi verilir.
- **Tip** `src/features/app-config/types.ts`: `LiteConfig` (web tipinin mobil güzgüsü — `modules: Record<string,{visible,enabled,blocks,landing?}>`, `design`).
- **Gating helper-ləri** `src/lib/gating.ts`:
  ```ts
  moduleVisible(cfg, mode, kod): boolean   // Pro → true; Lite → kod==="dashboard" || cfg.modules[kod]?.visible!==false
  blockOn(cfg, mode, modul, blok): boolean // Pro → true; Lite → liteBlockOn məntiqi
  ```
- **Tətbiq nöqtələri (Faza 1B səthi — dürüst):**
  - **Menyu** ekranı: Lite/Pro **keçidi** (segmented control); seçim `setMode` ilə saxlanır.
  - **Home** sürətli-əməl tile-ları: Məhsul/Skan tile-ları `moduleVisible(...,'anbar')`-a görə (modul-səviyyə gating — əsas görünən təsir).
  - **Məhsul siyahı:** `blockOn(...,'anbar','filtrler')` — Lite-da qabaqcıl sort/filtr UI gizli, Pro-da açıq (registry-də mövcud `anbar.filtrler` bloku ilə uzlaşır).
  - **Məhsul detal / forma:** ekranlar artıq Lite-friendly dizayn olunub (akkordeonlar collapsed, hide-when-empty). Pro-da detalda akkordeonlar default-açıq ola bilər (kiçik fərq). **Mobil detal akkordeonları üçün registry-yə YENİ blok kodları əlavə EDİLMİR** (web registry mobil-spesifik anlayışlarla çirkləndirilmir).
  - Gələcək tab/modullar: hər biri `moduleVisible` yoxlayır (çərçivə hazır).
- **Pro:** hər şey açıq; config nəzərə alınmır.
- **Faza 1B-də görünən təsir dürüst qiyməti:** əsas dəyər = modul-görünüşü (`visible`) + Lite/Pro keçidi + gələcək modullar üçün çərçivə. Blok-səviyyə gating yalnız registry-də mobil ekvivalenti olan bloka (`filtrler`) tətbiq olunur; Məhsul ekranları onsuz da Lite-friendly-dir.

## 5. Scope / YAGNI
- **Daxil:** model `visible` + web nav gating + `/ayarlar/gorunis` keçidi + `getLiteConfigForTenant` refaktoru + mobil `app-config` endpoint + mobil mode store/keçid + config hook + gating helper-ləri + tətbiq nöqtələri + Pro=hamısı.
- **Xaric (sonra):** mobil-də config-redaktə ekranı; plan/abunəyə bağlama; mobil-də Lite dizayn token-ləri (density/şrift/accent — mobil Emerald-Teal qalır); web nav-ın bütün küncləri (yalnız əsas modul-link render nöqtəsi).

## 6. Verification
- **Backend:** `app-config` endpoint testi — login → `{lite}` `visible` sahələri ilə gəlir; `getLiteConfigForTenant` web `getLiteConfig` ilə eyni nəticə (regresiya yox).
- **Web:** `/ayarlar/gorunis`-də modul gizlət → Lite naviqasiyadan çıxır; Pro-da qalır; `dashboard` gizlədilə bilmir.
- **Mobil:** `cd mobile && npx tsc --noEmit` təmiz + iOS/Android `expo export` təmiz; Lite-da gizli modul tile-ı görünmür, Pro-da görünür; detal/forma blokları config-ə cavab verir; Lite/Pro keçidi işləyir (SecureStore-da qalır).

## Risklər / qeydlər
- `getLiteConfig` refaktoru paylaşılan web koduna toxunur — web nəticəsi 1:1 saxlanmalı (eyni cache tag/merge). Plan-da regresiya yoxlaması.
- Mobil config yüklənənə qədər: `initialData` (cache) və ya Lite-default; gating config hazır olandan tətbiq olunur (gizli→görünən flicker-i minimallaşdır).
- `anbar` modul kodu mobil Məhsul dilimi ilə uyğun gəlir. Mobil blok-gating yalnız registry-də mövcud `anbar` bloklarına (`dashboard/ozet/filtrler`) istinad edir — mövcud olmayan blok koduna istinad EDİLMİR. Mobil detal/forma onsuz da Lite-friendly olduğu üçün əlavə blok tələb etmir.
