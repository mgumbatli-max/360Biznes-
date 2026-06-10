# Konfiqurasiya oluna bilən Lite rejimi

Tarix: 2026-06-10

## Problem
Qlobal Lite/Pro rejimi (`app-mode` cookie) var, amma fərq yalnız Dashboard + POS-da
tətbiq olunub və sabitdir. Sahibkar Lite-in necə olacağını ÖZÜ — ayarlardan — təyin
etmək istəyir: hansı modullar görünsün, hər modulda hansı bloklar, və dizayn forması
(sıxlıq, mobil layout, şrift, aksent). Biznes üzrə (sahibkar bütün işçilər üçün).

## Həll (təsdiqlənmiş)
**Registry + server-read config.** Mərkəzi blok registry + per-tenant JSON config
(`ayarlar` cədvəlində — migrasiya yox) + `getLiteConfig()` server helper. Səhifələr
config-i server-də oxuyur → Lite-da bloklar render olunmur (sürətli). Genişlənən.

## Komponentlər

### 1. Blok registry — `lib/lite/registry.ts`
Hər modulun konfiqurasiya oluna bilən bloklarını elan edir:
`{ kod, ad, modullar: [{ kod, ad, bloklar: [{ kod, ad, liteDefault }] }] }`.
Tək mənbə — həm ayar UI, həm səhifələr buradan oxuyur. Faza 1 modulları:
dashboard, ticaret, anbar, hesabatlar, maliyye.

### 2. Config model — `ayarlar` cədvəli (migrasiya YOX)
Bir sətir: `qrup='gorunis', acar='lite_config', nov='json', deyer=<JSON>`.
```jsonc
{
  "design":  { "density":"rahat"|"kompakt"|"genis", "mobileLayout":"kart"|"cedvel",
               "fontScale":"kicik"|"normal"|"boyuk", "accent":"rose"|"blue"|"emerald"|"violet" },
  "modules": { "<modulKod>": { "enabled": bool, "blocks": { "<blokKod>": bool } } }
}
```
`getLiteConfig()` (server, cached): config sətrini oxuyur, registry default-ları ilə
birləşdirir, tam `LiteConfig` qaytarır. Yoxdursa default (hamısı registry-default).

### 3. Ayar səhifəsi — `/ayarlar/gorunis`
- Dizayn forması: sıxlıq, mobil layout, şrift, aksent (segment seçicilər).
- Hər modul: açılan panel — "Lite-də göstər" + blok açar/bağla (registry-dən).
- Canlı önizləmə (seçimlər necə görünəcək).
- "Yadda saxla" → server action `saveLiteConfig` → `ayarlar` (tenant-scoped).

### 4. Tətbiq
- `getAppMode()` lite/pro seçir. Lite-da səhifə `getLiteConfig()` oxuyub blokları gate edir.
- Dizayn forması: `(dashboard)/layout.tsx` app-shell-ə `data-density / data-font /
  data-accent / data-mlayout` atributları qoyur (yalnız Lite-da) + globals.css həmin
  atributlara görə CSS dəyişənləri (spacing, font-size, --primary, mobil kart/cədvəl).
- Dashboard: sabit `lite` gating → config-driven (modules.dashboard.blocks).
- Ticarət/Anbar/Hesabatlar/Maliyyə: əsas blokları (ikincil sütunlar, filtrlər,
  xülasə kartları/qrafiklər) Lite-da config-ə görə gate.

## Mərhələlər
- **Faza 1 (bu spec):** registry + config + getLiteConfig + ayar səhifəsi + dizayn
  forması qlobal + Dashboard tam + 4 əsas modulun əsas blokları.
- **Faza 2+:** qalan modullar — sadəcə registry-yə əlavə + həmin səhifədə gate.

## Dəyişməyən
Mövcud `app-mode` cookie/toggle, POS Lite/Pro gating, Pro rejimi (tam funksional).

## Qəbul meyarı
- Sahibkar `/ayarlar/gorunis`-də Lite-i konfiqurasiya edib saxlaya bilir.
- Lite-da dashboard + 4 modul config-ə görə dəyişir; dizayn forması (sıxlıq/şrift/
  aksent/mobil layout) real tətbiq olunur.
- Pro dəyişmir. `tsc` + `next build` təmiz. Mobil donma yoxdur.
