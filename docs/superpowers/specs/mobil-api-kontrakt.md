# Mobil API Kontraktı — `/api/mobile/v1/**` (Faza 1A)

Bütün endpoint-lər JSON. Auth tələb edənlər `Authorization: Bearer <accessToken>` header gözləyir.
Base URL: prod `https://www.360biznes.az`, lokal `http://localhost:3500`.

Access token ömrü **15 dəq** → 401 alındıqda `refresh` ilə yenilə. Refresh token ömrü **30 gün** (DB-də revoke oluna bilən). Tokenlər RN-də **SecureStore**-da saxlanmalı.

---

## Auth

### POST `/api/mobile/v1/auth/login`
Auth: yox.
Request: `{ "email": string, "password": string, "cihaz"?: string }`
200: `{ "accessToken": string, "refreshToken": string, "user": { id, email, ad_soyad, sahibkar_id, sahibkar_ad, rol_id, rol_ad, plan_kod, plan_ad, abune_bitme, abune_status } }`
401: `{ "error": "Email və ya şifrə yanlışdır" }`

### POST `/api/mobile/v1/auth/refresh`
Auth: yox (refresh token body-də).
Request: `{ "refreshToken": string }`
200: `{ "accessToken": string, "refreshToken": string }` (refresh rotasiya olunur — köhnəsi revoke, yenisi qaytarılır)
400: `{ "error": "refreshToken yoxdur" }` · 401: `{ "error": "Sessiya bitib, yenidən daxil olun" }`

### POST `/api/mobile/v1/auth/logout`
Request: `{ "refreshToken": string }` → 200: `{ "ok": true }` (refresh revoke olunur). Client access token-i də silməlidir.

### GET `/api/mobile/v1/me`
Auth: Bearer. 200: `{ "user": { id, ad_soyad, email, vezife, roles: { ad } }, "rol_ad": string, "icazeler": string[] }`
401: `{ "error": "Unauthorized" }` (token yox/yanlış/bitmiş)

---

## Məhsul (Anbar)

### GET `/api/mobile/v1/mehsullar?q=<axtarış>&page=<n>`
Auth: Bearer + icazə `mehsul.oxu`/`anbar.oxu` (sahibkar/admin/owner/direktor bypass).
200: `{ "items": Product[], "total": number }` (səhifə başına 20; pagination `page`).
İcazə yoxdursa: `{ "error": "İcazə yoxdur", "items": [], "total": 0 }`.

### POST `/api/mobile/v1/mehsullar`
Auth: Bearer + `mehsul.yarat`. Body: ProductSchema sahələri (məcburi: `ad`; `satis_qiymeti` default 0; maya YOX — alışdan gəlir). Qiymət sahələri yalnız `qiymet.duzelt` icazəsi varsa tətbiq olunur.
200: `{ "ok": true, "id": string, "pending_approval"?: boolean }`

### GET `/api/mobile/v1/mehsullar/[id]`
Auth: Bearer + `mehsul.oxu`/`anbar.oxu`. 200: `{ "item": ProductDetail }` (detal — qiymət pillələri, stok, və s.).

### PUT `/api/mobile/v1/mehsullar/[id]`
Auth: Bearer + `mehsul.duzelt`. Body: ProductSchema sahələri. Qiymət dəyişikliyi `qiymet.duzelt` tələb edir (yoxdursa qiymət sahələri mövcud dəyərdə saxlanır).
200: `{ "ok": true, "id": string }`

### GET `/api/mobile/v1/mehsullar/barkod/[code]`
Auth: Bearer. Barkod/kod üzrə məhsul tapır (scanLookup). 200: scan nəticəsi (məhsul və ya null).

---

## Şəkil yükləmə

### POST `/api/mobile/v1/upload`
Auth: Bearer. `multipart/form-data`, sahə `file` (JPEG/PNG/WebP, maks 4 MB).
200: `{ "url": string }` (prod Vercel Blob, lokal `/uploads/...`). Bu URL məhsul `sekil_url`-ə yazıla bilər.

---

## Ümumi qaydalar (RN tərəfi)
- 401 → access token bitib → `refresh` çağır, alınsa sorğunu təkrarla; refresh də 401 olarsa login-ə yönəlt + tokenləri sil.
- Tenant izolyasiyası tokendən avtomatik (sahibkar_id) — client heç bir tenant param göndərmir.
- Bütün sorğularda `Content-Type: application/json` (upload istisna — multipart).
- Şəbəkə xətası/timeout → retry düyməsi (TanStack Query retry).

## Faza 1A-da OLMAYAN (sonrakı fazalar)
Satış/POS, müştəri, maliyyə, bildiriş/push, axtarış (qlobal), hesabat endpoint-ləri.
