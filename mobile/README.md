# 360Biznes — Mobil App (Expo / React Native)

360biznes-next ERP platforması üçün native iOS + Android tətbiqi. Tək kod bazası (Expo SDK 56, Expo Router, TanStack Query, NativeWind + Emerald-Teal tema). Mövcud `/api/mobile/v1` token-əsaslı API qatını işlədir (server action-lar RN-dən çağırıla bilmir).

> **Faza 1B** — Anbar/Məhsul şaquli dilimi: Login, Home, Məhsul siyahı/axtarış, detal (akkordeon), yarat/redaktə (çox-şəkil + barkod skan + Ətraflı). Satış/POS, Müştəri, Maliyyə, Push — sonrakı fazalar (tab-lar placeholder).

---

## Tələblər
- Node 18+ (repo ilə eyni), npm.
- Xcode (iOS simulator) və/və ya Android Studio (emulator).
- Backend dev server **`http://localhost:3500`**-də işləməlidir (branch `mobil-faza1`, məhsul + auth endpoint-ləri).

## İşə salma (dev)
```bash
cd mobile
npm install
npx expo start            # QR / i (iOS sim) / a (Android emulator)
```

### `apiBase` (vacib — platformaya görə dəyişir)
Mobil app API-ya `app.json → expo.extra.apiBase` ünvanından çıxır:

| Mühit | apiBase |
|---|---|
| iOS Simulator | `http://localhost:3500` (default) |
| Android Emulator | `http://10.0.2.2:3500` (emulator host-a belə çıxır) |
| Real cihaz (eyni Wi-Fi) | `http://<kompüterin-LAN-IP>:3500` (məs. `http://192.168.1.50:3500`) |
| EAS preview/prod build | `https://www.360biznes.az` |

Dəyişmək üçün `app.json`-dakı `extra.apiBase`-i redaktə et və Metro-nu yenidən başlat.

> Backend dev server-i ayrıca terminalda qaldır: repo kökündə `npm run dev` (port 3500).

## Test axını (manual)
Login → tabs → Məhsullar (axtarış/scroll/pull-to-refresh) → məhsula toxun → detal (akkordeonları aç: stok/son satış/hərəkət/servis/statistika/ətraflı) → `+` ilə yeni məhsul (kamera/qalereya şəkil yüklə, barkod skan, ad+qiymət, yadda saxla → siyahıda görünür) → redaktə → Menyu → Çıxış (login-ə qayıdır). Offline (təyyarə rejimi) → OfflineBanner + retry.

---

## EAS Build (istifadəçi credential-ları ilə)
```bash
cd mobile
npx eas login                              # Expo hesabı
npx eas build -p android --profile preview # APK (internal)
npx eas build -p ios --profile preview     # internal (Apple Developer hesabı tələb olunur)
```
- Bundle ID / package: **`az.biznes360.app`** (qeyd: `az.360biznes.app` etibarsızdır — reverse-DNS seqmenti rəqəmlə başlaya bilməz).
- Prod build-dən əvvəl `app.json extra.apiBase`-i prod domenə (`https://www.360biznes.az`) qoy.
- TestFlight (iOS) / Play internal (Android) yüklənməsi Apple/Google hesabı + `eas submit` ilə istifadəçi tərəfindən edilir.
- İcazə mətnləri (kamera/qalereya) `app.json` (`ios.infoPlist`, `expo-camera`/`expo-image-picker` plugin config) içindədir.

---

## Layihə strukturu
```
app/                       Expo Router (file-based nav)
  _layout.tsx              providers + auth gate + splash
  (auth)/login.tsx         login
  (tabs)/                  Ana · Satış · ➕ · Bildiriş · Menyu
    mehsullar/index.tsx    məhsul siyahı (href:null — tab deyil)
  mehsul/[id].tsx          detal (akkordeon)
  mehsul/form.tsx          yarat/redaktə
src/
  lib/        api.ts (Bearer + 401 auto-refresh) · auth-store.ts (SecureStore) · query.ts · format.ts
  components/ Button, Input, Card, Screen, EmptyState, ErrorState, LoadingSkeleton, OfflineBanner,
              Accordion, ImagePickerRow, BarcodeScanner, SplashScreen
  features/mehsul/ hooks.ts (useProducts/useProduct/useSaveProduct/useReferences/useBarcodeLookup/uploadImage) · types.ts
  theme.ts    Emerald-Teal token-ləri (C)
```

## Bilinən qeydlər (yuvalanmış struktur)
`mobile/` qovluğu 360biznes-next repo-su içindədir. Buna görə:
- `babel-preset-expo`, `react-native-worklets`, `react-native-reanimated` **birbaşa asılılıq** kimi əlavə olunub (NativeWind 4 runtime peer-ləri; npm onları parent repo ucbatından `mobile/node_modules` kökünə hoist etmirdi → bundle xətası idi, indi həll olunub).
- `npx expo-doctor` "duplicate react" (mobile 19.2.x vs parent `../node_modules`) **xəbərdarlığı verir** — bu yalnız lokal dev artefaktıdır. Metro react-i `mobile/node_modules`-dan resolve edir; **EAS build-lər izolyasiyalıdır** (parent `node_modules` yüklənmir), ona görə real build-ə təsir etmir. iOS + Android `expo export` hər ikisi təmiz keçir.

## Faza 1B-dən kənar (sonrakı)
Satış/POS, Müştəri, Maliyyə ekranları · Push notification · tam KPI dashboard · tam şəkil qalereyası persistensiyası (backend `sekil_url` hazırda tək şəkil saxlayır — form 4 şəkil göstərir, birincisi yazılır) · real store icon/splash dizaynı · `mobil-faza1` branch-ın main-ə merge-i + Vercel `MOBILE_JWT_SECRET`.
