# 360Biznes Mobil Tətbiq — Dizayn Sənədi

**Tarix:** 2026-06-11
**Status:** Təsdiq gözləyir → təsdiqdən sonra Faza 1 implementasiya planı
**Layihə:** 360biznes-next (mövcud Next.js 16 ERP) üçün professional iOS + Android mobil tətbiq

---

## 1. Məqsəd və prinsiplər

Mövcud 360Biznes ERP web platforması üçün **App Store və Google Play-ə yerləşdirilə bilən, professional React Native mobil tətbiq**.

- Mövcud **sayt, backend və database saxlanılır** — mobil app eyni datadan istifadə edir.
- **WebView app DEYİL** — əsas ekranlar native mobil UI. (WebView yalnız statik səhifələr üçün: Privacy Policy, Terms, Help.)
- **Bir kod bazası** ilə həm iOS, həm Android (Expo + React Native).
- Mövcud login sistemi ilə uyğun, lakin **token-əsaslı** (mobil üçün).
- Modern, təmiz, sürətli, hamının rahat işlədə biləcəyi (10/10 UX).

---

## 2. Texnoloji qərarlar (təsdiqlənib)

| Qərar | Seçim | Səbəb |
|---|---|---|
| Mobil framework | **Expo (dev-client/prebuild)** | EAS Build (iOS/Android), OTA update, hazır native modullar (kamera, QR, push, SecureStore), ən az problem, store-uyğun |
| Repo yeri | **`360biznes-next/mobile/`** | Eyni repo — API tip/kontrakt paylaşımı; Vercel yalnız Next-i build edir, EAS `mobile/`-i ayrıca |
| Faza 1 ilk dilim | **Anbar / Məhsul** | Artıq dizayn olunub; native funksiyaların çoxunu (kamera, QR, upload) sınamağa imkan verir; self-contained |
| Backend dili | Mövcud Next.js route handler-ləri (`/api/mobile/v1/**`) | Server action-lar RN-dən çağırıla bilmir |
| Auth | JWT access (15 dq) + refresh token (DB) | NextAuth cookie mobil üçün uyğun deyil |

**Texnologiya yığını:**
- Expo SDK (RN), TypeScript, **Expo Router** (file-based naviqasiya; bottom tabs + native stack daxildə React Navigation)
- **TanStack Query** (server state, cache, offline, retry) + Axios (Bearer + avto-refresh interceptor)
- **expo-secure-store** (token), **expo-camera** + **expo-barcode-scanner** (QR/barkod), **expo-image-picker** (qalereya/kamera), **expo-notifications** (push), **expo-linking** (zəng/WhatsApp), **expo-image** (preview/cache)
- İkon dəsti: **lucide-react-native** (web ilə eyni ailə)
- Dizayn: **NativeWind** (Tailwind RN — web ilə eyni düşüncə tərzi) + mərkəzi tema (rəng/spacing token-ləri)

---

## 3. Memarlıq (3 qat)

```
┌─────────────────────────────┐   HTTPS + Bearer JWT   ┌──────────────────────────────┐
│  RN App (Expo)              │ ─────────────────────> │  /api/mobile/v1/**  (Next)   │
│  • Naviqasiya, ekranlar     │ <───────────────────── │  • getMobileSession(req)     │
│  • TanStack Query + Axios   │      JSON              │  • token auth + tenant+rol   │
│  • SecureStore (token)      │                        │  • ortaq service/query funks. │
│  • native modullar          │                        └──────────────┬───────────────┘
└─────────────────────────────┘                                       │
                                                          mövcud Prisma + Neon DB + balans/recalc helper-ləri
```

### 3.1 Mobil API qatı — `/api/mobile/v1/**`
- **Auth:**
  - `POST auth/login` — email+şifrə → mövcud `authorize` məntiqi (LoginSchema, `checkLoginRate`, `prismaUnscoped.istifadeciler`, `verifyPassword`, tenant+abunə yoxlaması) → `{ accessToken, refreshToken, user }`. JWT `jsonwebtoken` (HS256, `MOBILE_JWT_SECRET`), payload: `{ sahibkar_id, istifadeci_id, rol_id, rol_ad }` (icazələr YOX — DB-dən).
  - `POST auth/refresh` — refresh token → yeni access token.
  - `POST auth/logout` — refresh token-i revoke et.
  - `GET me` — cari istifadəçi + icazə kodları + abunə/plan.
- **getMobileSession(req)** helper — `Authorization: Bearer` parse, JWT verify, `runWithTenant({sahibkarId, istifadeciId, rolId, rolAd, icazeler})` ilə kontekst qurur. Bütün mobil route-lar bunu çağırır + icazə yoxlaması (mövcud `requireXActionPerm` məntiqi token-aware adaptasiya). proxy.ts matcher-i `/api/mobile`-ı public-prefix kimi keçirir (route özü Bearer yoxlayır).
- **CRUD route-ları** mövcud `features/**/queries.ts` + mutasiya məntiqini işlədir. Server action-ların biznes məntiqi ortaq **service** funksiyalarına çıxarılır ki, həm web action, həm mobil REST eyni qaynağı çağırsın (kod təkrarı yox, davranış 1:1).

### 3.2 Refresh token saxlama
- Yeni additiv cədvəl `mobil_refresh_tokens` (sahibkar_id, istifadeci_id, token_hash, cihaz, expires_at, revoked_at). Additiv migration (məlumat itkisi yox → prod db push təhlükəsiz). Logout/şübhəli hal = revoke.

### 3.3 Push
- **expo-notifications** + Expo Push Service. `POST mobile/v1/push/register` (Expo push token saxla — istifadeciler-ə sütun və ya ayrı cədvəl). Server hadisədə (yeni satış, kritik stok, borc, tapşırıq) Expo push göndərir.

---

## 4. Dizayn sistemi (kilidlənib)

- **Üslub:** Təmiz & İşıqlı (ağ/açıq fon, yumşaq kartlar, səxavətli boşluq).
- **Rəng:** Emerald-Teal yaşıl — `#0f766e`/`#0d9488` (primary, gradient), açıq fon `#ccfbf1`/`#d1fae5`. Sakit, gözə rahat. Müsbət=yaşıl, mənfi=qırmızı (#dc2626), xəbərdarlıq=amber.
- **İkonlar:** lucide-react-native (incə xətti, modern).
- **Komponentlər:** sticky əsas düymə, barmaq-dostu ölçülər, kart-əsaslı siyahı, akkordeon (detal), chip filter, bottom-sheet seçim, skeleton loading.
- **Naviqasiya:** Bottom tabs — **Ana · Satış · ➕(FAB) · Bildiriş · Menyu**. Daxili keçidlər native stack. Web menyusu KOPYALANMIR — mobil üçün ayrıca, sadə.

---

## 5. Ekran inventarı (14)
Splash · Login/Register · Dashboard (KPI + sürətli düymələr + son əməliyyatlar) · Bottom-tab naviqasiya · Profil · Ayarlar (bildiriş toggle, tema, Face ID, Privacy/Terms/Support, versiya) · Bildirişlər (qruplu, oxunmamış) · Siyahı (axtarış+filter+infinite scroll) · Detal (akkordeon: son hərəkətlər, servis tarixçəsi, statistika, ətraflı) · Yeni form (çox-şəkil, "Ətraflı" bölmə, maya YOX) · Redaktə form · Axtarış (qlobal, tipə görə qruplu) · Şəkil yükləmə (preview) · Hal ekranları (loading skeleton / empty / error+retry / offline banner).

**Məhsul forması prinsipi:** yalnız əsas sahələr görünür (şəkillər · ad · satış qiyməti · kateqoriya); barkod/kod/marka/vahid/rəng/təsvir/stok-limit/serial-IMEI → **"Ətraflı"** altında. **Maya əl ilə yazılmır** — ilk alış qaiməsindən təyin olunur (ERP prinsipi). 3-4 şəkil.

---

## 6. Native funksiyalar
Push notification · kamera ilə şəkil · qalereyadan şəkil · şəkil yükləmə (preview) · QR scan · barkod scan · telefona klik → zəng · WhatsApp link · location (lazım olan yerdə) · offline/zəif internet xəbərdarlığı + retry · app-içi bildiriş (toast/banner).

---

## 7. Təhlükəsizlik
- Token SecureStore-da (Keychain/Keystore). API çağırışları Bearer ilə.
- Access qısa-ömürlü; refresh DB-də revoke oluna bilən. Logout = token təmizlə + refresh revoke.
- Tenant izolyasiyası API-də token-dən (`getMobileSession` → runWithTenant). Rol/icazə mobil-də də tətbiq (qorunan ekran/əməliyyat icazəsiz açılmır).
- 401-də avto-refresh, alınmasa login-ə.

---

## 8. Store hazırlığı
App icon · splash · app name (360Biznes) · bundle ID (`az.360biznes.app`) / package name · version+build sistemi (EAS) · Privacy Policy + Terms + Support URL (web-də səhifələr) · store screenshots · description · keywords · release notes · icazə izah mətnləri (kamera/şəkil/bildiriş/location — Info.plist + AndroidManifest).

---

## 9. Fazalama (yol xəritəsi)

**Faza 1 — TƏMƏL + Anbar/Məhsul dilimi** *(bu spec-in implementasiya hədəfi)*
- Mobil API: `auth/login|refresh|logout|me`, `getMobileSession`, `mobil_refresh_tokens` migration, proxy gating.
- Anbar/Məhsul REST: list+axtarış+filter (pagination), detal (+son hərəkət, servis, statistika), yarat/redaktə, şəkil upload (mövcud Blob), barkod lookup.
- RN scaffold: Expo, naviqasiya, dizayn sistemi (tema/ikon), Splash, Login, Dashboard (oxu), Məhsul siyahı/detal/form, kamera+qalereya+barkod skan, hal ekranları.
- EAS build: Android internal testing + iOS TestFlight (real cihaz testi).

**Faza 2** — Satış/POS + kassa (stok/borc/kassa bütövlüyü ilə).
**Faza 3** — Müştəri/Əlaqə (siyahı/detal/yarat, borc, zəng/WhatsApp).
**Faza 4** — Maliyyə (xərc, əməliyyat, hesablar).
**Faza 5** — Bildirişlər + Push (Expo push infra, token save, göndərmə).
**Faza 6** — Tapşırıq, Hesabat (oxu), Profil/Ayarlar tam, Axtarış (qlobal).
**Faza 7** — Store submission (icon/splash/screenshots/metadata/privacy/terms, review).

Hər faza ayrıca spec → plan → implementasiya → test dövrü.

---

## 10. Test strategiyası
Hər faza: Android emulator + real Android, iPhone simulator + real iPhone. Ayrıca test: login, şəkil yükləmə, push, QR scan, form submit, search/filter, naviqasiya, zəif internet/offline. Build-dən əvvəl bütün crash/səhv düzəldilir.

---

## 11. Əhatədən kənar (bu mərhələdə)
- Web platformasının dəyişdirilməsi (yalnız mobil API əlavə olunur).
- WebView yalnız Privacy/Terms/Help statik səhifələri üçün.
- Offline-first tam sinxronizasiya (Faza 1-də yalnız keş + retry; tam offline yazma sonrakı fazada nəzərdən keçirilə bilər).
