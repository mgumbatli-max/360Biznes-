# TAM ERP QA TEST HESABATI — 360Biznes

> **Qayda:** Bu auditdə HEÇ BİR kod dəyişdirilməyib. Düzəlişlər sizin təsdiqinizi gözləyir.

## 1-3. Ümumi məlumat
- **Tarix:** 2026-06-11
- **Branch/Environment:** main (lokal dev :3500 + kod auditi; prod = eyni commit-lər)
- **Metod:** 16 sahə üzrə paralel kod-auditi (116 agent, 1876 yoxlama) + hər kritik/orta tapıntının adversarial təsdiqi + 51 səhifəlik canlı Playwright smoke + 2 bug-un canlı reproduksiyası
- **Yoxlanılan modullar:** Auth/Session/İcazə/Multi-tenant, POS, Ticarət (satış lifecycle), Ödəniş allokasiyası/Borc, Anbar/Stok, Maliyyə, Marketplace, Kredit satışı, Əlaqələr/Müştəri 360, Servis, Əməkdaşlar/KPI/Maaş, Tapşırıqlar, Hesabatlar, Soft-delete, Siyahı dizaynı/Performans, Error handling/UI

## 4-8. Say xülasəsi
- **Keçən yoxlamalar:** 128 təsdiqlənmiş düzgün davranış
- **Tapılan bug (xam):** 117 → adversarial təsdiqdən keçən: **93 kritik/orta** + 17 kiçik
- **Kritik:** 33  |  **Orta:** 59  |  **Kiçik:** 17
- **Canlı smoke:** 51 səhifə → 48 təmiz, 2 real bug (aşağıda CANLI-1/2), 1 qəsdən redirect

## ⛔ NƏTİCƏ (bənd 19): SİSTEM HAZIR DEYİL
33 kritik bug var — bunlardan pul/stok/borc bütövlüyünə təsir edənlər real biznes istifadəsini bloklayır. Sizin 23-cü bölmə qəbul şərtlərindən ən azı bunlar POZULUR: #6/#7 (ödəniş allokasiyası — qismən), #8/#9 (silinmə reverse — K11/K12/K32), #10 (qaytarma — K9/K11/K23), #12 (hesab balansları — K19/K20), #13 (eyni borc hər yerdə — K13/K31), #15 (maaş — K27/K28/K29), #18 (icazə backend — K1/K2/K5), #30/#31 (console/server error — CANLI-1/2).

======================================================================

## 6. KRİTİK BUGLAR (33 + 2 canlı = 35)

### CANLI-1 [KRİTİK] /kampaniyalar/loyalty — səhifə 500 (yetim data)
- **Addımlar:** Əsas hesabla (m.gumbatli) /kampaniyalar/loyalty aç
- **Faktiki:** PrismaClientUnknownRequestError — 'Field kontragentler is required, got null'
- **Səbəb:** DB-də 3 yetim loyalty kartı (kontragent yoxdur; FK var, yetimlər köhnə restore-dan qalıb). include required relation → crash
- **Təsir:** Kampaniyalar/Loyalty tam əlçatmaz (owner tenant)
- **Düzəliş:** yetim qeydləri təmizlə (SQL) + sorğuda yetimə dözümlü include

### CANLI-2 [ORTA] /hesabatlar/marja — bucket paneli sınıq
- **Səbəb:** getMarjaBuckets raw SQL `ORDER BY CASE bucket` — PostgreSQL ORDER BY ifadəsində SELECT alias qadağandır (42703). Eyni pattern musteri-queries.ts:239
- **Düzəliş:** ORDER BY-da alias əvəzinə tam CASE ifadəsi / subquery

### K01 [Əməkdaşlar / Maaş (HR)]
**Maaş bordrosu (bütün işçilərin maaşı) yalnız isci.view ilə görünür və export oluna bilir — maas.view tələb olunmur**
- **Səhifə/Fayl:** app/(dashboard)/iscilier/maas/page.tsx + features/iscilier/maas-export.ts + features/iscilier/maas-queries.ts (getMaasTable)
- **Gözlənilən:** Yalnız maas.view / maas.idare icazəsi olan və ya HR-privileged (sahibkar/admin/direktor) istifadəçi /iscilier/maas səhifəsini görə və exportMaasExcel ilə bütün əməkdaşların maaş/vergi/bonus məlumatını ixrac edə bilməlidir (iscilier/[id] səhifəsindəki canViewSalary kimi).
- **Faktiki:** MaasPage komponenti birbaşa getMaasTable() çağırır — heç bir requireHrPagePerm/canViewSalary yoxlaması yoxdur. getMaasTable yalnız withTenant + requireTenant edir, rol/icazə yoxlamır. exportMaasExcel server action-u da heç bir guard çağırmır. Yeganə maneə layout-dakı gateRoute-dur, o isə /iscilier üçün yalnız isci.view|isci.idare|hr.view tələb edir — maas.view YOX. Beləliklə, sadəcə işçi siyahısını görə bilən adi əməkdaş (isci.view) /iscilier/maas URL-inə keçərək bütün şirkətin maaş cədvəlini görür və Excel-ə ixrac edir.
- **Səbəb:** maas/page.tsx-də səhifə guard-ı yoxdur; getMaasTable və exportMaasExcel data qatında maas.view yoxlamır; route-gate.ts-də /iscilier qaydası alt-route maas üçün dar icazə (maas.view) tələb etmir. iscilier/[id]/page.tsx-də canViewSalary istifadə olunur, amma maas səhifəsində eyni nümunə tətbiq edilməyib (tutarsızlıq).
- **Təsir:** HR, Maliyyə, məxfilik. Bütün əməkdaşların əmək haqqı, vergi, sosial sığorta, bonus, cərimə məlumatları icazəsiz işçilərə açılır.
- **Düzəliş tövsiyəsi:** maas/page.tsx başında `await requireHrPagePerm('maas.view')` çağır VƏ getMaasTable/exportMaasExcel daxilində maas.view|maas.idare yoxlaması (HR-privileged xaric) əlavə et. Davamiyyet/budce/kpi/mezuniyyet alt-səhifələrini də eyni qaydada yoxla.

### K02 [Ayarlar / Filial & İstifadəçi-filial icazələri]
**saveFilialUserPerm: icazə YOXLAMASI YOX + cross-tenant yazma (istifadeci_filial sahibkar_id daşımır və tenant filtri yoxdur)**
- **Səhifə/Fayl:** features/ayar/actions.ts — saveFilialUserPerm (sətir 706)
- **Gözlənilən:** Yalnız admin/sahibkar (ayar.idare/ayar.rol_idare) öz tenant-ındakı istifadəçilərə filial-səviyyə icazə (bax_biler, satish_biler, kassa_biler, gizli_alish_biler, qiymet_biler və s.) verə bilməlidir; başqa tenant-ın istifadəçisinə toxunmaq mümkün olmamalıdır.
- **Faktiki:** saveFilialUserPerm heç bir requireAyarActionPerm çağırmır. prisma.istifadeci_filial.update() çağırışı attacker-kontrollu istifadeci_id (istənilən UUID) + filial_id ilə composite key (istifadeci_id_filial_id) üzərindən gedir. istifadeci_filial modelində sahibkar_id sütunu YOXDUR və o, TENANT_MODELS siyahısında DEYİL — yəni Prisma extension bu modeli avtomatik filtrlə Mİ. Beləliklə tenant izolyasiyası heç bir qatda tətbiq olunmur: A tenant-ındakı istənilən autentifikasiyalı istifadəçi B tenant-ının istifadəçisinin filial icazələrini dəyişə bilər (composite cüt mövcud olduqda).
- **Səbəb:** Server action-da rol/icazə yoxlaması yoxdur (yalnız withTenant — o isə icazə yox, sadəcə kontekst qurur). istifadeci_filial cədvəlində sahibkar_id olmadığı üçün tenant extension qoruya bilmir və action özü də where-də sahibkar_id-ə görə yoxlama (məs. istifadəçinin tenant-a aid olub-olmadığı) etmir.
- **Təsir:** Çox-tenant izolyasiyası, İcazə/Rol sistemi, Maliyyə (kassa/gizli alış icazəsi), Anbar (stok dəyişmə icazəsi). Həm cross-tenant, həm də öz-tenant daxilində privilege escalation.
- **Düzəliş tövsiyəsi:** 1) Action başında `requireAyarActionPerm('ayar.idare')` əlavə et. 2) Update-dən əvvəl hədəf istifadəçinin tenant-a aidliyini yoxla: prisma.istifadeciler.findFirst({ where: { id: istifadeci_id, sahibkar_id } }) və filialın da sahibkar_id ilə uyğunluğunu. Yaxşısı: istifadeci_filial cədvəlinə sahibkar_id sütunu əlavə edib TENANT_MODELS-ə yaz.

### K03 [Marketplace / Public API (multi-tenant API binding)]
**Public marketplace API həmişə 500 verir: verifyApiKey/getKanalExtraServer scoped prisma ilə tenant modelini (ayarlar) tenant konteksti OLMADAN sorğulayır → [tenant-guard] throw**
- **Səhifə/Fayl:** app/api/v1/marketplace/products/route.ts + orders/[kanal]/route.ts (verifyApiKey @ features/qiymet-kanal/api-key-actions.ts:125, getKanalExtraServer @ features/qiymet-kanal/kanal-extra.ts:44)
- **Gözlənilən:** Xarici platforma (Wolt, Tap.az, sayt) ?key=...&kanal=... ilə məhsul feed-i / sifariş göndərə bilməlidir; API key doğrulanıb həmin sahibkarın datasına runWithTenant ilə girilməlidir.
- **Faktiki:** Route GET/POST əvvəlcə verifyApiKey(key, kanal) çağırır — bu funksiya `prisma.ayarlar.findMany(...)` (SCOPED client) işlədir. Bu çağırış runWithTenant-dən KƏNARDA (ondan əvvəl) baş verir. ayarlar TENANT_MODELS-dədir; tenant konteksti olmadığı üçün Prisma extension `[tenant-guard] No tenant in context for ayarlar.findMany` throw edir. verifyApiKey-də (və route-da) bu çağırışın ətrafında try/catch yoxdur → 500 Internal Error. getKanalExtraServer də eyni problemi yaradır (prisma.ayarlar.findUnique, kontekstdən kənar). Nəticədə bütün xarici marketplace inteqrasiyası işləmir.
- **Səbəb:** verifyApiKey və getKanalExtraServer prismaUnscoped əvəzinə scoped prisma istifadə edir, halbuki onlar tenant konteksti qurulmamış public API axınında, runWithTenant-dən əvvəl çağırılır. Tenant extension fail-closed olduğu üçün throw edir.
- **Təsir:** Marketplace inteqrasiyası (məhsul sinxron, sifariş qəbulu), kanal qiymət/stok feed-i — tam funksional sıradan çıxma. Eyni zamanda multi-tenant API binding qatında ciddi defekt.
- **Düzəliş tövsiyəsi:** verifyApiKey və getKanalExtraServer içində prisma əvəzinə prismaUnscoped işlət (explicit sahibkar_id/where ilə) — onsuz da bu funksiyalar tenant müəyyən etmək üçündür, kontekstdən kənar işləməlidir. Bunu inteqrasiya testi ilə (real GET /api/v1/marketplace/products?key=..&kanal=..) təsdiqlə.

### K04 [Auth / Session]
**Rol dəyişikliyi / deaktivasiya / silinmə mövcud JWT sessiyasını ləğv etmir — köhnə rol_ad/aktiv 7 günə qədər qüvvədə qalır**
- **Səhifə/Fayl:** auth.ts (jwt/session callbacks, maxAge 7d) + features/ayar/actions.ts (changeUserRole, toggleUserField aktiv=false, deleteUser)
- **Gözlənilən:** İstifadəçinin rolu aşağı salınanda və ya hesabı deaktiv/silinəndə onun cari sessiyasındakı imtiyazlar dərhal (və ya çox qısa müddətdə) ləğv olmalıdır.
- **Faktiki:** Session JWT strategiyası ilədir (maxAge 7 gün). rol_ad və rol_id login zamanı token-ə yazılır; jwt callback yalnız `if(user) Object.assign(token,user)` edir, hər istəkdə DB-dən təzələmir. changeUserRole/toggleUserField(aktiv=false)/deleteUser DB-ni yeniləyir, lakin signOut/sessiya ləğvi etmir. auth() yalnız JWT imzasını yoxlayır — `aktiv` statusunu DB-dən təkrar yoxlamır (aktiv yoxlaması yalnız login-də var). gateRoute və bütün isXxxPrivileged() yoxlamaları session.user.rol_ad-a baxır. Beləliklə: admin→kassir endirilən istifadəçi 7 günə qədər tam admin girişini saxlayır; deaktiv/silinən istifadəçi (soft-delete) 7 günə qədər işləyən sessiya ilə girişdə qalır. Qeyd: getRequestPermissions() privileged olmayan rollar üçün icazə kodlarını DB-dən təkrar yükləyir (300s cache + refresh-perms endpoint), ona görə kod-səviyyə icazələr yenilənir — amma ən güclü yol olan rol_ad-əsaslı privileged bypass köhnə token-dən gəlir.
- **Səbəb:** JWT-də session-version/revocation mexanizmi yoxdur; istifadeci_sessiya cədvəli mövcuddur (tenant model) amma sessiya doğrulamasında istifadə olunmur; rol dəyişdirən action-lar token invalidation tetikləmir.
- **Təsir:** Auth/Session, İcazə/Rol. Demoted/deaktiv edilmiş istifadəçinin imtiyazlarının davam etməsi.
- **Düzəliş tövsiyəsi:** JWT-yə monotonic `token_version` (və ya son_sifre_deyis/rol_yenilenme timestamp) əlavə et; jwt callback-də (trigger==='update' deyil, hər istəkdə deyilsə də müəyyən intervalla) DB-dəki istifadəçinin aktiv+rol_id+version-u ilə müqayisə et, uyğunsuzluqda session-u boşalt. Minimum: kritik rol/deaktiv əməliyyatından sonra həmin istifadəçinin sessiyasını məcburi sonlandır.

### K05 [Ayarlar / Risk qaydaları, Rol qiymət-tier, POS qiymət]
**Admin-yalnız təhlükəsizlik/qiymət ayarları server action-larında icazə yoxlaması yoxdur — istənilən autentifikasiyalı istifadəçi dəyişə bilər**
- **Səhifə/Fayl:** features/ayarlar/risk-rules-actions.ts (saveRiskRules), qiymet-icaze-actions.ts (saveRoleAllowedTiers), pos-qiymet-actions.ts (savePosPriceSettings)
- **Gözlənilən:** Risk qaydaları (məs. maya altı satışın bloklanması, borc limiti davranışı, sayım anomaliya həddi), rol-qiymət-tier icazələri və POS qiymət ayarları yalnız admin/sahibkar tərəfindən dəyişdirilə bilməlidir.
- **Faktiki:** Hər üç action withTenant ilə tenant-izolyasiyalı altqatı (setRiskRules/setRoleAllowedTiers/setPosPriceSettings) çağırır — cross-tenant sızma yoxdur, amma heç biri rol/icazə yoxlamır. /ayarlar səhifələri gateRoute ilə qorunsa da, server action birbaşa çağırıla bilir. Nəticədə adi istifadəçi (məs. satıcı/kassir) maya-altı satış blokunu söndürə, rol qiymət-tier icazələrini dəyişə və ya POS qiymət davranışını manipulyasiya edə bilər.
- **Səbəb:** Backend action-larda requireAyarActionPerm çağırışı yoxdur (NO-GUARD); frontend-only enforcement. risk-rules-actions audit() çağırır amma icazə yoxlamır.
- **Təsir:** Maliyyə/satış risk nəzarəti, qiymət siyasəti, İcazə. Biznes qaydalarının icazəsiz dəyişdirilməsi.
- **Düzəliş tövsiyəsi:** saveRiskRules → requireAyarActionPerm(['ayar.idare']); saveRoleAllowedTiers → requireAyarActionPerm('ayar.rol_idare'); savePosPriceSettings → requireAyarActionPerm(['ayar.qiymet','ayar.idare']). Nəticəni yoxlayıb error qaytar.

### K06 [POS / Maliyyə / Kassa]
**Qarışıq (cash+kart+bank) ödəniş tam NAĞD kimi yazılır — kassa hesabatı və gün-sonu uyğunsuzdur**
- **Səhifə/Fayl:** features/pos/sale-action.ts (sətir 280-352) + features/pos/components/pos-client.tsx (sətir 930-937)
- **Gözlənilən:** Qarışıq ödənişdə hər hissə (nağd/kart/bank) öz növü ilə kassa_emeliyyatlari-yə və müvafiq maliye hesabına yazılmalıdır; gün sonu kassa nağdı yalnız nağd hissəni gözləməlidir.
- **Faktiki:** pos-client serverOdenis-i hesablayanda qarisiq→'negd' edir (sətir 930-937), split-lər yalnız `qeyd` mətnində qalır. sale-action.ts isə son_mebleg-in TAMAMINI tək kassa_emeliyyatlari sətrində odenis_nov='negd' kimi yazır. Kart/bank hissələri itir.
- **Səbəb:** pos-client.tsx: `paymentMethod==='qarisiq' ? ... : 'negd'` — qarışıq nağda yıxılır, splitNegd/splitKart/splitBank server-ə ötürülmür. sale-action yalnız bir kassa əməliyyatı + bir finance_operations yaradır.
- **Təsir:** kassa (cari_negd şişir), maliyyə (finance_operations səhv hesaba), gün-sonu reconciliation (closeKassa expected = açılış + SUM(negd) → kassirin kassasında kart/bank məbləği qədər 'çatmazlıq' fark görünür), maliyyə hesabatları (P&L doğru, amma hesab balansları yanlış).
- **Düzəliş tövsiyəsi:** Server-ə split məbləğlərini ötür və qarışıqda hər metod üçün ayrıca kassa_emeliyyatlari + finance_operations yarat (uyğun hesab_id ilə). Yaxud minimum: qarışıqda yalnız nağd hissəni 'negd', qalanı 'kart'/'kecirme' sətri kimi yaz.

### K07 [POS / Kampaniya / Loyalty (offline replay & double-submit)]
**İdempotent təkrar göndərişdə (offline drain / retry) kampaniya istifadəsi və loyalty bonusu QOŞA tətbiq olunur**
- **Səhifə/Fayl:** features/pos/sale-action.ts (sətir 135-148, 360-381) + features/pos/components/offline-banner.tsx (drainQueue) + features/kampaniyalar/matcher.ts (commitCampaignApplications)
- **Gözlənilən:** Eyni client_op_id ilə təkrar createSale mövcud satışı qaytaranda heç bir yan-təsir (campaign_usage, bonus accrual, finance) təkrar baş verməməlidir.
- **Faktiki:** Dup tapılanda transaction `{id: dup.id,...}` qaytarır (satış sətri/stok təkrarlanmır — yaxşı). LAKİN transaction-dan SONRAKI kod şərtsiz işləyir: commitCampaignApplications (sətir 374-381) yenidən campaign_usage CREATE edir, campaigns.current_uses INCREMENT edir, loyalty bonus ACCRUAL edir. Eyni şəkildə pos-client onComplete res.ok alınca applyBonusToSale-i təkrar çağırır (kartdan bonus təkrar SƏRF olunur). campaign_usage-də satis_id üzərində unique yoxdur (schema təsdiqləndi).
- **Səbəb:** Dedup yalnız transaction daxilində; post-commit yan-təsirlər dedup nəticəsini yoxlamır. campaign_usage.satis_id unique deyil; commitCampaignApplications mövcud usage-i yoxlamır (kor-koranə create).
- **Təsir:** kampaniya (current_uses şişir, max_uses limiti yanılır), loyalty (bonus balans qoşa artır/azalır), hesabat. Offline rejimdə bir neçə dəfə drain → çoxqat təkrar.
- **Düzəliş tövsiyəsi:** Post-commit yan-təsirləri yalnız satış HƏQİQƏTƏN bu çağırışda yarananda işlət (transaction-dan `isNew` bayrağı qaytar). commitCampaignApplications və applyBonusToSale-ə satis_id-əsaslı idempotentlik (campaign_usage(satis_id,campaign_id) unique / loyalty_tx mövcudluq yoxlaması) əlavə et.

### K08 [Kampaniya / Kupon]
**POS-da kupon tətbiq olunanda coupons.current_uses artırılmır — kupon limitsiz təkrar istifadə oluna bilər**
- **Səhifə/Fayl:** features/kampaniyalar/matcher.ts (commitCampaignApplications sətir 211-256) vs applyCoupon (sətir 268-329)
- **Gözlənilən:** Kupon satışda istifadə olunanda coupons.current_uses +1 olmalı; max_uses dolanda applyCoupon onu rədd etməli.
- **Faktiki:** applyCoupon current_uses>=max_uses yoxlayır, amma satış commit-ində yalnız campaigns.current_uses artırılır (matcher sətir 225). coupons.current_uses heç yerdə artırılmır (yalnız aktiv/deaktiv update və aggregate oxuma var). max_uses=1 olan kupon sonsuz dəfə işləyir.
- **Səbəb:** commitCampaignApplications kupon entity-sini bilmir (yalnız AppliedCampaign massivini alır); kupon→kampaniya əlaqəsi commit zamanı izlənmir.
- **Təsir:** kampaniya/marketinq (kupon büdcəsi/limiti pozulur), maliyyə (gözlənilməz endirim).
- **Düzəliş tövsiyəsi:** applied_campaigns-ə kupon id-sini daşı və commit zamanı coupons.current_uses-i increment et; transaction daxilində et.

### K09 [Hesabat — Pul axını / Dashboard]
**Qaytarma/refund kassada İKİ DƏFƏ işarə dəyişdirilir — refund pulu azaltmaq əvəzinə ARTIRIR (sign double-flip)**
- **Səhifə/Fayl:** features/hesabatlar/pul-queries.ts (getDailyCashFlow30, getCashFlowByPayment, getAccountBalances, getCashFlowSummary30) + features/dashboard/queries.ts (fetchTodayCashFlowRaw)
- **Gözlənilən:** Nəğd satış qaytarıldıqda (refund) kassadan pul ÇIXMALI, cash-flow xaric (outflow) artmalı və net azalmalıdır.
- **Faktiki:** Refund sətirləri kassaya MƏNFİ mebleg ilə yazılır: cancelSale `mebleg: new Prisma.Decimal(-sonMebleg)` (satis-actions.ts:333), fastReturn `mebleg: new Prisma.Decimal(-total)` (qaytarma-tez-actions.ts:247). Lakin pul-queries.ts xaric-i `SUM(CASE WHEN emeliyyat_nov IN ('qaytarma','mexaric') THEN mebleg END)` kimi hesablayır → xaric MƏNFİ olur. Sonra `net = totalIn − totalOut` → mənfi xaric çıxılınca net ARTIR. getCashFlowSummary30 opening-balance-də isə `WHEN emeliyyat_nov IN ('qaytarma','mexaric') THEN -mebleg` (line 96) → −(−total)=+total → açılış balansı da yanlış istiqamətdə artır. Dashboard fetchTodayCashFlowRaw eyni hatadır.
- **Səbəb:** İki ziddiyyətli konvensiya: kassa-queries.ts qaytarmanı medaxil-ə qoyub mənfi meblegə güvənir (düzgün), pul-queries.ts/dashboard isə qaytarmanı xaric kateqoriyasına salıb sanki mebleg müsbətdir kimi rəftar edir (yanlış). Eyni sətir iki modulda fərqli oxunur.
- **Təsir:** Pul axını hesabatı, dashboard günlük cash-flow, hesab balansları, runway/burn hesablamaları — refund-lar net pulu süni şəkildə şişirdir; biznes yanlış nağd vəziyyət görür.
- **Düzəliş tövsiyəsi:** Konvensiyanı vahidləşdir. Tövsiyə: refund sətirlərini MÜSBƏT mebleg + emeliyyat_nov='qaytarma' kimi sax­la VƏ bütün hesabatlarda qaytarmanı xaric kimi say (pul-queries.ts artıq belə fərz edir). VƏ YA mənfi saxlanırsa, pul-queries/dashboard-da qaytarmanı medaxil tərəfə (mənfi mebleg avtomatik azaldır) keçir, kassa-queries.ts ilə eyniləşdir. Hazırda iki modul bir-birinə zidd.

### K10 [Hesabat — Marja / Mənfəət]
**Qaytarılmış satışlar (status='qaytarilib') marja/mənfəət hesabatından çıxılmır — geri gələn mal hələ də gəlir+mənfəət kimi sayılır**
- **Səhifə/Fayl:** features/hesabatlar/marja-queries.ts (getMarjaKpi, getMarjaByCategory, getMarjaProducts, getMarjaByCustomer, getMarjaBuckets)
- **Gözlənilən:** Tam qaytarılan satışın gəliri və COGS-u marjadan çıxmalı; hissəvi qaytarmada qaytarılan miqdar proporsional çıxmalıdır.
- **Faktiki:** Bütün marja sorğuları yalnız `ss.status != 'legv'` filtrini tətbiq edir, `qaytarilib` statusunu İSTİSNA ETMİR. returnFullSale tam qaytarmada satışı status='qaytarilib' edir AMMA satis_sifaris_satirlari sətirlərinin miqdarını/cemi-ni dəyişmir (silmir). Nəticədə qaytarılmış satışın sətirləri tam revenue və COGS ilə marjada qalır. Heç bir sorğu qaytarma_sifarisleri/qaytarma_satirlari-ni çıxmaq üçün join etmir.
- **Səbəb:** marja-queries.ts satis_sifaris_satirlari üzərindən aqreqasiya edir, qaytarma sətirlərini nəzərə almır; status filtri `qaytarilib`-i buraxmır; hissəvi qaytarmada sətir miqdarı heç vaxt azaldılmır.
- **Təsir:** Mənfəət hesabatları, kateqoriya/məhsul/müştəri marjaları, loss-leader sayı, marja bucket-ları — hamısı qaytarılan malı satılmış kimi sayır → mənfəət şişir.
- **Düzəliş tövsiyəsi:** marja sorğularına `AND ss.status NOT IN ('legv','qaytarilib')` əlavə et VƏ qaytarma_satirlari üzrə qaytarılan revenue+COGS-u ayrıca çıx (net marja). Hissəvi qaytarma üçün ya sətir miqdarını azalt, ya qaytarma sətirlərini mənfi olaraq aqreqasiyaya daxil et.

### K11 [Ticarət — Qaytarma (bulk satış qaytarması)]
**returnFullSale ilə NƏĞD/KART satış tam qaytarıldıqda kassadan pul çıxışı qeydə alınmır (yalnız marketplace üçün finance reverse var)**
- **Səhifə/Fayl:** features/ticaret/qaytarma-tez-actions.ts → returnFullSale (sətir 456-530)
- **Gözlənilən:** Müştəri nəğd ödədiyi satışı qaytaranda mal stoka qayıdır VƏ ödədiyi pul kassadan refund olunur (kassa_emeliyyatlari mənfi sətir + finance_operations reverse).
- **Faktiki:** returnFullSale yalnız: (1) stoku artırır, (2) nisyə satışda odenilmis-ə virtual ödəniş əlavə edir, (3) YALNIZ `sale.marketplace_platform && komisyon>0` olduqda finance_operations reverse yazır. Adi nəğd/kart satış üçün heç bir kassa_emeliyyatlari refund və ya finance_operations reverse YOXDUR. fastReturn-də bu refund var (sətir 239-254), returnFullSale-də yoxdur — iki qaytarma yolu uyğunsuzdur.
- **Səbəb:** returnFullSale-də nəğd refund məntiqi yazılmayıb; yalnız marketplace payout reverse implementasiya olunub.
- **Təsir:** Kassa/hesab balansı, pul axını — nəğd satış 'Tam qaytar' düyməsi ilə qaytarıldıqda mal geri gəlir amma pul kassada qalmış görünür → kassa balansı və mənfəət şişir; müştəri pulu geri alıb amma sistem bunu görmür.
- **Düzəliş tövsiyəsi:** returnFullSale-ə fastReturn-dakı kimi nəğd/kart üçün kassa_emeliyyatlari (mənfi mebleg) + finance_operations reverse + recalculateAccountBalance əlavə et. İki qaytarma server-action-ı eyni maliyyə reverse helper-indən istifadə etməlidir.

### K12 [Ticarət — Satış ləğvi]
**Qaralama/təsdiq-gözləyən satışı ləğv etmək FANTOM stok mədaxili yaradır (stok heç vaxt azalmamışdı, amma ləğvdə artırılır)**
- **Səhifə/Fayl:** features/ticaret/satis-actions.ts → cancelSale (sətir 301-323)
- **Gözlənilən:** Yalnız stoku faktiki azaltmış satışlar (status: yeni/tamamlandi/gonderildi — mexaric edilmiş) ləğvdə stoku geri qaytarmalıdır.
- **Faktiki:** cancelSale yalnız `status==='legv'` yoxlayır, sonra qeyd-şərtsiz BÜTÜN sətirlər üzrə stoku increment edir + 'medaxil' anbar_hereketi yazır. Lakin satis-yeni-actions.ts stoku yalnız `!qaralama && !effectiveNeedsApproval` halında azaldır — yəni 'qaralama' və 'tesdiq_gozleyir' satışlarında mexaric heç vaxt baş verməyib. UI (sale-row-actions.tsx:50) ləğvi yalnız status='legv'-də gizlədir, qaralama/tesdiq_gozleyir üçün ləğv mümkündür. Bulk cancel (extra-actions.ts:103) də status filtrsiz cancelSale çağırır.
- **Səbəb:** cancelSale-də 'stok əvvəl azalıbmı' yoxlaması yoxdur — stok azalması və geri qaytarılması status-a görə fərqli şərtlərə bağlıdır, lakin ləğv bu asimmetriyanı nəzərə almır.
- **Təsir:** Anbar/stok modulu — qaralama və ya təsdiq-gözləyən satış ləğv edildikdə həmin məhsulların stoku süni artır; anbar_hereketleri-də saxta medaxil; stok hesabatları və reorder tövsiyələri pozulur.
- **Düzəliş tövsiyəsi:** cancelSale-də stok bərpasını yalnız stoku faktiki azaltmış statuslar üçün et (məs. status IN ('yeni','tamamlandi','gonderildi') VƏ qaralama=false). VƏ YA daha etibarlı: orijinal mexaric anbar_hereketi-nin mövcudluğunu (ref_nov='satis_sifarisi', ref_id=saleId) yoxla və yalnız onda geri qaytar.

### K13 [maliyye (dashboard / KPI)]
**Dashboard debitor_cem / alici_borcu SƏHV field oxuyur; kreditor_cem həmişə 0**
- **Səhifə/Fayl:** features/maliyye/queries.ts:38-49 (fetchFinanceKpisRaw) + :135-144 (fetchMaliyyeDashboardKpisRaw)
- **Gözlənilən:** alici_borcu (debitor cəmi) müştərilərin alacaq cəmi olmalı; techizatci_borcu/kreditor_cem təchizatçı borc cəmi olmalı.
- **Faktiki:** alici/debitor müştərilər üçün kontragentler.borc oxuyur (WHERE nov IN (musteri,her_ikisi) AND borc>0). Lakin müştəri borcu alacaq field-ində saxlanılır (customer-balance.ts alacaq-a yazır), borc field-i təchizatçı borcudur (supplier-balance.ts borc-a yazır). Saf müştərilər üçün borc field-i təzələnmir → debitor KPI yanlış (çox güman 0 və ya təchizatçı tərəfli rəqəm). Eyni zamanda techizatci/kreditor ABS(SUM(LEAST(borc,0))) oxuyur — mənfi konvensiya gözləyir, halbuki supplier-balance.ts borc-u MÜSBƏT yazır (Math.max(0,...), supplier-balance.ts:64,91) → LEAST(borc,0)=0 → kreditor_cem HƏMİŞƏ 0.
- **Səbəb:** İki fərqli sign/field konvensiyası: SoT müştəri=alacaq(müsbət), təchizatçı=borc(müsbət); lakin KPI sorğuları köhnə model (müştəri borc>0, təchizatçı LEAST(borc,0)) ilə yazılıb və SoT yenilənməsi ilə uyğunlaşdırılmayıb. getTopDebtors (queries.ts:253) düzgün alacaq oxuyur — eyni dashboard-da iki fərqli rəqəm.
- **Təsir:** maliyye dashboard KPI kartları (debitor_cem, kreditor_cem, alici_borcu, techizatci_borcu) — rəhbər səhv ümumi borc/alacaq görür; getTopDebtors widget-i ilə ziddiyyət.
- **Düzəliş tövsiyəsi:** Müştəri debitoru üçün SUM(alacaq) WHERE nov IN (musteri,her_ikisi) AND alacaq>0 oxu; təchizatçı kreditoru üçün SUM(borc) WHERE nov IN (techizatci,her_ikisi) AND borc>0 (müsbət konvensiya) oxu — getDebtors/getCreditors canlı open-total məntiqi ilə eyniləşdir. Daha yaxşısı: KPI-ni də getDebtors/getCreditors canlı aggregate-indən derive et.

### K14 [elaqe (PaymentDialog → recordContactPayment)]
**Borclar/360 PaymentDialog ödənişi heç bir kassa/bank hesabını kreditləmir + çıxarışda görünmür**
- **Səhifə/Fayl:** features/elaqe/actions.ts:358-491
- **Gözlənilən:** Müştəridən gələn nəğd/kart/bank ödənişi həm borcu azaltmalı, həm uyğun maliye_hesablari qaliqını artırmalı, həm də hesab-çıxarışda görünməli.
- **Faktiki:** recordContactPayment finance_operations yaradır, amma hesab_id ümumiyyətlə təyin OLUNMUR (PaymentSchema:358-363-də hesab_id yoxdur; create:472-491-də hesab_id sahəsi yox). account-balance.ts qaliqı hesab_id üzrə SUM edir → hesab_id NULL olan daxil heç bir hesaba düşmür → pul aktiv tərəfdə itir, kassa balansı artmır. Üstəlik type_kod='musteri_odenis' (459) çıxarış sorğusunun type_kod IN ('qaime','borc_silinme') filtrindən (customer-statement.ts:79,115) kənarda qalır → bu yolla alınan ödəniş hesab-çıxarışda heç vaxt kredit kimi görünmür, son_qaliq şişir.
- **Səbəb:** İki paralel müştəri-ödəniş yolu: elaqe.recordContactPayment (type_kod='musteri_odenis', hesab_id yox) və maliyye.receivePartialPayment (type_kod='qaime', hesab_id var, idempotency var). recordContactPayment kassa kreditləməsini və düzgün type_kod-u tətbiq etmir.
- **Təsir:** maliye_hesablari qaliq (kassa/bank balansı), maliyye hesab-çıxarış son_qaliq, kitabların balanslaşması. Borc azalır amma aktiv tərəf itir.
- **Düzəliş tövsiyəsi:** recordContactPayment-i receivePartialPayment üzərinə birləşdir (FIFO+hesab+idempotency artıq var) və PaymentDialog-u ona yönəlt. Saxlanılırsa: PaymentSchema-ya hesab_id əlavə et, finance_operations-a hesab_id yaz + recalculateAccountBalance çağır, type_kod-u 'qaime' et və ya statement filtrinə 'musteri_odenis' əlavə et.

### K15 [maliyye (təchizatçı overpayment)]
**Təchizatçıya artıq ödəniş (overpayment) heç yerdə izlənmir — fərq səssizcə itir**
- **Səhifə/Fayl:** features/maliyye/actions.ts:1671-1745 (paySupplierAllOpen), 1804+ (paySupplierInvoice)
- **Gözlənilən:** Təchizatçıya açıq alış cəmindən çox ödəniş ediləndə fərq təchizatçı avansı/prepayment kimi qeyd olunmalı və ya icazə verilməməli.
- **Faktiki:** paySupplierAllOpen distribution yalnız açıq alışlara qədər tətbiq edir (totalApplied), lakin finance_operations azn_meblegh=d.mebleg (TAM məbləğ, 1737) yazır və hesabdan d.mebleg mexaric çıxır. Müştəri tərəfindəki avans field-inin analoqu təchizatçı üçün YOXDUR — fərq (d.mebleg - totalApplied) nə kontragentler-də, nə də allocation-da saxlanılmır. Kassa azalır, təchizatçı borcu yalnız totalApplied qədər düşür, qalan məbləğ izlənməz qalır.
- **Səbəb:** Təchizatçı avans/prepayment modeli yoxdur; overpayment qarşısı alınmır.
- **Təsir:** təchizatçı hesab-çıxarış (kassa mexaric > borc azalması), maliye_hesablari qaliq, kreditor balans uyğunluğu.
- **Düzəliş tövsiyəsi:** Overpayment-i ya bloklа (totalApplied < d.mebleg yoxlaması), ya da təchizatçı avansı kimi sahə/allocation-da saxla; finance_operations azn_meblegh-ini totalApplied ilə məhdudlaşdır və ya artıq hissəni ayrıca izlə.

### K16 [Ticaret / Təsdiq / Anbar / Maliyyə]
**Təsdiq tələb edən satış təsdiqdən sonra heç vaxt materiallaşmır — stok azalmır, kassa/maliyyə/müştəri borcu yaranmır**
- **Səhifə/Fayl:** features/ticaret/satis-yeni-actions.ts (createOrUpdateSatisYeni, sətir 314 `if(!data.qaralama && !effectiveNeedsApproval)`), features/tesdiq/actions.ts (propagateDocumentApproval, sətir 133-149), features/ticaret/satis-actions.ts (changeSaleStatus, sətir 209-252)
- **Gözlənilən:** 4-eyes (satis_qaime təsdiqi) və ya maya-altı təsdiqi tələb edən satış təsdiqlənəndən sonra: stok azalmalı, mexaric hərəkəti yazılmalı, ödəniş/borc və müştəri balansı yenilənməlidir.
- **Faktiki:** Satış `tesdiq_gozleyir` statusu ilə HEÇ BİR stok/maliyyə təsiri olmadan yaradılır (decrement bloku `!effectiveNeedsApproval` şərti ilə atlanır). Təsdiqdən sonra propagateDocumentApproval yalnız statusu `yeni`-yə dəyişir. Sonra istifadəçi 'Tamamla' düyməsini bassa da, changeSaleStatus YALNIZ status sahəsini dəyişir — stok azalmır, anbar_hereketleri/kassa/finance/müştəri-balansı yazılmır. Nəticədə satış siyahıda/hesabatda görünür amma stok azalmayıb, gəlir/borc qeydə düşməyib.
- **Səbəb:** createOrUpdateSatisYeni finalize blokunu yalnız yaratma anında işlədir; təsdiqdən sonra çağırılan ikinci-mərhələ finalize action MÖVCUD DEYİL. Koddakı şərh (sətir 308-312) 'Təsdiqdən sonra Tamamla düyməsi ilə finalize edilir (changeSaleStatus)' deyir, lakin changeSaleStatus stok/maliyyə icra etmir.
- **Təsir:** Anbar (stok şişir), Maliyyə (gəlir/kassa əksik), Müştəri borcu (nisyə yaranmır), Hesabatlar (satış/marja/pul axını yanlış), Audit (yarad logu var amma faktiki təsir yox).
- **Düzəliş tövsiyəsi:** approveRequest→propagateDocumentApproval içində satis_qaime üçün gerçək finalize çağır (stok decrement + mexaric + kassa/finance + recalculateCustomerBalance), VƏ YA changeSaleStatus tamamlandı/yeni keçidində 'hələ decrement olunmamış' satışları materiallaşdır. İdempotent qoruma üçün satışda `stok_emelidir` bayraq və ya mexaric hərəkətinin mövcudluğunu yoxla.

### K17 [Ticaret / Anbar]
**Çox-anbarlı satışın ləğvi/qaytarması bütün sətrləri yanlış anbara qaytarır**
- **Səhifə/Fayl:** features/ticaret/satis-actions.ts (cancelSale, sətir 302-323) və features/ticaret/qaytarma-tez-actions.ts (returnFullSale, sətir 432-453)
- **Gözlənilən:** Hər satış sətri hansı anbardan satıldısa (line.anbar_id), ləğv/qaytarmada stok məhz həmin anbara geri qayıtmalıdır.
- **Faktiki:** Satış sətri (satis_sifaris_satirlari) cədvəlində `anbar_id` SÜTUNU YOXDUR. Satış zamanı decrement per-sətir `line.anbar_id` ilə edilir (çox-anbar dəstəyi — UI-də 'çox-anbarlı dəstək', sətir-başı anbar seçici var). Lakin cancelSale və returnFullSale BÜTÜN sətrləri `sale.anbar_id` (başlıq = ilk sətrin anbarı) üzərinə qaytarır. A və B anbarından sətri olan satışın ləğvində B-nin malı A anbarına yazılır.
- **Səbəb:** Sətir səviyyəsində anbar saxlanmır; başlıqda yalnız bir `anbar_id` (primaryAnbar = data.lines[0].anbar_id, satis-yeni-actions sətir 249). Restore/return `sale.anbar_id`-ə bağlanıb.
- **Təsir:** Anbar (anbarlar arası stok sürüşməsi, hər iki anbarda drift), Hesabat (anbar üzrə qalıq yanlış), Sayım (variance), Source-of-truth ledger anbar-cüt drifti.
- **Düzəliş tövsiyəsi:** satis_sifaris_satirlari-ya `anbar_id` sütunu əlavə et və satışda yaz; ləğv/qaytarmada hər sətrin öz anbarına qaytar. Köçürənə qədər: ya çox-anbarlı satışı bir anbarla məhdudlaşdır, ya da satış mexaric hərəkətindəki anbar_id-dən (anbar_hereketleri ref_id=saleId) sətir-anbarını bərpa et.

### K18 [Maliyyə / Marketplace payout]
**Marketplace payout həm manual qaliq increment edir, həm finance_operations yaradır — type yoxdursa balans gələcək recalc-da silinir (cache/source-of-truth uyğunsuzluğu)**
- **Səhifə/Fayl:** features/maliyye/actions.ts (markPayoutReceived, ~sətir 1371-1415)
- **Gözlənilən:** Payout net məbləği bank hesabına bir dəfə oturmalı və source-of-truth (finance_operations) ilə cache (maliye_hesablari.qaliq) eyni olmalıdır. recalculateAccountBalance çağırılmalı, type yoxdursa yaradılmalıdır (digər action-lar kimi findOrCreate).
- **Faktiki:** markPayoutReceived həm `maliye_hesablari.updateMany({ data: { qaliq: { increment: d.faktiki_mebleg } } })` (manual delta), həm də y_n='daxil' finance_operations qeydi yaradır — AMMA finance_operations YALNIZ `if (type)` (marketplace_payout type mövcuddursa) yaranır və recalculateAccountBalance HEÇ vaxt çağırılmır. marketplace_payout type seed olunmur (yalnız findUnique, create yox). Type yoxdursa: yalnız manual increment qalır, finance_operations yoxdur → həmin hesaba növbəti hər hansı əməliyyat recalculateAccountBalance çağıranda qaliq source-of-truth-dan yenidən hesablanır və payout məbləği TAMAMİLƏ itir (balans faktiki_mebleg qədər azalır).
- **Səbəb:** Sətir ~1388-1391 manual `qaliq: { increment }`; sətir 1394-1397 `findUnique({ where: { kod: 'marketplace_payout' } })` create fallback-i YOXDUR; recalculateAccountBalance bu funksiyada heç çağırılmır. Bu, layihənin qalan hissəsindəki 'manual delta YOX, yalnız recalc' patterninə ziddir (müq. saveExpense, paySupplierInvoice).
- **Təsir:** maliye_hesablari (bank hesab balansı), maliyye dashboard, hesabatlar, gün-sonu kassa_qaliq — payout itən kimi bütün hesabatlarda balans aşağı düşür.
- **Düzəliş tövsiyəsi:** markPayoutReceived-də manual `qaliq: { increment }`-i sil; marketplace_payout type-ı findOrCreate et (digər action-lar kimi); finance_operations qeydindən sonra `await recalculateAccountBalance(d.hesab_id, tx)` çağır. Bütün hesab balansı dəyişikliyini source-of-truth recalc vasitəsilə et.

### K19 [Maliyyə / Hesab balansı]
**tesisci_pul və tehtl_hesab y_n='transfer' kimi yazılır, lakin tək hesablıdır (hesab_id2=null) — calculateAccountBalance bu əməliyyatları HEÇ saymır, balans dəyişmir**
- **Səhifə/Fayl:** features/maliyye/actions.ts (QUICK_META: tesisci_pul, tehtl_hesab) + lib/balance/account-balance.ts
- **Gözlənilən:** Təsisçi pulu (sahibkar hesaba pul qoyur) → hesab qaliqı ARTMALI. Tahtəl hesab (sahibkar pul çıxarır) → hesab qaliqı AZALMALI.
- **Faktiki:** Hər iki əməliyyat y_n='transfer', hesab_id dolu, hesab_id2=NULL kimi saxlanılır. calculateAccountBalance-də: daxil_cemi yalnız yön='daxil', mexaric_cemi yalnız yön IN ('mexaric','xaric'), transfer_mexaric isə `hesab_id2 IS NOT NULL AND yön='transfer'` tələb edir. Tək hesablı transfer-də hesab_id2 NULL olduğu üçün heç bir budaq işləmir → əməliyyatın balansa təsiri SIFIR. Pul real hərəkət etsə də hesab qaliqı dəyişmir.
- **Səbəb:** QUICK_META-da tesisci_pul/tehtl_hesab yon:'transfer' təyin olunub (sətir 412-413), amma needHesab2 yoxdur. account-balance.ts transfer_mexaric şərti `hesab_id2 IS NOT NULL` (sətir 86-93) bu halı kənarda qoyur; daxil/mexaric şərtləri isə yön='transfer'-i tutmur.
- **Təsir:** maliye_hesablari.qaliq, kassa/bank balansları, gün-sonu kassa_qaliq, bütün maliyyə hesabatları — sahibkar kapital qoyuluşu/çıxarışı izlənmir.
- **Düzəliş tövsiyəsi:** tesisci_pul-u yon:'daxil', tehtl_hesab-ı yon:'xaric' (və ya 'mexaric') et — və ya calculateAccountBalance-də tək hesablı yön='transfer' əməliyyatları üçün yön+qrup-a görə işarə təyini əlavə et. Ən təmiz həll: bu iki növü transfer yox, daxil/mexaric kimi modelləşdir.

### K20 [Maliyyə / Əməliyyat xülasəsi (yön etiketi)]
**Məxariç iki fərqli etiketlə yazılır (mexaric vs xaric) — xülasə/hesab çıxış cəmləri yalnız birini sayır, böyük outflow-lar (maaş, xərc, təchizatçı ödənişi) net-dən düşür**
- **Səhifə/Fayl:** features/maliyye/operations-queries.ts:218-226 + features/maliyye/account-queries.ts:207-210, 242, 244
- **Gözlənilən:** Net = bütün daxil − bütün məxariç (mexaric VƏ xaric birlikdə). Hesab səhifəsində 'çıxış' bütün outflow növlərini göstərməli.
- **Faktiki:** getOperationsSummary net=daxil−xaric, yalnız y_n==='xaric'-i sayır (sətir 223,226). Lakin saveExpense, saveExpenseWithInvoiceLink, maas-actions, paySupplier* hamısı y_n='mexaric' yazır; yalnız saveQuickOperation xercler/azaltma/dividend y_n='xaric' yazır. Beləliklə maaş, hesablı xərc və təchizatçı ödənişləri net hesabından çıxmır → net süni şəkildə yüksək görünür. account-queries.ts sumByYn(...,'mexaric') isə əksinə yalnız mexaric sayır, y_n='xaric' (azaltma/dividend/quick xerc) çıxışlarını hesabın 'çıxış' göstəricisindən düşürür.
- **Səbəb:** y_n dəyər lüğəti normallaşmayıb: bəzi kod yolları 'mexaric', bəziləri 'xaric' yazır. calculateAccountBalance düzgün olaraq yön IN ('mexaric','xaric') ilə hər ikisini tutur, amma xülasə/hesab aqreqasiya yolları yalnız bir dəyəri yoxlayır.
- **Təsir:** Maliyyə əməliyyat KPI (net, xaric), hesab detalı bugun/ay çıxışı — istifadəçiyə göstərilən analitik göstəricilər.
- **Düzəliş tövsiyəsi:** Çıxış aqreqasiyasında daima ('mexaric' VƏ 'xaric') hər ikisini topla (calculateAccountBalance kimi). Daha yaxşısı: y_n dəyərlərini tək kanonik dəstə (məs. yalnız 'mexaric') normallaşdır və migration ilə köhnə 'xaric' sətirlərini düzəlt.

### K21 [Maliyyə / Marketplace payout]
**Payout status sətri uyğunsuzluğu: satış 'gozlenir' yazır, bütün oxuyanlar 'gozleyir' axtarır**
- **Səhifə/Fayl:** features/ticaret/market-satis-action.ts:250 (yazır) vs features/maliyye/marketplace-queries.ts:137, features/maliyye/triggers.ts:215, features/maliyye/components/marketplace-table.tsx:169 (oxuyur)
- **Gözlənilən:** Marketplace satışı yaradılanda gözləyən payout 'Gözləyir' siyahısında görünməli, statistikaya düşməli, gecikmə triggerinə düşməli və cədvəldə 'Qəbul et' düyməsi göstərilməlidir ki, istifadəçi payout-u qəbul edib bankı artıra bilsin.
- **Faktiki:** createMarketSatis finance_marketplace_payments-i status='gozlenir' (yazı səhvi) ilə yaradır. Lakin getMarketplaceStats where:{status:'gozleyir'} (sətir 137), triggers late_payout where:{status:{in:['gozleyir']}} (sətir 215) və marketplace-table.tsx 'Qəbul et' düyməsi yalnız m.status==='gozleyir' olduqda render olunur (sətir 169). Status filtri dropdown-da da yalnız 'gozleyir' var (page.tsx:126). Nəticə: per-satış payout heç vaxt statistikaya/triggerə düşmür, 'Qəbul et' düyməsi görünmür → istifadəçi payout-u QƏBUL EDƏ BİLMİR → bank heç vaxt artmır.
- **Səbəb:** Sabit sətirlər arasında yazı fərqi: 'gozlenir' vs 'gozleyir'. DB sxemasının default-u da 'gozleyir' (schema.prisma:1794), startMarketplaceReconciliation və DB default 'gozleyir' istifadə edir, yalnız createMarketSatis 'gozlenir' yazır.
- **Təsir:** Maliyyə (payout qəbulu mümkünsüz, bank balansı heç vaxt artmır), nəzarət merkezi/triggerlər (gecikmiş payout xəbərdarlığı işləmir), marketplace dashboard statistikası (gözləyən məbləğ 0 görünür).
- **Düzəliş tövsiyəsi:** createMarketSatis-də status:'gozlenir' → 'gozleyir' düzəlt. Əlavə olaraq vahid sabit (enum/const) yaradıb hər yerdə onu istifadə et ki, gələcəkdə yenidən fərqlənməsin. Mövcud DB-də 'gozlenir' statuslu qeydləri 'gozleyir'-ə miqrasiya et.

### K22 [Marketplace webhook / Maliyyə / Hesabatlar]
**Webhook satışı komissiya/net hesablamır və gözləyən payout YARATMIR — gross net kimi qalır**
- **Səhifə/Fayl:** app/api/v1/marketplace/orders/[kanal]/route.ts:170-250
- **Gözlənilən:** 100 məbləğli, 14% komissiyalı webhook sifarişində: komisyon_meblegh=14, xalis_meblegh=86 yazılmalı, finance_marketplace_payments-də gözləyən net=86 payout yaranmalı (createMarketSatis kimi). Hesabatlarda net=86, komissiya=14 görünməlidir.
- **Faktiki:** Webhook satis_sifarisleri yaradanda komisyon_meblegh/xalis_meblegh sahələrini ümumiyyətlə yazmır (grep: faylda komisyon/xalis/getDefaultCommission/finance_marketplace YOXDUR) və odenilmis=cem (tam gross 'ödənilmiş' kimi). Heç bir gözləyən payout qeydi yaranmır. Hesabatlarda (hesabatlar/marketplace-queries.ts:24, maliyye/marketplace-queries.ts:108) net = COALESCE(xalis_meblegh, son_mebleg - komisyon_meblegh) = son_mebleg - 0 = GROSS. Yəni webhook gəlmiş hər marketplace satışı 0% komissiya, net=gross kimi hesablanır — mənfəət şişir, payout izlənmir.
- **Səbəb:** Webhook route manual createMarketSatis axını ilə paralel yazılıb amma komissiya tətbiqi (getDefaultCommission), komisyon_meblegh/xalis_meblegh yazılması və finance_marketplace_payments.create addımları köçürülməyib. odenilmis=cem qoyulub.
- **Təsir:** Maliyyə (payout heç yaranmır → bank heç vaxt sinxronlaşmır), hesabatlar/marja (net=gross, komissiya gizli, mənfəət şişir), nəzarət (gözləyən payout görünmür). Spec-in 'net payout 86, mənfəət 26' tələbini webhook satışları üçün pozur.
- **Düzəliş tövsiyəsi:** Webhook-da da getDefaultCommission(kanal) ilə komissiyanı tətbiq et: komisyon_meblegh, xalis_meblegh yaz, finance_marketplace_payments gözləyən payout (status='gozleyir') yarat. İdeal: webhook və manual axın eyni paylaşılan funksiyaya (createMarketplaceSaleCore) yönəlsin ki, divergensiya olmasın.

### K23 [Ticaret qaytarma]
**Standart qaytarma axını original_id təyin etmir → orijinal satışa/payout-a heç bir təsir göstərmir**
- **Səhifə/Fayl:** features/qaytarma/actions.ts:48-140 (createReturn) və 147-277 (acceptReturn)
- **Gözlənilən:** Yeni qaytarma dialoqundan (new-return-dialog) yaradılan müştəri qaytarması orijinal satışa bağlanmalı, qəbul olunanda satışın son_mebleg/balans və marketplace payout düzəlməlidir.
- **Faktiki:** createReturn qaytarma_sifarisleri yaradanda original_id ümumiyyətlə yazmır (CreateReturnSchema-da bu sahə yoxdur, sətir 21-28). acceptReturn isə düzəlişi yalnız 'ret.original_id' olduqda edir (sətir 214). Beləliklə bu axınla yaradılan qaytarmalarda original_id=NULL → orijinal satışın son_mebleg/odenilmis düzəlmir, müştəri balansı satışla bağlanmır, marketplace payout/komissiya isə heç vaxt nəzərə alınmır.
- **Səbəb:** createReturn sxeması orijinal satış referansını qəbul etmir; yalnız qaytarma-tez-actions (fastReturn/returnFullSale) original_id təyin edir.
- **Təsir:** Ticaret (satışın faktiki məbləği qaytarmadan sonra düzəlmir), maliyyə/borc (müştəri balansı satışla əlaqədə düzəlmir), marketplace (komissiya/payout heç düzəlmir).
- **Düzəliş tövsiyəsi:** createReturn-ə opsional original_sale_id əlavə et və acceptReturn-də marketplace payout/komissiya korreksiyasını da işlət; ideal: hər iki qaytarma axınını eyni paylaşılan korreksiya funksiyasına yönəlt.

### K24 [Marketplace webhook idempotentlik]
**external_id unique index Prisma sxemasında yoxdur (schema drift) + dup yoxlaması transaksiyadan kənar audit_log-a söykənir (yarış pəncərəsi)**
- **Səhifə/Fayl:** app/api/v1/marketplace/orders/[kanal]/route.ts:90-103, 159-260; prisma/schema.prisma:5172
- **Gözlənilən:** Eyni external_id ilə təkrar webhook həmişə idempotent olmalı (bir satış), və sxema/DB sinxron olmalıdır ki, gələcək prisma db push/migrate unique index-i silməsin.
- **Faktiki:** İdempotentlik 2 səviyyəlidir: (1) transaksiyadan ƏVVƏL audit_log dup yoxlaması (sətir 90), (2) DB partial unique satis_external_id_uniq (P2002 tutulur, sətir 253). Lakin: (a) bu unique index Prisma schema.prisma-da YOXDUR (external_id sadəcə VarChar(120), @unique/@@unique yoxdur) — schema drift; prisma db push bu index-i sıra d-an silə bilər, sonra idempotentlik P2002-yə söykəndiyi üçün sınar. (b) audit_log yazısı transaksiyadan SONRA yazılır (sətir 263), buna görə eyni anda gələn 2 eyni webhook arasında audit_log dup yoxlaması ikisini də keçirə bilər — yalnız DB unique index real qoruyur (o da schema-da olmadığından kövrək). (c) nomre də unique-dir (WH-KANAL-external_id 50 simvola kəsilir) — uzun external_id-lər kəsiləndə fərqli sifarişlər eyni nomre-yə toqquşub uğursuz ola bilər.
- **Səbəb:** Migration faylı (2026-06-08-audit-fix-columns.sql) index yaradır, lakin prisma schema yenilənməyib; idempotentlik DB-spesifik index-ə söykənir; nomre kəsilməsi 50 simvol limitindədir.
- **Təsir:** Marketplace (təkrar/yarış webhook-larında dublikat satış riski deploy-dan sonra index yoxdursa), stok (ikiqat azalma), maliyyə (ikiqat payout).
- **Düzəliş tövsiyəsi:** external_id (sahibkar_id+external_id) partial unique-i Prisma schema-ya əlavə et ki, drift olmasın. Dup yoxlamasını/audit yazısını idempotentlik üçün transaksiya daxilinə al və ya yalnız DB unique-ə güvən (P2002). Uzun external_id üçün nomre formatını hash/qısaltma ilə təhlükəsizləşdir.

### K25 [ticaret / satış ödənişi (maliyyə double-counting)]
**Kredit satışdan müştəri ödənişi qəbul etmək mümkündür → ikiqat kassa/maliyyə daxilolması və saxta nağd satış**
- **Səhifə/Fayl:** features/ticaret/satis-actions.ts:28-203 (recordSalePayment)
- **Gözlənilən:** Kredit satışın pulu yalnız recordKreditPayment (bank) vasitəsilə daxil olmalı; müştəridən nağd ödəniş qəbul edilməməli (yoxsa eyni satış iki dəfə pul gətirir).
- **Faktiki:** recordSalePayment odenis_nov yoxlamır. Satış detalında açıq olan SalePaymentDialog vasitəsilə kredit satışa 150 ödəniş yığılırsa: kassa_emeliyyatlari (emeliyyat_nov='satis') + finance_operations 'qaime/daxil' yazılır və hesab balansı artır. Ayrıca bank recordKreditPayment ilə magaza_net (135) daxil edəndə YENƏ finance_operations + balans artır. Nəticə: bir satış üçün ~285 AZN daxilolma.
- **Səbəb:** recordSalePayment-də `if (sale.odenis_nov === 'kredit') reject` yoxdur; qaliq=son_mebleg-odenilmis kredit üçün də müsbətdir.
- **Təsir:** maliyyə (hesab balansı, kassa), hesabatlar/pul axını, P&L gəlir, dashboard — saxta gəlir/nağd.
- **Düzəliş tövsiyəsi:** recordSalePayment-də odenis_nov IN ('kredit','kredit_qeyd') olduqda imtina et (kredit ödənişi yalnız recordKreditPayment ilə).

### K26 [Servis — Public müştəri portalı (təklif təsdiqi + rəy)]
**Public təklif təsdiqi və rəy göndərmə tenant-guard-da çökür — scoped prisma withTenant olmadan istifadə olunur**
- **Səhifə/Fayl:** features/servis/actions.ts: customerApproveQuote (sətir 1003-1078) və submitCustomerReview (sətir 945-992); app/servis-track/[token]/teklif/[id]/ və /rey/
- **Gözlənilən:** Müştəri public linkdə (/servis-track) təklifi 'Təsdiq et' edəndə servis statusu temir_olunur-a (rədd edəndə redd_edildi-yə) keçməli, status_tarixce yazılmalı, audit düşməli; rəy daxili_qeyd-ə yazılmalı.
- **Faktiki:** customerApproveQuote/submitCustomerReview withTenant ilə bürünmür (qəsdən — public, session yoxdur), AMMA scoped 'prisma' client-i ilə prisma.servis_qeydleri.findUnique(...) və .update(...) / tx.servis_qeydleri.update(...) çağırır. servis_qeydleri TENANT_MODELS-dədir; lib/db/prisma.ts extension tenant kontekst tapmayanda READ_OPS/WRITE_OPS üçün 'Error([tenant-guard] No tenant in context for servis_qeydleri.findUnique)' atır. Exception catch-ə düşür → həmişə {ok:false} ('Təsdiq yazılmadı' / 'Rəy yazılmadı') qaytarır. (/servis-track auth.ts PUBLIC_PREFIXES-dədir, ona görə session=null.)
- **Səbəb:** Public action-larda getServisTrackByToken kimi prismaUnscoped işlədilməli idi, lakin bu iki funksiya tenant-scoped 'prisma' işlədir. Tenant extension WRITE/READ op-larda sahibkar_id inject etməyə çalışır və kontekst boş olduğu üçün throw edir.
- **Təsir:** Servis (müştəri onayı status axınını dayandırır → təmir başlamır), audit (musteri_onay/redd yazılmır), CRM müştəri tarixçəsi (rəy düşmür). Public portalın iki əsas funksiyası tam sıradan çıxıb.
- **Düzəliş tövsiyəsi:** Bu iki funksiyada bütün servis_qeydleri/servis_status_tarixce əməliyyatlarını prismaUnscoped ilə icra et (servis_id+sahibkar_id-ni token-dən təsdiqləyəndən sonra manual sahibkar_id filtri ilə), və ya runWithTenant({sahibkarId: s.sahibkar_id, ...}) ilə süni tenant konteksti qur. Token artıq sahibkar_id-ni təsdiqlədiyi üçün manual filtrli prismaUnscoped təhlükəsizdir.

### K27 [Maaş / Komissiya (ticaret↔iscilier)]
**calculateCommission kpi_bonus yazır, lakin son_meblegh (NET) yenidən hesablanmır — komissiya işçiyə heç vaxt ödənilmir**
- **Səhifə/Fayl:** features/ticaret/commission-actions.ts:110-139
- **Gözlənilən:** Aylıq komissiya hesablananda işçinin kpi_bonus-u + son_meblegh (NET) komissiya qədər artmalı, bordroda və ödənişdə əks olunmalıdır.
- **Faktiki:** calculateCommission yalnız `data: { kpi_bonus: totalBonus }` update edir. son_meblegh YENİDƏN HESABLANMIR. maas_hesablamalar.son_meblegh sütunu @default(dbgenerated(...)) — yəni yalnız INSERT zamanı (özü də prorata+kpi+manual-cerime-avans düsturu ilə, vergi/sosial olmadan) doldurulur, UPDATE-də DB onu yeniləmir. Nəticədə kpi_bonus artır, amma payBordro `meblegh = Number(b.son_meblegh)` köhnə (komissiyasız) dəyəri ödəyir. İşçi UI-da 'KPI bonus +X' görür, lakin NET-də və real ödənişdə X yoxdur.
- **Səbəb:** commission-actions.ts:122-125 update yalnız kpi_bonus sahəsini dəyişir; adjustBordro/saveBonusOrPenalty-dəki kimi gross/vergi/sosial/son_meblegh yenidən hesablama qatı burada yoxdur. son_meblegh dbgenerated default UPDATE-də işləmir (stored generated column deyil).
- **Təsir:** Maaş bordrosu (NET), maaş ödənişi (payBordro/bulkPay), maliyyə (finance_operations məbləği), əməkdaş kartı (isci_odenisleri), bordro-print PDF, hesabatlar/emekdas.
- **Düzəliş tövsiyəsi:** calculateCommission-da kpi_bonus dəyişdikdən sonra mövcud sətir üçün gross = prorata+kpi_bonus+manual_bonus+detal.satis_komisyon, vergi/sosial və son_meblegh-i yenidən hesablayıb update-ə daxil et (adjustBordro-dakı düsturla eyni). Eyni anda detal.vergi/sosial/gross JSON-u yenilə.

### K28 [Maaş / Komissiya]
**calculateCommission yeni bordro sətri yaradanda esas_maas/prorata/son_meblegh boş qalır — natamam bordro**
- **Səhifə/Fayl:** features/ticaret/commission-actions.ts:127-136
- **Gözlənilən:** Komissiya üçün yeni maas_hesablamalar yaradılırsa, işçinin əsas maaşı (esas_maas, prorata_maas) və düzgün son_meblegh də doldurulmalıdır.
- **Faktiki:** create yalnız {sahibkar_id, istifadeci_id, il, ay, kpi_bonus, status:'cernovik'} verir. esas_maas/prorata_maas DB default=0, son_meblegh dbgenerated INSERT-də = 0+kpi_bonus+0-0-0 = kpi_bonus (vergi/sosial çıxılmadan). Yəni həmin işçi üçün calculateBordro hələ işlədilməyibsə, onun bordrosunda baz maaş 0 görünür, NET yalnız komissiya olur. Sonradan calculateBordro işlədilsə də existingSet.has(e.id) səbəbindən bu sətri ATLAYIR (maas-actions.ts:184) → əsas maaş heç vaxt əlavə olunmur.
- **Səbəb:** commission-actions.ts create-də esas_maas/prorata_maas verilmir; calculateBordro mövcud sətri (status nədən asılı olmayaraq) skip edir (maas-actions.ts:128-131, 184).
- **Təsir:** Maaş bordrosu, NET ödəniş, əməkdaş kartı, maliyyə, bordro-print.
- **Düzəliş tövsiyəsi:** calculateCommission create edərkən işçinin aylik_maas-ından esas_maas/prorata_maas/son_meblegh-i tam doldurun, VƏ YA komissiyanı yalnız calculateBordro-dan SONRA mövcud sətrə tətbiq edin (create yox, yalnız update). Alternativ: calculateBordro-nu komissiya sətrini 'tamamlayacaq' şəkildə dəyişin.

### K29 [Maaş / Toplu ödəniş]
**bulkPayBordro hesab seçimi qəbul etmir və yetərsiz balansda səssizcə hesaba bağlamır**
- **Səhifə/Fayl:** features/iscilier/maas-actions.ts:441-505 (bulkPayBordro)
- **Gözlənilən:** Toplu ödənişdə də hesabın yetərliliyi yoxlanmalı, çatışmazlıqda istifadəçi xəbərdar edilməli və ya əməliyyat dayandırılmalıdır.
- **Faktiki:** bulkPayBordro recordMaasFinanceLeg-i hesabId vermədən çağırır (sətir 473-480, hesabId yoxdur) → həmişə default kassa/bank seçir. checkAccountSufficient false qaytarsa res.ok=false olur, lakin maas_hesablamalar artıq 'odenilib' edilib və isci_odenisleri yaradılıb (eyni $transaction içində olsa da finance leg fail-i transaction-u geri qaytarmır — recordMaasFinanceLeg sadəcə {ok:false} qaytarır, throw etmir). Nəticədə bordro 'ödənilib' görünür amma kassadan pul çıxmır; financeFailCount yalnız console.warn ilə bildirilir, istifadəçiyə qaytarılmır.
- **Səbəb:** recordMaasFinanceLeg yetərsizlikdə throw yox, soft false qaytarır (maas-actions.ts:67-69); bulkPay bu false-u istifadəçiyə ötürmür (sətir 485-487 yalnız warn).
- **Təsir:** Maliyyə (kassa qalığı ilə real arasında uyğunsuzluq), maaş statusu, audit, hesabat.
- **Düzəliş tövsiyəsi:** bulkPay nəticəsində financeFailCount>0 olduqda istifadəçiyə aydın xəbərdarlıq qaytarın; ya yetərsiz hesablar üçün ödənişi 'odenilib' etməyin (status dəyişməsini finance leg uğuruna bağlayın).

### K30 [Hesabatlar / Satış + Maliyyə]
**Qaytarma KPI/P&L təsdiqlənməmiş və ləğv edilmiş qaytarmaları da sayır**
- **Səhifə/Fayl:** features/hesabatlar/satis-queries.ts (getSalesKpi.returnAgg) + maliyye-queries.ts (getPlSummary.returnsAgg)
- **Gözlənilən:** Yalnız tamamlanmış (status='tamamlandi') qaytarmalar qaytarma cəminə və return_rate-ə daxil olmalı; tesdiqlenmemis (gözləyən) və legv (ləğv) qaytarmalar sayılmamalı.
- **Faktiki:** Hər iki query qaytarma_sifarisleri-dən status filtri OLMADAN bütün sətirləri sayır: 'WHERE sahibkar_id=... AND tarix BETWEEN ...'. createReturn() qaytarmanı 'tesdiqlenmemis' statusu ilə yaradır (stok/pula təsir etmir), cancelReturn() onu 'legv' edir. Hər ikisi yenə də return_count, return_amount və P&L returns-a daxil olur.
- **Səbəb:** satis-queries.ts sətir 71-77 və maliyye-queries.ts sətir 42-47: qaytarma SELECT-lərində status şərti yoxdur.
- **Təsir:** Satış hesabatı qaytarma faizi (return_rate) şişirdilir; P&L net_revenue səhv azaldılır; Excel export Xülasə vərəqində 'Qaytarma sayı/%' yanlış. Gözləyən və ya rədd edilmiş qaytarmalar real itki kimi görünür.
- **Düzəliş tövsiyəsi:** Hər iki query-yə "AND status = 'tamamlandi'" (və ya ən azı status NOT IN ('legv','tesdiqlenmemis')) əlavə et. acceptReturn-in real tətbiq anı ilə eyni statusa bağla.

### K31 [Dashboard vs Hesabatlar vs Maliyyə / Borc]
**Müştəri borcu üç ayrı mənbədən hesablanır — rəqəmlər uyğun gəlmir**
- **Səhifə/Fayl:** features/dashboard/queries.ts (getDashboardKpis customerDebt) vs features/hesabatlar/musteri-queries.ts (getDebtBuckets) vs features/maliyye/queries.ts (getDebtors)
- **Gözlənilən:** Müştəri borcu (debitor) hər yerdə eyni mənbədən gəlməli (tək həqiqət mənbəyi).
- **Faktiki:** 3 fərqli tərif: (a) Dashboard getDashboardKpis: SUM(kontragentler.alacaq) WHERE nov='musteri' AND alacaq>0; (b) Hesabatlar getDebtBuckets (Executive hub 'Debitor borc'): SUM(kontragentler.borc) WHERE borc>0 — üstəlik aktiv VƏ nov filtri YOXDUR (deaktiv/silinmiş müştərilər və hətta borc>0 olan təchizatçılar daxil ola bilər); (c) Maliyyə debitor səhifəsi getDebtors: CANLI olaraq açıq fakturalardan SUM(son_mebleg - odenilmis) WHERE odenis_nov IN ('nisye','borc'). Stored alacaq/borc sahələri canlı hesablamadan sürüşə bilər.
- **Səbəb:** customerDebt (dashboard) → alacaq sahəsi; getDebtBuckets → borc sahəsi (aktiv/nov filtrsiz); getDebtors → açıq faktura cəmi. Üç ayrı metod.
- **Təsir:** Dashboard, Hesabatlar Executive hub və Maliyyə debitor səhifəsi müxtəlif 'müştəri borcu' rəqəmləri göstərir — istifadəçi etibarını itirir.
- **Düzəliş tövsiyəsi:** Vahid borc mənbəyi seç (tövsiyə: getDebtors canlı açıq-faktura hesablaması), digər yerləri ona yönləndir. getDebtBuckets-ə ən azı 'AND k.aktiv=TRUE AND k.nov IN (\'musteri\',\'her_ikisi\')' əlavə et.

### K32 [Ticarət / Kassa]
**Hissəvi ödənilmiş satışın ləğvi kassa qalığını yanlış azaldır (over-reversal)**
- **Səhifə/Fayl:** features/ticaret/satis-actions.ts (cancelSale, sətir 325-340)
- **Gözlənilən:** Satış ləğv edildikdə kassaya yalnız REAL daxil olmuş məbləğ (odenilmis) qədər mənfi əməliyyat yazılmalıdır.
- **Faktiki:** Reversal kassa_emeliyyatlari sətri `mebleg: -sonMebleg` (satışın TAM məbləği) ilə yaradılır, halbuki hissəvi ödənişdə yalnız `odenilmis` kassaya daxil olmuşdu. satis-yeni-actions.ts hissəvi ödənişdə odenis_nov='nisye' təyin edir; cancelSale şərti `sale.odenis_nov !== 'borc'` olduğu üçün nisye satış da bu bloka düşür.
- **Səbəb:** Sətir 333: `mebleg: new Prisma.Decimal(-sonMebleg)` — odenilmis əvəzinə sonMebleg istifadə olunub. kassa-queries.ts (sətir 80-83) emeliyyat_nov='qaytarma'-nı mexaric/xerc saymadığı üçün onu medaxil bucket-ə salır: net medaxil = odenilmis - sonMebleg. Tam ödənişdə (odenilmis=sonMebleg) 0 verir (düzgün), amma hissəvi nisyə satışda mənfi qalıq verir.
- **Təsir:** Kassa balansı (kassa-queries.ts getKassaBalances, gun-sonu-queries, dashboard, POS sessiya), gündəlik nağd axın hesabatı (pul-queries.ts) — silinmiş hissəvi satış kassanı reallıqdan çox azaldır.
- **Düzəliş tövsiyəsi:** Reversal məbləğini `odenilmis`-ə bağla (yalnız real daxil olmuş pulu geri çıx) və düzgün emeliyyat_nov istifadə et; ya da finance_operations pattern-i kimi ümumiyyətlə kassa_emeliyyatlari reversal yazmaq əvəzinə kassa balansını ödənilən sənədlərdən derive et. Həmçinin tam ödənişlərdə də sonMebleg yerinə odenilmis daha düzgündür.

### K33 [Ticaret / Maliyyə / Kassa (cross-modul data axını)]
**finance_operations yazısı $transaction daxilində try/catch ilə udulur — satış uğurlu görünür, amma pul heç bir maliyyə hesabına/kassaya düşmür (səssiz kassa-maliyyə uyğunsuzluğu)**
- **Səhifə/Fayl:** features/ticaret/satis-actions.ts:131-181 (recordSalePayment); features/ticaret/satis-yeni-actions.ts:389-455 (createOrUpdateSatisYeni)
- **Gözlənilən:** Satış/ödəniş bir transaction-da atomik olmalı: ya satışın odenilmis-i + kassa_emeliyyatlari + finance_operations + hesab balansı hamısı yazılır, ya heç biri. Maliyyə hesabatı (pul-axini, hesab balansı) həmişə kassa ilə uyğun olmalı.
- **Faktiki:** Eyni prisma.$transaction içində satis_sifarisleri.odenilmis increment + recalculateCustomerBalance commit olunur, lakin finance_operations.create + recalculateAccountBalance ayrıca `try { ... } catch (e) { console.warn('finance_operations skipped') }` ilə bürünüb. Xəta atılarsa (opHesabId tapılmır, FK, account-balance raw SQL fail), satış və müştəri borcu yenilənir, AMMA maliyyə ledgeri / hesab balansı yenilənmir. İstifadəçi 'uğurlu' toast görür. satis-actions.ts-də kassa_emeliyyatlari tx-də qalır, finance_operations udulur → kassa ilə maliyyə də fərqlənir.
- **Səbəb:** console.warn-lu best-effort try/catch transaction-ın atomikliyini pozur: əsas yazı (odenilmis) udulan yazıdan (finance_operations) əvvəl gəlir və catch xətanı boğub transaction-ın rollback olmasının qarşısını alır. Şərhdə 'audit #5 fix' yazılıb, amma fix best-effort qalıb.
- **Təsir:** Maliyyə (hesab balansı yanlış az), pul-axini hesabatı, hesabatlar/maliyye, debitor/kreditor. Kassa ilə maliyyə modulu arasında izah olunmaz fərq — auditdə üzə çıxır.
- **Düzəliş tövsiyəsi:** finance_operations + recalculateAccountBalance try/catch-ini ya tamamilə transaction-a daxil et (xəta rollback etsin, istifadəçi səhvi görsün), ya da minimum opHesabId null olduqda satışı bloklayıb istifadəçidən hesab seç tələb et. Səssiz console.warn-u istifadəçiyə görünən xəbərdarlığa çevir; ən azı action nəticəsində `warning: 'maliyyə qeydi yazılmadı'` qaytar ki UI bildirə bilsin.

======================================================================

## 7. ORTA BUGLAR (59)

### O01 [Ayarlar / Filial, Anbar, Bank hesabı, Cross-visibility] Filial/anbar/maliyyə-hesabı yaratma-silmə və cross-filial görünüş ayarları server action-larında heç bir icazə yoxlaması yoxdur (yalnız frontend gizlədir)
- **Fayl:** features/ayar/actions.ts — saveFilial, deleteFilial, saveFilialIsolation, toggleFilialGorunush, bulkSetFilialGorunush, updateFilialAnbar, deleteFilialAnbar, createFilialHesab, createFilialAnbar
- **Faktiki:** 9 action-un heç biri requireAyarActionPerm çağırmır — yalnız withTenant + sahibkar_id ilə tenant izolyasiyası var (cross-tenant yazma bloklanır, çünki bu modellər TENANT_MODELS-dədir). Lakin /ayarlar səhifələri yalnız layout-dakı gateRoute ilə qorunur; server action-lar isə POST endpoint kimi səhifə gating-indən asılı olmadan session cookie ilə birbaşa çağırıla bilir. Beləliklə, ayar.view/idare ol
- **Səbəb:** Mərkəzi gateRoute yalnız naviqasiya/səhifə-render qatında işləyir (layout.tsx → headers x-pathname). Server action-lar bu gate-dən keçmir; bu action-larda backend icazə yoxlaması qoyulmayıb — frontend-only enforcement.
- **Təsir:** Maliyyə (hesab yaratma), struktur (filial/anbar yaratma-silmə), filiallararası data görünüşü konfiqurasiyası. Privilege escalation və konfiqurasiya pozulması.
- **Düzəliş:** Hər birinin əvvəlinə `const g = await requireAyarActionPerm('ayar.idare'); if(!g.ok) return {ok:false,error:g.error};` əlavə et. Filial/anbar/hesab dəyişiklikləri üçün audit() çağırışı da əlavə et (hazırda yoxdur).

### O02 [Maliyyə / Müştəri hesabı & balans API] Maliyyə CSV/balans API route-ları yalnız auth() yoxlayır, maliyyə icazəsi (maliye.view/maliyye.oxu) yoxlamır
- **Fayl:** app/api/musteri/[id]/hesab-cixaris.csv/route.ts, app/api/techizatci/[id]/hesab-cixaris.csv/route.ts, app/api/maliyye/balance/route.ts
- **Faktiki:** Route handler-lər yalnız `if(!session?.user) 401` edir, sonra getCustomerStatement/getAccountBalance çağırır. Bu query-lər withTenant + sahibkar_id ilə tenant-izolyasiyalıdır (cross-tenant yoxdur), amma rol/icazə yoxlamırlar. Beləliklə, hər hansı autentifikasiyalı tenant istifadəçisi (məs. anbarçı/kassir) istənilən müştərinin tam maliyyə cıxarışını CSV kimi endirə və hesab balanslarını oxuya bilər
- **Səbəb:** API route-larda maliyyə icazə yoxlaması yoxdur; getCustomerStatement/getAccountBalance daxili icazə yoxlaması etmir (yalnız tenant scope).
- **Təsir:** Maliyyə məxfiliyi. Borc/balans məlumatlarının icazəsiz açılması.
- **Düzəliş:** Bu route-larda auth()-dan sonra `requireMaliyyeActionPerm(['maliye.view','maliyye.oxu','hesabat.oxu'])` yoxla (privileged xaric); ya da query funksiyalarına icazə yoxlamasını daxil et. Bütün /api/.../export route-larını eyni meyarla audit et.

### O03 [Maliyyə hesabları / POS] Kart və bank-köçürmə satışları nağd maliye hesabına yazılır — bank/kart hesab balansları korlanır
- **Fayl:** features/pos/sale-action.ts (sətir 313-345)
- **Faktiki:** Bütün qeyri-nisyə ödənişlər (negd, kart, kecirme) üçün hesabId = kassa.maliye_hesab_id (tək NAĞD hesab) götürülür; recalculateAccountBalance da həmin nağd hesab üzərində çağırılır. Kart/bank pulu fiziki nağd hesabın balansına düşür.
- **Səbəb:** kassalar modelində yalnız bir `maliye_hesab_id` var (schema sətir 2664); ödəniş növünə görə hesab routinqi yoxdur. sale-action `hesabIdForOp = kassa.maliye_hesab_id` (sətir 313) — odenis_nov nəzərə alınmır.
- **Təsir:** maliyyə (hesab balansları: nağd hesab şişir, kart/bank hesabları boş qalır), bank rekonsilasiyası, pul axını (cashflow by-account) hesabatı yanlış.
- **Düzəliş:** kassalar-a per-metod hesab (kart_hesab_id, bank_hesab_id) əlavə et və ya ayarlarda mapping qur; sale-action odenis_nov-a görə düzgün hesab_id seç. Hazırda finance_operations yalnız `qeyd`-də metodu saxlayır — strukturlaşdırılmış field lazımdır.

### O04 [Maliyyə / Müştəri borcu (kredit limiti)] Nisyə satışda kredit-limit yoxlaması SƏHV field oxuyur (kontragentler.borc) — limit praktiki olaraq işləmir
- **Fayl:** features/ticaret/customer-tier.ts (sətir 77-82), istifadə: features/pos/sale-action.ts (sətir 95-103)
- **Faktiki:** checkCustomerCreditLimit `select: { borc: true, borc_limiti: true }` oxuyur və `current = Number(c.borc)`. Lakin müştəri borcu HEÇ VAXT `borc` field-inə yazılmır — bütün satış/ödəniş axını `recalculateCustomerBalance` ilə `alacaq`-a yazır. `borc` müştərilər üçün həmişə 0/legacy. Nəticədə current≈0, limit yalnız TƏK satışın özü limiti aşanda işləyir, yığılmış borc nəzərə alınmır.
- **Səbəb:** Field qarışıqlığı: kontragentler-də həm `borc` (legacy/təchizatçı tərəfi, default 0) həm `alacaq` (müştəri borcu cache) var. customer-tier.ts köhnə `borc` field-ini oxuyur.
- **Təsir:** maliyyə (borc limiti nəzarəti sıradan çıxır), elaqe/debitor (limit_asib bayrağı debitor siyahısında live hesablanır, amma POS gate işləmir — uyğunsuz davranış), risk: müştəri limitsiz nisyə yığa bilər
- **Düzəliş:** checkCustomerCreditLimit-i `alacaq` field-ini (və ya calculateCustomerBalance live hesablamasını) oxumağa keçir. preSonMebleg-i əlavə edib limitə qarşı yoxla.

### O05 [POS / Endirim təsdiqi (discount approval)] Loyalty bonus sərfi və admin kuponu kassirin endirim faizini şişirdir → əsassız 'sahibkar təsdiqi' tələbi + orphan approval
- **Fayl:** features/pos/sale-action.ts (sətir 82-122, xüsusilə 89-92 və 107-122)
- **Faktiki:** pos-client server-ə `endirim_mebleg = endirimEffectiveMebleg + couponEndirim + bonusAfterDiscount` göndərir. sale-action preSonMebleg-i bundan hesablayır, overallDiscountPct-i (sətir 90-91) bütün endirimdən çıxarır və checkDiscountLimit-ə verir. Bonus/kupon limiti aşırsa satış bloklanır və requestDiscountApproval('pending-sale',...) çağırılır.
- **Səbəb:** endirim_mebleg-də 3 mənbə (manual + kupon + bonus) birləşdirilir, amma limit yoxlaması yalnız kassir endirimini ayırd etməlidir. Üstəlik approval 'pending-sale' placeholder ref ilə yaradılır → real satışa bağlanmayan asılı təsdiq qeydi.
- **Təsir:** tesdiq modulu (orphan 'pending-sale' təsdiqləri yığılır), POS axını (legitim bonus/kupon satışı dayanır), istifadəçi təcrübəsi.
- **Düzəliş:** Limit yoxlamasını yalnız kassirin manual endirimi (endirimEffectiveMebleg, sətir endirimləri) üzərində apar; kupon/bonus-u çıxar. Approval ref-ni real satışa bağla və ya yalnız satış yarananda yarat.

### O06 [POS / Kassa (çek nömrəsi)] POS çek nömrəsi (qaime_nomresi) findFirst+max+1 ilə yaranır, unique constraint yoxdur — paralel satışda dublikat
- **Fayl:** features/pos/sale-action.ts (sətir 199-214)
- **Faktiki:** lastPos = findFirst(orderBy qaime_nomresi desc) → +1. İki eyni vaxtlı transaction eyni lastPosNum oxuyub eyni `POS-YYYY-XXXX-00001` yarada bilər. schema-da qaime_nomresi-də @unique YOXDUR (yalnız `nomre` unikaldır), ona görə DB də tutmur.
- **Səbəb:** nomre üçün race-safe counter (next_sened_nomre) istifadə olunur, amma POS çek nömrəsi üçün primitiv max+1 pattern + unique index yoxluğu.
- **Təsir:** kassa/çek (dublikat çek nömrəsi), vergi çeki istinadı, audit izlənməsi qarışır.
- **Düzəliş:** qaime_nomresi üçün də counter-əsaslı atomik generator işlət (məs. nextDocNumber-ə oxşar per-kassa counter) və ya (sahibkar_id, qaime_nomresi)/(kassa_id, qaime_nomresi) unique index əlavə et.

### O07 [POS / Kassa sessiya göstəriciləri (UI)] Sessiya zolağında 'Bank' və 'Borc' cəmləri həmişə 0 — yanlış sahə adı + nisyə kassa əməliyyatı yaratmır
- **Fayl:** features/pos/session-queries.ts (sətir 73-76) vs sale-action.ts (sətir 269-292)
- **Faktiki:** getActiveKassa byPayment.bank (sətir 75) və byPayment.borc (sətir 76) oxuyur. Amma sale-action kassa_emeliyyatlari.odenis_nov-u 'kecirme' yazır (bank deyil) → cari_bank həmişə 0. Nisyə isə ümumiyyətlə kassa_emeliyyatlari sətri yaratmır → cari_borc həmişə 0.
- **Səbəb:** Enum uyğunsuzluğu: yazılış 'kecirme', oxunuş 'bank'. Nisyə üçün kassa əməliyyatı yox, amma UI byPayment.borc gözləyir.
- **Təsir:** POS UI (kassir səhv sessiya xülasəsi görür), reconciliation gözləntisi. Maliyyə hesabatlarına birbaşa təsir yox (onlar finance_operations/satış üzərindən).
- **Düzəliş:** session-queries-də byPayment.kecirme oxu (cari_bank üçün); cari_borc-u kassa_emeliyyatlari yerinə nisyə satışlardan (satis_sifarisleri odenis_nov='nisye', tarix>=acilis) hesabla.

### O08 [Ticarət — Satış ləğvi (hissəvi ödənilmiş nisyə)] Hissəvi ödənilmiş nisyə satışı ləğv olunanda kassa registrindəki ilkin ödəniş sətiri reverse olunmur (kassa balansı şişir)
- **Fayl:** features/ticaret/satis-actions.ts → cancelSale (sətir 326-340 vs 365-382)
- **Faktiki:** cancelSale-də kassa_emeliyyatlari reverse YALNIZ `odenis_nov !== 'borc' && kassa_id` halında işləyir (sətir 326). Hissəvi ödənilmiş satışda odenis_nov='nisye' olur (satis-yeni-actions.ts:358 finalOdenisNov='nisye') → bu şərt false → kassa reverse sətiri yazılmır. finance_operations isə reverse olunur (sətir 365-382) → account/hesab balansı düzəlir, lakin kassa-queries.ts kassa registr balansı (yal
- **Səbəb:** Kassa registr balansı (kassa_emeliyyatlari) və maliyyə hesab balansı (finance_operations) iki ayrı mənbədir; cancelSale yalnız finance tərəfini reverse edir, nisyə-hissəvi halda kassa tərəfini buraxır.
- **Təsir:** Maliyyə — kassa registri (kassa-queries.ts getKassalar balans, gün sonu) hissəvi ödənilmiş nisyə satışının ləğvindən sonra kassada qalmış pulu göstərir → registr vs hesab balansı arasında uyğunsuzluq.
- **Düzəliş:** cancelSale-də kassa reverse şərtini `odenilmis > 0 && kassa_id` ilə əvəz et (odenis_nov-dan asılı olmadan), reverse məbləğini son_mebleg əvəzinə faktiki odenilmis götür; həm kassa_emeliyyatlari, həm finance_operations sinxron reverse olunsun.

### O09 [Qaytarma — virtual ödəniş (odenilmis şişməsi)] Nisyə satış qaytarıldıqda borc azaltmaq üçün odenilmis süni artırılır — 'ödənilmiş' məbləği faktiki alınmamış pulu əks etdirir
- **Fayl:** features/ticaret/qaytarma-tez-actions.ts (fastReturn:231-238, returnFullSale:512-528); features/qaytarma/actions.ts (acceptReturn:224-233)
- **Faktiki:** Nisyə satış qaytarıldıqda kod `odenilmis: { increment: apply }` edir və satışı 'tamamlandi' (ödənilmiş) işarələyə bilir. Bu, müştərinin heç vaxt ödəmədiyi pulu 'ödənilmiş' kimi göstərir. CustomerBalanceBreakdown.odenilmis_cemi (customer-balance.ts) bu şişmiş dəyəri qaytarır. Müştəri ekstraktında (customer-statement.ts) borc həm satışın tam son_mebleg-i (debet) minus qaytarma geri_qaytarildi (kredi
- **Səbəb:** Qaytarmanın borca təsiri ayrıca uçot sahəsi (qaytarma) əvəzinə odenilmis sahəsinə 'virtual payment' kimi yazılır. Bu, NET borcu düzgün saxlayır (çünki source-of-truth son_mebleg−odenilmis), lakin ödəniş semantikasını korlayır.
- **Təsir:** Nağd-yığım/ödəniş hesabatları, müştəri ödəniş tarixçəsi, per-qaimə qaliq — qaytarma ilə örtülmüş nisyə qaimə 'ödənilib' görünür; faktiki kassa yığımı ilə uyğunsuzluq.
- **Düzəliş:** Qaytarmanı odenilmis-ə yazmaq əvəzinə ya satışın son_mebleg-ini azalt (acceptReturn artıq belə edir — uyğunsuzluq!), ya da borc hesablamasında qaytarma cəmini ayrıca çıx. fastReturn/returnFullSale ilə acceptReturn fərqli davranır (biri odenilmis artırır, digəri son_mebleg azaldır) — vahidləşdir.

### O10 [maliyye / elaqe (statement / hesab-çıxarış)] Avans çıxarışda İKİQAT sayılır — müştəri ödənişi pulun yarısını ikiqat kreditləyir
- **Fayl:** features/maliyye/customer-statement.ts:109-144 + features/maliyye/actions.ts:2072-2088 (applyAdvanceToInvoice) və receivePartialPayment:1183-1186
- **Faktiki:** Orijinal ödəniş (receivePartialPayment, type_kod='qaime', meblegh=d.mebleg=10 — TAM məbləğ avans daxil) çıxarışda payments sorğusuna (type_kod IN ('qaime','borc_silinme')) düşür → 10 kredit. Sonra applyAdvanceToInvoice eyni 8 avansı qaiməyə tətbiq edərkən YENİ finance_operations yaradır (type_kod='qaime', qeyd='[AVANS]', meblegh=8) → bu advances sorğusuna düşür → əlavə 8 kredit. Nəticədə müştərini
- **Səbəb:** applyAdvanceToInvoice avans tətbiqini yeni 'daxil' finance_operations kimi qeyd edir (azn_meblegh=apply, y_n='daxil'), halbuki orijinal avans artıq ödəniş anında 'daxil' kimi qeydə alınıb. customer-statement.ts avans tətbiqini ayrıca kredit sətri kimi göstərir (192-205), lakin orijinal ödəniş də art
- **Təsir:** maliyye hesab-çıxarış, debitor running balans, müştəri 360 ledger, CSV export — müştəri ödədiyindən az borclu görünür (son_qaliq yanlış mənfi/aşağı).
- **Düzəliş:** applyAdvanceToInvoice-da avans tətbiqi üçün finance_operations YARADILMAMALI (yalnız payment_allocations + audit kifayətdir), ya da çıxarışda avans tətbiqi həm debet (avans azalır), həm kredit (qaimə bağlanır) net-zero cütü kimi göstərilməli. azn_meblegh=apply olan [AVANS] op kassa hərəkəti olmadığı

### O11 [maliyye (cancel / ləğv)] Ödənişin ləğvi avans (surplus) hissəsini geri qaytarmır → fantom avans qalır
- **Fayl:** features/maliyye/cancel-operation-action.ts:84-120
- **Faktiki:** cancelFinanceOperation yalnız finance_payment_allocations sətirlərini gəzir və odenilmis-i decrement edir (85-107), sonra recalc çağırır. Lakin avans hissəsi üçün allocation sətri YARADILMIR (ödəniş anında yalnız qaiməyə tətbiq olunan hissə üçün allocation yaranır, maliyye/actions.ts:1206-1219; avans isə kontragentler.avans:1237-1245 increment). recalculateCustomerBalance avans field-inə toxunmur 
- **Səbəb:** Avans surplus üçün audit-edilə bilən allocation/iz saxlanılmır; recalc avans-ı derive etmir (avans manual saxlanılır). Cancel yalnız allocation-bazlı reversal edir.
- **Təsir:** kontragentler.avans (getDebtors:717 göstərir), applyAdvanceToInvoice (mövcud olmayan pulu sərf etməyə icazə verir), müştəri 360 avans badge. Pul real olmadan avans yaranır.
- **Düzəliş:** Ödəniş anında surplus hissəni ya ayrıca payment_allocations sətri kimi (satis_id NULL, xüsusi marker) saxla, ya da cancel-da avans hissəsini hesabla: advancePortion = op.azn_meblegh - SUM(allocations.mebleg) və kontragentler.avans-ı bu qədər decrement et (>=0 clamp). [AVANS] op ləğvində isə avansı g

### O12 [elaqe (icazə)] recordContactPayment borc-bağlayan ödənişi 'musteri.duzelt' icazəsi ilə qoruyur (odenis.qebul deyil)
- **Fayl:** features/elaqe/actions.ts:366-368
- **Faktiki:** recordContactPayment requireElaqeActionPerm('musteri.duzelt') yoxlayır (şərhdə 'odenis.qebul' yazılsa da). Yalnız kontakt-redaktə icazəsi olan, lakin ödəniş-qəbul icazəsi OLMAYAN istifadəçi müştəri borcunu bağlaya və daxil maliyyə əməliyyatı yarada bilər — odenis.qebul gate-i bypass olunur.
- **Səbəb:** İcazə açarı maliyyə əməliyyatının həssaslığına uyğun seçilməyib; bütün maliyyə ödəniş yolları odenis.qebul tələb edir, bu isə musteri.duzelt.
- **Təsir:** təhlükəsizlik/icazə modeli, audit — yetkisiz borc-bağlama və finance_op yaratma.
- **Düzəliş:** Guard-ı requireElaqeActionPerm('odenis.qebul') (və ya hər ikisi) et.

### O13 [maliyye (FIFO sıralama)] FIFO orderBy tarix asc — tarix yalnız @db.Date olduğundan eyni günün qaimələrində sıra qeyri-deterministikdir
- **Fayl:** features/maliyye/actions.ts:1115,1487,1657; features/elaqe/actions.ts:392; prisma/schema.prisma:5175
- **Faktiki:** satis_sifarisleri.tarix @db.Date (CURRENT_DATE default) — yalnız gün dəqiqliyi. orderBy: { tarix: 'asc' } ikinci açar (məs. yaradildi/nomre) olmadan eyni günün qaimələrində Postgres sırasını qeyri-deterministik buraxır. Belə halda 10 AZN əvvəlcə 100 AZN qaiməyə düşə (qalıq 90, 2 açıq qalar) və ya əksinə bilər. Pul itmir (cəmi borc düzgün), amma allokasiya SIRASI və göstərilən paylanma proqnozlaşdı
- **Səbəb:** Stabil tiebreaker yoxdur; mövcud yaradildi @db.Timestamp(6) field-i (schema:5184) istifadə olunmur.
- **Təsir:** hesab-çıxarış, debitor row 'açıq sənəd' detalı, müştəri qaimə bağlama gözləntisi — funksional pozulma yox, lakin allokasiya sırası gözlənilməz.
- **Düzəliş:** orderBy-a stabil ikinci açar əlavə et: [{ tarix: 'asc' }, { yaradildi: 'asc' }] (və ya nomre). Eyni iş üçün hər iki allokatorda və getDebtors en_kohne_acig hesablamasında tətbiq et.

### O14 [Anbar / Bron / POS / Ticaret] Aktiv bron həqiqi satışı bloklamır — rezerv yalnız ekran göstərişini azaldır
- **Fayl:** lib/db/stock-guards.ts (safeStockDecrement), features/pos/sale-queries.ts (mapProduct stok_miqdari), features/pos/sale-action.ts, features/ticaret/satis-yeni-actions.ts
- **Faktiki:** safeStockDecrement yalnız xam `stok.miqdar >= miqdar` yoxlayır, broну nəzərə almır. POS/yeni-satış pickeri `stok_miqdari`-ni xam miqdar kimi göstərir (bron çıxılmır), validateCartStock da yalnız xam stok.miqdar yoxlayır. Anbar/stok ekranı isə `movcud = miqdar − rezerv` göstərir. Beləliklə tam bron edilmiş məhsul POS-da hələ də 'mövcud' görünür və satıla bilir — bron real qoruma vermir.
- **Səbəb:** Heç bir satış yolu stok_bron-u oxuyub tutmur (rg ilə təsdiqləndi); rezerv yalnız display sorğularında çıxılır.
- **Təsir:** Bron (gözlənilən qoruma yox), POS/Satış (broн edilmiş malın satılması), Anbar (movcud vs picker arasında uyğunsuzluq), istifadəçi qarışıqlığı.
- **Düzəliş:** safeStockDecrement-ə opsional 'rezervi nəzərə al' rejimi əlavə et (miqdar − aktiv_bron >= tələb), və ya satışdan əvvəl bron yoxlaması; picker stok_miqdari-ni movcud (miqdar−rezerv) kimi göstərsin ki, bütün ekranlarda eyni 'satıla bilən' rəqəm olsun.

### O15 [Ticaret / Anbar / Maliyyə] Alış 'indi qəbul et' (receive_now) yolunda maya proporsional xərcsiz yazılır — iki qəbul yolu fərqli maya verir
- **Fayl:** features/ticaret/alis-actions.ts (yaratma yolu, sətir 128-151 vs receivePurchase sətir 331-348)
- **Faktiki:** Yaratma anındakı receive_now bloku stockIncrement-ə xam `line.qiymet` ötürür (proporsional `paylananXerc` çıxılmır) və mehsullar.alish_qiymeti-ni HEÇ yeniləmir. receivePurchase isə `real_maya_eded` yazır və alish_qiymeti-ni yeniləyir. Eyni alış iki yolla fərqli maya/COGS verir.
- **Səbəb:** İki ayrı medaxil kodu var; yaratma yolu real_maya_eded-i hesablayıb sətrə yazsa da stockIncrement/mehsullar yeniləməsində istifadə etmir.
- **Təsir:** Hesabatlar (marja, COGS, inventar dəyəri), Məhsul kartı (son alış qiyməti), gələcək satışda maya-altı yoxlaması yanlış baza.
- **Düzəliş:** Yaratma yolunda da `sonQiymet: realMayaEded` ver və mehsullar.alish_qiymeti + son_alish_de yenilə (receivePurchase ilə eyniləşdir).

### O16 [Ticaret / Anbar] qaralama_id update yolu mənbə statusu yoxlanmadığı üçün ikiqat decrement / köhnə hərəkət qalığı riski
- **Fayl:** features/ticaret/satis-yeni-actions.ts (createOrUpdateSatisYeni, qaralama_id update yolu, sətir 213-241)
- **Faktiki:** Update yolu `existing.qaralama===true` və ya statusu yoxlamır — yalnız sahibkar uyğunluğunu. Əgər qaralama_id artıq finalize olunmuş (stoku azaldılmış) satışın id-sidirsə, sətrlər silinib yenidən yaradılır və qaralama=false ilə finalize bloku stoku TƏKRAR azaldır; əvvəlki `mexaric` anbar_hereketleri qeydləri isə geri alınmır (sətir silinir, hərəkət qalır) → ledgerdə qoşa məxariç.
- **Səbəb:** Status/qaralama invariantı yoxlanmır; line silinəndə müvafiq anbar_hereketleri reversal edilmir.
- **Təsir:** Anbar (ikiqat azalma, drift), Source-of-truth ledger (artıq mexaric), Audit.
- **Düzəliş:** Update yolunda `if (!existing.qaralama || existing.status!=='qaralama') throw` qoy; alternativ olaraq finalize zamanı köhnə mexaric hərəkətlərini reversal/idempotent et.

### O17 [Anbar / Sayım] Sayım tamamlanmasında stale snapshot — stok `fakti`-yə force-set, aralıqdakı satışlar itir
- **Fayl:** features/anbar/inventar/actions.ts (completeInventar, sətir 250-287)
- **Faktiki:** `sistemde_olan` sayım YARADILANDA snapshot edilir. completeInventar `stok.miqdar = fakti` force-set edir və hərəkəti `Math.abs(fakti − sistemde_olan)` snapshot deltası ilə yazır. Aralıqda satış olsa (stok azalıb), force-set onu üzərinə yazır və ledger hərəkəti faktiki cache dəyişikliyindən fərqlənir → həmin anbar-cütündə drift.
- **Səbəb:** Snapshot vaxtı ilə tamamlama vaxtı arasında konkurent dəyişikliklər nəzərə alınmır (canlı dəyər oxunmur).
- **Təsir:** Anbar (drift), Source-of-truth ledger (cache vs hereket fərqi), Satış (sayım anında satılan mal itə bilər).
- **Düzəliş:** Tamamlama anında canlı `stok.miqdar` oxu və hərəkəti canlı delta ilə yaz (fakti − canlı), və ya sayımı kilidlə/aralıq hərəkətləri tətbiq et.

### O18 [İşçilər / Servis / Ticaret (default kassa fallback)] Default nağd kassa axtarışında nov:"nagd" (yazı səhvi) istifadə olunur — hesablar nov:"negd" ilə yaradılır, ona görə nağd kassa heç vaxt tapılmır
- **Fayl:** features/iscilier/maas-actions.ts:41, features/servis/actions.ts:158, features/ticaret/alis-actions.ts:167
- **Faktiki:** maliye_hesablari.findFirst({ where: { ..., nov: "nagd" } }) heç bir nəticə qaytarmır, çünki AccountSchema (actions.ts:310) və bütün yaratma/POS axını nov:"negd" istifadə edir. Nəticə: maas-actions nağd kassa tapmayıb bank/kart-a fallback edir (maaş səhv hesabdan çıxır); servis avto-ödəniş hesab tapmadığı üçün skip olunur (ödəniş kassaya düşmür, audit-də xəbərdarlıq); alis-actions ödəniş əvəzinə bo
- **Səbəb:** negd↔nagd yazı uyğunsuzluğu: canonical dəyər 'negd' (z.enum(["negd","bank","kart","e_pul","diger"]) — actions.ts:310), lakin 3 fayl 'nagd' sorğusu edir. account-queries.ts:233 is_kassa: h.nov === "nagd" də eyni səhvlə həmişə false qaytarır.
- **Təsir:** maliye_hesablari (səhv hesabdan məxariç), maaş ödənişi, servis kassa hərəkəti, alış ödənişi → kreditor balansı (borc yaranır), hesabatlar, is_kassa filtrləri.
- **Düzəliş:** maas-actions.ts:41, servis/actions.ts:158, alis-actions.ts:167 və account-queries.ts:233-də "nagd" → "negd" düzəlt. Repo boyu tək canonical dəyər (negd) saxla; mümkünsə enum/const ilə mərkəzləşdir ki, gələcəkdə yazı səhvi olmasın.

### O19 [Maliyyə / Əməliyyat xülasəsi] Əməliyyat xülasəsi (KPI kartları) ləğv/soft-delete olunmuş əməliyyatları və gozleyen_tesdiq-i sayır — siyahı isə yalnız aktivləri göstərir (asimmetriya)
- **Fayl:** features/maliyye/operations-queries.ts (getOperationsSummary ~177-230, getOperationStats ~241-264)
- **Faktiki:** getOperations recordStatus='aktiv' default-u ilə deleted_at=null tətbiq edir, lakin getOperationsSummary `where`-də deleted_at/status filtri YOXDUR (yalnız filter.status verilərsə) və recordStatus parametrini tamamilə gözardı edir. Eyni filter obyekti hər ikisinə ötürülür (emeliyyat/page.tsx:53-57). Nəticə: ləğv edilmiş (status='legv') və soft-delete olunmuş əməliyyatlar KPI cəmlərinə daxil olur, 
- **Səbəb:** getOperationsSummary where qurulmasında nə deleted_at=null, nə də status default-u var (sətir 180-184); recordStatus filter sahəsi oxunmur. getOperationStats isə status='aktiv' qoyur amma deleted_at filtri yoxdur.
- **Təsir:** Maliyyə əməliyyat səhifəsi KPI kartları (cəm, daxil, xaric, net), istifadəçiyə göstərilən analitik rəqəmlər — ləğv/silinmiş ödənişlər həqiqi göstəriciləri şişirdir.
- **Düzəliş:** getOperationsSummary və getOperationStats-da default `deleted_at: null` və status filtri tətbiq et; recordStatus parametrini getOperations ilə eyni cür oxu ki, siyahı və xülasə eyni dəsti əks etdirsin.

### O20 [Ticaret qaytarma / Maliyyə payout] Qaytarmada GÖZLƏYƏN payout (komissiya/net) düzəldilmir — yalnız artıq ödənilmiş payout əksinə qeyd olunur
- **Fayl:** features/ticaret/qaytarma-tez-actions.ts:456-504 (returnFullSale)
- **Faktiki:** returnFullSale yalnız finance_operations type_kod='marketplace_payout' sətri MÖVCUDDURSA (yəni payout artıq markPayoutReceived ilə qəbul olunubsa) əks qeyd yaradır. Tipik halda payout HƏLƏ GÖZLƏYİR (default axın: payout gözləmədə). Bu zaman origOp tapılmır (sətir 465-472), reversedFinance=false qalır və finance_marketplace_payments-də gözləyən payout qeydinə HEÇ TOXUNULMUR — gozlenen_meblegh, komi
- **Səbəb:** Qaytarma əks-əməliyyatı yalnız qəbul olunmuş payout-un finance_operations izinə bağlıdır; gözləyən payout (finance_marketplace_payments) cədvəlinə proporsional qaytarma/komissiya korreksiyası tətbiq edilmir.
- **Təsir:** Maliyyə (gözləyən payout şişik qalır, real payout gələndə fərq yaranır), hesabatlar (net/komissiya qaytarmadan sonra düzəlmir, mənfəət şişir). Spec-in payout düzəlişi tələbi pozulur.
- **Düzəliş:** Qaytarmada (returnFullSale/fastReturn) marketplace satışı üçün: əlaqəli gözləyən finance_marketplace_payments tapıb ratio ilə gozlenen_meblegh-i azalt, qaytarma_meblegh-i artır, komissiyanı yenidən hesabla. Payout qəbul olunmuşsa mövcud finance_operations əks qeydi saxlanılsın (hazırkı davranış).

### O21 [hesabatlar / maliyyə (P&L, mənfəət)] Mənfəət bank komissiyası qədər şişirdilir — gəlir net yox, ümumi (gross) hesablanır
- **Fayl:** features/hesabatlar/maliyye-queries.ts (getPlSummary:50, getMonthlyPl12:152)
- **Faktiki:** getPlSummary revenue = SUM(son_mebleg) = 150 (bütün legv-olmayan satışlar, odenis_nov filtri yox). bank_komissiya heç bir yerdə xərc (xerclər) kimi yazılmır və gəlirdən çıxılmır. Nəticədə hər kredit satışda mənfəət düz komissiya məbləği (15) qədər artıq görünür. getMonthlyPl12 də eyni problemlə.
- **Səbəb:** Revenue mənbəyi son_mebleg-dir (müştəri qiyməti). kredit_satislari.bank_komissiya/magaza_net heç bir P&L/xərc sorğusuna bağlanmayıb — grep ilə bank_komissiya/magaza_net yalnız kredit modulunun öz fayllarında istifadə olunur.
- **Təsir:** hesabatlar/maliyye, dashboard mənfəət, marja hesabatı, YoY/aylıq müqayisə — bütün mənfəət göstəriciləri.
- **Düzəliş:** İki seçimdən biri: (a) recordKreditPayment-də bank komissiyasını avtomatik 'xerclər'-ə (komissiya kateqoriyası) yaz; və ya (b) P&L gəlirini kredit satışlar üçün magaza_net ilə əvəz et (COALESCE(k.magaza_net, s.son_mebleg)). Hazırda nə biri var.

### O22 [ticaret / kredit siyahısı + dashboard] Kredit siyahı və KPI kredit-şirkəti satışını 'müştəri borcu' kimi etiketləyir və ümumi (gross) məbləğlə hesablayır
- **Fayl:** features/ticaret/kredit-queries.ts:55-113 (getKreditStats), 235-277 (getMusteriBorc); app/(dashboard)/ticaret/kredit/page.tsx:69,94,108
- **Faktiki:** getKreditStats.toplam_borc = SUM(son_mebleg)-SUM(odenilmis) (gross 150 əsaslı, magaza_net deyil). UI label='Toplam borc' subline='müştəri borcu' və 'Müştəri başına borc (top 10)' (getMusteriBorc) müştərini borclu göstərir. Debitor hesabatı isə bunu göstərmir → modullar arası uyğunsuzluq.
- **Səbəb:** Sorğular son_mebleg ilə hesablayır (magaza_net yox) və müştəri-mərkəzli adlandırma istifadə edir; bank-dan gözlənilən qalıq (magaza_net - odenilmis) ilə qarışdırılır.
- **Təsir:** ticaret/kredit səhbəsi, gözlənilən gəlir təsəvvürü, idarəetmə qərarları.
- **Düzəliş:** Etiketi 'Bankdan gözlənilən net' kimi dəyiş; hesablamada son_mebleg əvəzinə magaza_net işlət; 'müştəri borcu' ifadəsini sil.

### O23 [ticaret / kredit ödənişi (qalıq drift)] Bank net ödəyəndən sonra satışda 15 AZN fantom qalıq qalır (son_mebleg=150, odenilmis=magaza_net=135)
- **Fayl:** features/ticaret/kredit-actions.ts:164-190 (recordKreditPayment)
- **Faktiki:** recordKreditPayment odenilmis-i magaza_net (135) ilə cap edir və status='tamamlandi' qoyur, lakin son_mebleg=150 dəyişmir. Beləliklə son_mebleg-odenilmis=15 sonsuza qədər açıq qalıq kimi qalır: dashboard 'açıq borc' statında (satis-queries.ts:99-106, filtr yox), satış detalında və kredit siyahısında.
- **Səbəb:** son_mebleg (müştəri qiyməti) ilə real daxilolma (magaza_net) arasındakı fərq heç yerdə bağlanmır/sıfırlanmır; tamamlandi yalnız magaza_net əsasında qoyulur.
- **Təsir:** ticaret dashboard açıq borc (fetchSaleStatsRaw), satış detalı qalıq, kredit qaliq sütunu — hamısında 15 AZN fantom borc.
- **Düzəliş:** Kredit satış tam bağlananda komissiya fərqini ya satış üzərində endirim/yazılma kimi qeyd et, ya açıq-borc/qalıq sorğularında odenis_nov='kredit' olanları istisna et.

### O24 [hesabatlar / satış (gəlir göstəriciləri)] Satış KPI/marja hesabatları kredit satışı tam qiymətlə (150) gəlirə qatır, net (135) deyil
- **Fayl:** features/hesabatlar/satis-queries.ts:42-99 (getSalesKpi), 149-166 (getPaymentMethodSlices), 217-241 (getTopProductsExt), 440-492 (getMarginByProduct)
- **Faktiki:** getSalesKpi total_amount=SUM(son_mebleg), getMarginByProduct revenue=SUM(sls.cemi) — hər ikisi 150 əsaslıdır; komissiya nəzərə alınmır. Marja real-dən komissiya qədər yüksək görünür.
- **Səbəb:** Satır səviyyəsində (satis_sifaris_satirlari.cemi) komissiya paylanmır; satış səviyyəsində magaza_net hesabatlara qoşulmayıb.
- **Təsir:** hesabatlar/satis, marja, top məhsul gəlirləri.
- **Düzəliş:** Kredit satışlar üçün komissiyanı ya ayrıca xərc kimi göstər, ya hesabatda net gəlir sütunu əlavə et; ən azı istifadəçini xəbərdar et ki, bu rəqəm gross-dur.

### O25 [Müştəri 360 / Customer Health] Customer 360 'Borc' KPI və Health Score yanlış sahədən (borc) oxuyur — müştəri borcu alacaq sahəsindədir
- **Fayl:** features/elaqe/detail-queries.ts (getCustomer360Kpis sətir 191-211, getCustomerHealthScore sətir 224-250); render: app/(dashboard)/elaqe/musteriler/[id]/page.tsx:682
- **Faktiki:** getCustomer360Kpis və getCustomerHealthScore kontragentler.borc sahəsini oxuyur. Bu sistemdə müştəri borcu yalnız alacaq sahəsində saxlanılır (recalculateCustomerBalance yalnız alacaq-ı yeniləyir; borc müştəri üçün heç vaxt yenilənmir). Nəticədə eyni səhifədə kart başlığı borcu (məs. 500 ₼) göstərir, lakin Customer 360 'Borc' = 0 (və ya köhnə legacy dəyər) göstərir; Health Score-un 'Borc durumu' f
- **Səbəb:** detail-queries.ts:192-194 və 224-227 select: { borc: true } edir və borc-u istifadə edir; halbuki müştəri üçün source-of-truth alacaq-dır (customer-balance.ts şərhi: 'alacaq → müştəri bizdən almalı'). Sahə qarışdırılıb.
- **Təsir:** Müştəri 360 paneli, Health Score / risk təsnifatı. İstifadəçi eyni səhifədə iki fərqli borc rəqəmi görür.
- **Düzəliş:** getCustomer360Kpis və getCustomerHealthScore-da müştəri borcu üçün alacaq (və ya birbaşa calculateCustomerBalance(id).alacaq) istifadə et. İdeal: kart başlığı ilə eyni helper-dən qidalansın ki, drift olmasın.

### O26 [Dashboard / Risk-Fürsətlər vidceti] 'Yüksək borc müştəri' sayğacı yanlış sahədən (borc) sayır — müştərini deyil, təchizatçını sayır
- **Fayl:** features/sahibkar/components/risk-firsetler-widget.tsx:35-37, 90-101
- **Faktiki:** prisma.kontragentler.count({ where: { borc: { gte: 1000 } } }) — borc sahəsi müştəri üçün saxlanılmır; borc = bizim TƏCHİZATÇIYA borcumuzdur. Beləliklə vidcet 'Yüksək borc müştəri' adı ilə əslində bizim 1000+ ₼ borclu olduğumuz TƏCHİZATÇILARI sayır. Borclu müştərilər (alacaq>0) bu sayğaca düşmür — debitor siyahısı ilə uyğunsuzdur.
- **Səbəb:** Müştəri borcu alacaq sahəsindədir; vidcet borc sahəsini istifadə edir (sahə qarışıqlığı). nov filtri də yoxdur.
- **Təsir:** Dashboard risk paneli, sahibkarın gündəlik prioritet siyahısı. Borclu müştərilər nəzərdən qaçır.
- **Düzəliş:** where-i { aktiv: true, nov: { in: ['musteri','her_ikisi'] }, alacaq: { gte: 1000 } } et. Təchizatçı borcu üçün ayrıca metrika lazımdırsa, onu ayrıca 'kreditor' kimi adlandır.

### O27 [Müştəri 360 — Borc/Ödəniş xronologiyası] Borc xronologiyası finance_operations-ı type_kod/istiqamət üzrə filtrləmir — 'her_ikisi' kontragentlərdə alış ödənişlərini səhv qarışdırır
- **Fayl:** features/elaqe/detail-queries.ts:58-63, 99-112 (getContactDebtTimeline)
- **Faktiki:** getContactDebtTimeline finance_operations-ı yalnız { kontragent_id: id, status: 'aktiv' } ilə çəkir — type_kod filtri yoxdur. y_n='daxil' → delta=-m (müştəri borcu azalır), y_n='mexaric' → delta=+m (müştəri borcu artır). 'her_ikisi' tipli kontragentdə təchizatçıya etdiyimiz alış ödənişi (mexaric) müştəri borcunu ARTIRMIŞ kimi görünür və qalan balans (running) səhv hesablanır. Saf müştəri/saf təchi
- **Səbəb:** Vahid kontragent_id altında müştəri (qaime) və təchizatçı (alis_odenis) əməliyyatları birgə sorğulanır; statement isə düzgün olaraq type_kod IN ('qaime','borc_silinme') filtri qoyur. Timeline-da bu filtr buraxılıb.
- **Təsir:** Müştəri kartının Maliyyə tabındakı borc/ödəniş xronologiyası və running balance — her_ikisi kontragentlərdə yanıldıcı.
- **Düzəliş:** Timeline-da finance ops sorğusuna kontragentin rolundan asılı type_kod filtri əlavə et (müştəri görünüşü üçün type_kod IN ('qaime','borc_silinme') və y_n='daxil').

### O28 [Debitor vs Müştəri siyahısı vs Hesab çıxarışı — servis borcu] Servis qalığı yalnız alacaq/kart borcuna daxildir; debitor siyahısında və hesab çıxarışında yoxdur
- **Fayl:** lib/balance/customer-balance.ts:74-90 (servis daxil) vs features/maliyye/queries.ts:662-728 (getDebtors — servis YOX) vs features/maliyye/customer-statement.ts (servis YOX)
- **Faktiki:** calculateCustomerBalance servis qalığını alacaq-a əlavə edir (customer-balance.ts:74-90), beləliklə müştəri siyahısı (alacaq) və kart başlığının bir hissəsi servis borcunu daxil edir. Lakin getDebtors yalnız satis_sifarisleri-dən hesablayır (servis YOX) və getCustomerStatement də yalnız satış/ödəniş/qaytarma sayır. Nəticədə yalnız servis borcu olan müştəri: müştəri siyahısında alacaq>0 görünür, la
- **Səbəb:** Servis borcunun balansa daxil edilməsi yalnız bir mənbədə (customer-balance) həyata keçirilib; debitor, statement və kart-başlığı düsturları servisi nəzərə almır — vahid olmayan borc tərifi.
- **Təsir:** Servis modulu istifadə edən bizneslərdə müştəri borcu modullar arası uyğunsuz. Debitor toplam borcu az göstərir.
- **Düzəliş:** Servis borcunu ya bütün modullara (getDebtors, statement, kart başlığı) əlavə et, ya da heç birinə — vahid bir borc tərifi seç (tercihen hamısı calculateCustomerBalance helper-dən istifadə etsin).

### O29 [Servis → Maliyyə hesabatı (P&L / marja)] Servis ödənişi COGS-ı yanlış şişirdir — müştərinin öz cihazının alış qiyməti satılmış kimi xərcə düşür
- **Fayl:** features/hesabatlar/satis-queries.ts: getPlSummary (sətir 27-35) və maliyye-queries.ts cogs CTE (sətir 159-168); mənbə: features/servis/actions.ts recordPayment satis_sifaris_satirlari.create (sətir 815-824)
- **Faktiki:** recordPayment satis_kimi_qeyd_et=true olanda satis_sifaris_satirlari sətri yaradır: mehsul_id = servis.mehsul_id (müştərinin CİHAZI), miqdar=1, vahid_qiymet=meblegh. getPlSummary/marja COGS-u 'SUM(sls.miqdar * m.alish_qiymeti) JOIN mehsullar m ON m.id = sls.mehsul_id' kimi hesablayır → bu cihazın alış_qiyməti 1 ədəd kimi COGS-a əlavə olunur. Cihazın mağazada alış_qiyməti varsa, hər servis ödənişi 
- **Səbəb:** Xidmət satışı sətri məhsul satışı sətri kimi modelləşdirilib (mehsul_id müştərinin cihazına bağlanıb), amma COGS join bütün satirların məhsulunun alış_qiymetini sayır; servis/xidmət sətirini ayırd etmir.
- **Təsir:** Maliyyə hesabatı (P&L), Marja hesabatı, illik/aylıq trend — brutto marja və COGS yanlış. Gəlir tərəfi düzdür, xərc tərəfi şişib.
- **Düzəliş:** recordPayment-də xidmət satışı sətrini mehsul_id=null ilə yarat (cihazı sətirə bağlama), və ya COGS sorğularına 'AND ss.qeyd NOT LIKE '[XIDMET]%'' / xidmət satışlarını ayıran flag əlavə et. Ən təmizi: xidmət gəlirini satis_sifarisleri-ə yazmamaq, yalnız finance_operations-da saxlamaq və hesabatda se

### O30 [Servis → Anbar (stok-altı bildiriş)] Stok-altı bildirişin 'cari stok'-u anbar_hereketleri-nin BÜTÜN miqdarlarını cəmləyir — mənasız/şişik rəqəm
- **Fayl:** features/servis/actions.ts: addEhtiyatHisse stok-altı yoxlaması (sətir 539-545)
- **Faktiki:** cariStok = anbar_hereketleri.aggregate(_sum:{miqdar}) — yəni mehsul üzrə BÜTÜN hərəkətlərin miqdar cəmi. Lakin anbar_hereketleri.miqdar həmişə MÜSBƏT böyüklükdür, istiqamət 'nov' ilə kodlanır (mexaric/medaxil/servis_mexaric hamısı müsbət). Beləliklə bu cəm daxilolma+çıxış-ı birlikdə müsbət toplayır → real qalıq deyil. Nəticədə min_stok>0 olsa belə 'cariStok <= minStok' demək olar heç vaxt doğru ol
- **Səbəb:** Yanlış mənbə: real qalıq 'stok' cədvəlindədir (addEhtiyatHisse onu decrement edir). Bildiriş üçün isə anbar_hereketleri.SUM(miqdar) işarə nəzərə alınmadan götürülüb.
- **Təsir:** Anbar (stok-altı erkən xəbərdarlıq işləmir → ehtiyat hissə tükənib bilinmir), Servis (təmir gecikir), Təchizat planlaması. Stok özü düzgün azalır, yalnız bildiriş səhvdir.
- **Düzəliş:** cariStok-u 'stok' cədvəlindən oxu: prisma.stok.aggregate({where:{mehsul_id,sahibkar_id}, _sum:{miqdar}}). Və ya anbar_hereketleri-dən net hesablamaq lazımdırsa, nov üzrə CASE WHEN (medaxil/+ , mexaric/servis_mexaric/-) tətbiq et.

### O31 [Servis — Ehtiyat hissə siyahısı (detay səhifə)] Silinmiş ehtiyat hissələr siyahıda qalır — original + reversal sətri ikiqat görünür, parts cəmi temir_xerci ilə uyğunsuz olur
- **Fayl:** features/servis/queries.ts: getServisEhtiyatHisseler (sətir 1448-1468)
- **Faktiki:** getServisEhtiyatHisseler ref_nov=servis & ref_id üzrə BÜTÜN anbar_hereketleri sətirlərini götürür və nov üzrə filtr etmir, hər miqdarı Math.abs ilə müsbət göstərir. deleteEhtiyatHisse hard-delete etmir, nov=servis_iade reversal sətri yaradır. Nəticədə silinmiş hissə üçün həm original (servis_mexaric, müsbət), həm reversal (servis_iade, müsbət) sətri 'işlədilmiş hissə' kimi görünür. Stok-suz əlavəl
- **Səbəb:** Sorğu nov dəyərlərini (servis_mexaric / servis_mexaric_stoxsuz / servis_iade) ayırd etmir və net hesablamır.
- **Təsir:** Servis detalı (parts siyahısı və onun cəmi temir_xerci-dən fərqlənir → operator çaşır), müştəriyə təqdim olunan akt/parts izahı yanlış ola bilər.
- **Düzəliş:** Sorğunu nov üzrə qrupla: çıxış (servis_mexaric, servis_mexaric_stoxsuz) müsbət, servis_iade mənfi kimi net edib mehsul üzrə yekunlaşdır; net miqdar/dəyər 0 olanları gizlət. Beləcə siyahı temir_xerci dəyişiklikləri ilə uyğunlaşar.

### O32 [Maaş / Komissiya] İki paralel komissiya sistemi — sabit 3% (detal.satis_komisyon) və pilləli tarif (kpi_bonus) — eyni satışı ikiqat hesablayır
- **Fayl:** features/iscilier/maas-actions.ts:191 + features/ticaret/commission-actions.ts:120
- **Faktiki:** calculateBordro hər işçiyə satis_meneceri_id üzrə son_mebleg cəminin sabit 3%-ni hesablayıb detal.satis_komisyon-a yazır (COMMISSION_RATE=0.03). Ayrıca calculateCommission pilləli tarif (commission_tiers) ilə komissiya hesablayıb kpi_bonus-a yazır — eyni satis_meneceri_id satışları üzrə. maas-table.tsx:215 və bordro-print bonus sütununda HƏR İKİSİNİ (satis_komisyon + kpi_bonus) cəmləyib göstərir. 
- **Səbəb:** calculateBordro-da hardcoded 3% (maas-actions.ts:100,191) ilə commission-queries.ts pilləli tarif sistemi paralel mövcuddur, bir-birini sıxışdırmır.
- **Təsir:** Maaş bordrosu, NET, maliyyə, hesabatlar/emekdas, KPI dashboard bonus sütunu.
- **Düzəliş:** Vahid komissiya mənbəyi seçin: ya calculateBordro-dakı sabit 3%-i ləğv edin (detal.satis_komisyon=0), ya calculateCommission-u tək rəsmi yol edin. Bonus sütununda ikiqat cəmləməni aradan qaldırın.

### O33 [Maaş / Avans / Maliyyə] Avans (qabaqcadan ödəniş) NET-dən çıxılır, lakin kassadan çıxan pul kimi maliyyəyə heç vaxt yazılmır
- **Fayl:** features/iscilier/maas-actions.ts:507-562 (adjustBordro 'avans')
- **Faktiki:** avans yalnız adjustBordro/saveBonusOrPenalty/addDisciplinaryAction düsturlarında son_meblegh = gross - cerime - avans - vergi - sosial kimi NET-dən çıxılır. Lakin avans təyin olunanda HEÇ BİR finance_operations / kassa məxarici yaranmır (recordMaasFinanceLeg yalnız payBordro/bulkPay-də maaş üçün çağırılır, avans üçün yox). Yəni: işçiyə avans nağd verilir → kassadan pul fiziki çıxır, amma sistemdə 
- **Səbəb:** Avans üçün ayrıca finance leg (məxariç) yaradan kod yoxdur (grep: avans+finance_operations.create = 0 nəticə). avans sadəcə bordro sahəsi kimi saxlanılır.
- **Təsir:** Maliyyə (kassa/bank qalığı şişir), finance_operations, pul axını hesabatı, əməkdaş kartı (avans tarixçəsi yox), audit.
- **Düzəliş:** Avans veriləndə (adjustBordro field='avans' artımı və ya ayrıca avans action) recordMaasFinanceLeg-ə bənzər məxariç finance_operations + recalculateAccountBalance yaradın və isci_odenisleri-yə nov='avans' qeydi salın. Maaş ödənişində cüt sayımın qarşısını alın.

### O34 [Maaş / Davamiyyət] Prorata hesablamasında qaib olmayan bütün davamiyyət statusları (istirahet/mezuniyyet/gecikib) 'faktiki iş günü' kimi sayılır
- **Fayl:** features/iscilier/maas-actions.ts:166-188 (calculateBordro)
- **Faktiki:** attendance groupBy ['istifadeci_id','status'] gətirir, sonra `if (status==='qaib') qaib++ else faktiki++` (sətir 169-172). Beləliklə 'mezuniyyet', 'istirahet', 'gecikib', 'qaydasinda' hamısı faktiki-yə əlavə olunur. ish_faktiki = att?.faktiki ?? norma(22). Əgər işçinin yalnız 10 günlük 'qaydasinda' qeydi varsa amma qalan günlər heç qeyd edilməyibsə, faktiki=10 → prorata azalır (gözlənilməz); əksin
- **Səbəb:** Status ayrımı yalnız qaib vs digər; 'faktiki' yalnız real iş statuslarını (qaydasinda/gecikib) əhatə etməlidir, mezuniyyet/istirahet kənar tutulmalıdır. norma fallback (22) heç davamiyyət qeydi olmayanda tam maaş verir.
- **Təsir:** Prorata maaş, NET, bordro, ödəniş, bordro-print.
- **Düzəliş:** faktiki sayımına yalnız ['qaydasinda','gecikib'] statuslarını daxil edin; mezuniyyet/istirahet günlərini ayrı saxlayıb prorata düsturunda nəzərə alın. Davamiyyət qeydi tam olmayan ayda fallback=norma əvəzinə gözlənilən iş günü sayını istifadə edin.

### O35 [KPI Dashboard] KPI dashboard net_maas = aylik_maas(brüt) + bonus − cərimə — vergi/sosial/avans/prorata nəzərə alınmır, bordro NET-i ilə uyğunsuzdur
- **Fayl:** features/iscilier/kpi-dashboard-queries.ts:344
- **Faktiki:** net_maas: maas + bonusQaz - cerime (sətir 344). Burada maas = aylik_maas (tam brüt, prorata deyil), bonusQaz = calculateMonthlyBonus nəticəsi (bordrodakı kpi_bonus/manual_bonus deyil), vergi/sosial/avans çıxılmır. Beləliklə KPI dashboard-dakı net_maas bordrodakı son_meblegh-dən fərqlidir; eyni işçi iki səhifədə iki müxtəlif 'net' görür. cemi_maas summary da brüt aylik_maas cəmidir.
- **Səbəb:** Dashboard net_maas-ı bordrodan oxumur, öz sadələşdirilmiş düsturu ilə hesablayır; bonusQaz mənbəyi (calculateMonthlyBonus profil) bordro kpi_bonus-undan fərqli ola bilər.
- **Təsir:** KPI dashboard, performans sıralaması, idarəetmə qərarları (yanlış net qavrayışı).
- **Düzəliş:** net_maas-ı bordrodakı son_meblegh-dən (varsa) götürün, yoxdursa prorata-vergi-sosial-avans daxil tam düsturla hesablayın. bonus mənbəyini bordro ilə uyğunlaşdırın.

### O36 [Bonus hesablama] calculateMonthlyBonus nəticəsi (qazanilan bonus) heç vaxt bordroya (kpi_bonus) yazılmır — yalnız display
- **Fayl:** features/iscilier/kpi-dashboard-queries.ts:314 + bonus-calc.ts
- **Faktiki:** calculateMonthlyBonus (bonus-calc.ts) davamiyyet/tapsiriq/sehv/borc_yigim/satis_hedef üzrə pool və qazanilan bonusu hesablayır; KPI dashboard-da bonus_qazanilan kimi göstərilir və performans skoruna 30% çəki ilə daxil olur. Lakin bu dəyəri maas_hesablamalar.kpi_bonus-a yazan heç bir action yoxdur (grep təsdiqlədi). Yəni bordroya yalnız ticaret/commission-actions kpi_bonus yazır (tamam fərqli düstu
- **Səbəb:** bonus-calc.ts yalnız oxu/hesablama; bordroya yazma körpüsü (persist) mövcud deyil. İki ayrı 'bonus' anlayışı (KPI profil bonusu vs komissiya kpi_bonus) eyni kpi_bonus sahəsi üzərində qarışır.
- **Təsir:** KPI dashboard, əməkdaş detal səhifəsi (bonusCalc), performans skoru, işçi gözləntisi vs real ödəniş.
- **Düzəliş:** calculateMonthlyBonus nəticəsini bordroya tətbiq edən action əlavə edin (kpi_bonus-a yazıb son_meblegh-i yeniləyən), VƏ YA UI-da bunun yalnız təxmini/simulyasiya olduğunu açıq göstərin. Komissiya kpi_bonus-u ilə profil bonusunun eyni sahəni üzərinə yazmasının qarşısını alın.

### O37 [Tapşırıqlar → Xəbərdarlıqlar (alerts)] Alert seviyyə dəyəri yanlış: 'yuxsek' — heç bir severity sxeminə uyğun deyil
- **Fayl:** features/tapshiriqlar/actions.ts (_executeOverdueCheckForTenant), sətir 723
- **Faktiki:** Alert `seviyye: 'yuxsek'` ilə yaradılır. AlertSeverity = 'info' | 'xeber' | 'risk' | 'kritik' (features/alerts/queries.ts). 'yuxsek' yazı səhvidir (həm də 'yuksek' də sxemdə yoxdur). severity-badge.tsx-də STYLES['yuxsek'] tapılmır → fallback STYLES.risk-ə düşür; SEVERITY_RANK-da da tapılmır → sıralama/kritik sayğacında yanlış davranır.
- **Səbəb:** Severity vokabulyarı ilə uyğunsuzluq + typo ('yuxsek'). Eyni typo features/alerts/actions.ts sendAlertToApproval-da prioritet üçün də var ('yuxsek').
- **Təsir:** Xəbərdarlıqlar UI (badge rəngi/etiketi), severity üzrə filtr/sıralama, Nəzarət Mərkəzi kritik sayğacı.
- **Düzəliş:** `seviyye: 'kritik'` və ya 'risk' (etibarlı dəyər) istifadə et. Severity enum-u TypeScript union/const kimi paylaş və alert yaratmazdan əvvəl validasiya et.

### O38 [Tapşırıqlar → Xəbərdarlıqlar (alerts)] Tapşırıq tamamlananda/ləğv olunanda açıq overdue alert avtomatik bağlanmır
- **Fayl:** features/tapshiriqlar/actions.ts (changeTaskStatus, sətir 351-432)
- **Faktiki:** changeTaskStatus alert-lərə heç toxunmur. Tapşırıq tamamlanır, amma Xəbərdarlıqlar mərkəzində açıq qalan 'Gecikən tapşırıq' alert-i əl ilə bağlanana qədər asılı qalır. İstifadəçi tapşırığı bitirsə də xəbərdarlıq sayğacı düşmür.
- **Səbəb:** Tapşırıq→alert əks-istiqamətli sinxronizasiya yoxdur. createTask/overdue alert yaradır, amma tamamlanma alert-i resolve etmir (stok modulunda mövcud olan auto-clear məntiqi tapşırıqda yoxdur).
- **Təsir:** alerts, Nəzarət Mərkəzi açıq alert sayğacı, xeberdarliqlar səhifəsi, KPI 'həll olunan' metriki.
- **Düzəliş:** changeTaskStatus-da status ∈ {tamamlandi, legv} olduqda: prisma.alerts.updateMany({ where: { tapshiriq_id, kateqoriya_kod:'tapshiriq', status:{ in:['yeni','baxilir','snoozed'] } }, data:{ status:'hell_olundu', resolved_at: now, resolution_note:'Tapşırıq tamamlandı' } }) əlavə et və alerts:${sahibkar

### O39 [Tapşırıqlar → Eskalasiya/bildiriş] escalation_to heç vaxt təyin edilmir — eskalasiya rəhbərə deyil, həmişə icraçının özünə gedir
- **Fayl:** features/tapshiriqlar/components/new-task-dialog.tsx + actions.ts (escalation_to)
- **Faktiki:** Heç bir formada və ya server action-da escalation_to yazılmır (qrep: yalnız actions.ts oxuyur, new-task-dialog yalnız escalation_enabled checkbox-u var). Nəticədə overdue check-də `assigned_to: t.escalation_to || t.mesul_id` həmişə mesul_id-yə düşür; `if (t.escalation_to)` bloku heç vaxt işləmir → eskalasiya bildirişi göndərilmir. Eskalasiya funksiyası faktiki olaraq ölü kod kimidir.
- **Səbəb:** escalation_to sahəsini dolduran UI/action yoxdur; yalnız boolean escalation_enabled var, hədəf istifadəçi heç yerdə seçilmir.
- **Təsir:** Eskalasiya axını, gecikən tapşırıq üçün rəhbər xəbərdarlığı, alerts.assigned_to təyini.
- **Düzəliş:** new-task-dialog-a escalation_to (rəhbər/istifadəçi seçimi) sahəsi əlavə et və createTask schema/insert-də yaz; və ya escalation_enabled olduqda mesul_id-nin rəhbərini (təşkilati ierarxiyadan) avtomatik escalation_to et.

### O40 [Tapşırıqlar KPI/bonus] Gec tamamlanan tapşırıq cərimələnmir — late completion 1.2x on-time bonus əmsalı alır
- **Fayl:** features/tapshiriqlar/kpi-actions.ts (calculateTaskBonus, sətir 69, 82-83)
- **Faktiki:** `gecikmis` yalnız HAL-HAZIRDA açıq + vaxtı keçmiş tapşırıqları sayır: `status NOT IN ('tamamlandi','legv') AND deadline < now`. Deadline-dan SONRA tamamlanmış tapşırıq 'tamamlandi' kimi sayılır və gecikmis-ə düşmür. Beləliklə hər şeyi gec bitirən işçinin gecikmis=0 olur → koef=1.2 (tam on-time bonusu). Bu, rəsmi KPI mühərriki (iscilier/bonus-calc.ts, kpi-dashboard-queries.ts) ilə ZİDDİR — onlar `t
- **Səbəb:** gecikmis tərifi 'tamamlanmamış + vaxtı keçmiş' kimi qoyulub; 'gec tamamlanmış' (tamamlandi_de > deadline) halı nəzərə alınmır. İki ayrı KPI mənbəyi (tapshiriqlar/kpi-actions vs iscilier/bonus-calc) fərqli düstur işlədir.
- **Təsir:** Tapşırıq bonusu hesabatı, ai-analiz səhifəsi, əməkdaş motivasiya ölçüsü; iscilier KPI ilə nəticə uyğunsuzluğu.
- **Düzəliş:** gecikmis-ə gec tamamlananı da əlavə et: `(status NOT IN ('tamamlandi','legv') AND deadline < now) OR (status='tamamlandi' AND tamamlandi_de > deadline)`. İdeal: vahid KPI helper yarat və hər iki modul onu çağırsın.

### O41 [Tapşırıqlar KPI (cross-module uyğunsuzluq)] İşçi KPI yalnız mesul_id-yə görə hesablanır, icraçı (tapshiriq_iscilier) tapşırıqları KPI-dən kənarda qalır
- **Fayl:** features/iscilier/kpi-dashboard-queries.ts (~146-165) və bonus-calc.ts (~212-231) vs features/tapshiriqlar/queries.ts getTaskPerformanceAnalytics
- **Faktiki:** Rəsmi iscilier KPI mühərriki (kpi-dashboard-queries və bonus-calc 'tapsiriq' KPI-si) tapşırıqları YALNIZ mesul_id = istifadeci ilə sayır; tapshiriq_iscilier link cədvəlini tamamilə ignore edir. Halbuki tapshiriqlar modulunun öz analitikası (getTaskPerformanceAnalytics, kpi-actions calculateTaskBonus) mesul_id UNION tapshiriq_iscilier işlədir. Beləliklə yalnız icraçı kimi təyin olunan (mesul olmaya
- **Səbəb:** İki KPI mənbəyi tapşırıq-istifadəçi bağlantısını fərqli modelləşdirir (biri sadəcə mesul_id, digəri mesul_id+iscilier). Vahid 'tapşırıq sahibi' tərifi yoxdur.
- **Təsir:** iscilier KPI dashboard, bordro/bonus hesablama, ai-analiz; eyni işçi üçün iki yerdə fərqli rəqəm.
- **Düzəliş:** Bütün tapşırıq KPI mənbələrində eyni iştirakçı tərifini (mesul_id + tapshiriq_iscilier UNION, və ya yalnız mesul_id) seç və hər iki modulda eyni SQL/helper işlət.

### O42 [Hesabatlar / Satış export (Excel)] Excel export Xülasə vərəqi stealth (gizli rejim) ilə kiçildilmiş rəqəm yazır — sənəd öz detal vərəqləri ilə uyğunsuz
- **Fayl:** app/api/hesabatlar/satis/export/route.ts
- **Faktiki:** Export route getSalesKpi() çağırır — bu funksiya cəm məbləğ/orta çek/maks satış/endirim/qaytarma məbləğini stealth.scale ilə vurur (satis-queries.ts sətir 84-96). Lakin Gündəlik, Top məhsullar, Top müştərilər, Satıcılar, Ödəniş, pivot vərəqləri xam (real) dəyər göstərir. Stealth aktivdirsə Xülasə vərəqi 20% kiçik, qalan vərəqlər 100% real — sənəd özü ilə ziddiyyətli və real datanı sızdırır.
- **Səbəb:** getSalesKpi içində getStealthState() tətbiqi var; export-da realScale=1 keçirilmir. Digər query-lərdə stealth yoxdur.
- **Təsir:** Mühasibatlıq/vergi üçün ixrac olunan Excel etibarsız: KPI cəmi detallarla toplaşmır. Stealth təyinatı (real export) pozulur.
- **Düzəliş:** Export yolunda getSalesKpi-ni stealth-siz çağırmaq üçün opsiya əlavə et (məs. realScale parametri) və ya export-da KPI-ları detal vərəqlərindən yenidən hesabla. Ümumiyyətlə stealth scale-i yalnız UI komponent səviyyəsində tətbiq et, query layında yox.

### O43 [Hesabatlar / Executive hub + Satış səhifəsi] Stealth scale yalnız bəzi KPI-lara tətbiq olunur — eyni səhifədə qarışıq miqyaslı rəqəmlər
- **Fayl:** app/(dashboard)/hesabatlar/page.tsx (ExecutiveKpiSection) və app/(dashboard)/hesabatlar/satis/page.tsx
- **Faktiki:** Executive hub-da 'Bu ay satış' getSalesKpi (stealth-scaled), amma 'Net mənfəət'/'Brüt mənfəət'/'OPEX' getPlSummary (scale YOX), 'Stok dəyəri' getStockCounters (scale yox), 'Kassa qalığı' getCashFlowSummary30 (scale yox), 'Debitor borc' getDebtBuckets (scale yox). Stealth aktivdirsə satış 20% göstərilib, lakin mənfəət 100% — net mənfəət satışdan böyük görünə bilər (absurd). Satış səhifəsində də KPI
- **Səbəb:** Stealth yalnız getSalesKpi və dashboard KPI-larında tətbiq olunub; digər hesabat query-lərində yoxdur (rg ilə təsdiqləndi: features/hesabatlar/*.ts-də getStealthState yalnız satis-queries.ts-də).
- **Təsir:** Gizli rejim demo/təqdimat üçün etibarsız: rəqəmlər bir-biri ilə uyğunsuz və real dəyərlər qismən sızır.
- **Düzəliş:** Stealth miqyasını ya bütün hesabat dəyərlərinə vahid şəkildə (tercihen yalnız render səviyyəsində formatMoney wrapper-də), ya da heç birinə tətbiq et. Hesabat səhifələrində qismən tətbiqdən imtina et.

### O44 [Dashboard vs Hesabatlar / Xərc] Dashboard xərci raw 'mebleg', hesabatlar 'mebleg_azn' istifadə edir — valyuta fərqli xərclərdə uyğunsuzluq
- **Fayl:** features/dashboard/queries.ts (fetchMonthlyComparisonRaw, fetchSalesVsExpense30Raw) vs features/hesabatlar/maliyye-queries.ts/pul-queries.ts
- **Faktiki:** xerclər cədvəlində həm mebleg, həm mebleg_azn (= mebleg*mezenne, generated) var. Dashboard fetchMonthlyComparisonRaw (sətir 327,331) və fetchSalesVsExpense30Raw (sətir 695) SUM(mebleg) istifadə edir. Hesabatlar getPlSummary (sətir 37), getExpenseCategories, getFixedVariableBreak, getMonthlyPl12 SUM(mebleg_azn) istifadə edir. Valyutası USD/EUR olan xərclərdə (mezenne≠1) iki rəqəm fərqli olur — dash
- **Səbəb:** Sahə adı qeyri-ardıcıl seçilib (mebleg vs mebleg_azn) dashboard və hesabatlar arasında.
- **Təsir:** Dashboard 'aylıq müqayisə' mənfəəti və 'satış vs xərc' qrafiki P&L hesabatı ilə uyğun gəlmir (yalnız çox-valyutalı tenantlarda).
- **Düzəliş:** Hər iki yerdə mebleg_azn istifadə et (AZN normalizasiya). Tək-valyuta tenantlarda fərq yoxdur, amma multi-currency üçün düzəliş vacibdir.

### O45 [Hesabatlar / Maliyyə (P&L)] COGS qaralama (draft) satış sətirlərini sayır, lakin gəlir saymır — brüt mənfəət azaldılır + 12-aylıq qrafik qaytarmanı saymır
- **Fayl:** features/hesabatlar/maliyye-queries.ts (getPlSummary, getMonthlyPl12)
- **Faktiki:** (1) getPlSummary revenue agg-ı 'qaralama: { not: true }' filtrli, AMMA cogsAgg query-si yalnız 'status != legv' (qaralama filtri YOX, sətir 27-34). Beləliklə draft satışların mayası COGS-a daxil olur, gəliri isə yox — brüt mənfəət süni azalır. Eyni problem getMonthlyPl12 cogs CTE-də (qaralama filtri yox, sətir 159-168). (2) getMonthlyPl12 ümumiyyətlə returns çıxmır, getPlSummary isə çıxır — P&L ka
- **Səbəb:** COGS query-lərində 'AND ss.qaralama IS NOT TRUE' əskik; monthly trend-də returns mərhələsi yoxdur.
- **Təsir:** Brüt/net mənfəət hesabatı və Executive hub mənfəət KPI-ları az göstərilir; 12-aylıq trend qrafiki ilə P&L kartı uyğunsuz.
- **Düzəliş:** Bütün COGS query-lərinə qaralama IS NOT TRUE əlavə et. Monthly P&L-ə returns çıxılmasını əlavə et və ya hər iki yerdə eyni (returns-dən sonrakı/əvvəlki) tərifi seç.

### O46 [Hesabatlar / İdxal-Alış] Alış/idxal cəmi ləğv edilmiş (status='legv') və silinmiş alışları daxil edir
- **Fayl:** features/hesabatlar/idxal-queries.ts (getImportStats, getSupplierBreakdown)
- **Faktiki:** getImportStats alis_sifarisleri.aggregate-i status VƏ deleted_at filtri OLMADAN istifadə edir (yalnız tarix). getSupplierBreakdown də status filtri yoxdur. alis_sifarisleri-də həm status (default 'gozlemede', 'legv' mümkün) həm deleted_at var. getImportStatusBreakdown statusları ayrı göstərir, beləliklə KPI cəmi (bütün statuslar daxil) status breakdown-un toplamı ilə uyğun gəlir, amma 'ləğv' alışl
- **Səbəb:** idxal-queries.ts sətir 24-27 (aggregate where: yalnız tarix) və sətir 51-64 (status şərti yoxdur).
- **Təsir:** İdxal hesabatı total_amount/borc şişirdilir; təchizatçı borcu (idxal səhifəsi) reallıqdan çox göstərilir.
- **Düzəliş:** getImportStats və getSupplierBreakdown-a status != 'legv' (və mümkünsə deleted_at IS NULL) əlavə et.

### O47 [Hesabatlar / Əməkdaş export] Əməkdaş performans CSV-si boş sütunlarla çıxır — başlıqlar data açarları ilə uyğun deyil
- **Fayl:** features/hesabatlar/actions.ts (exportStaffPerformanceCsv)
- **Faktiki:** rowsToCsv başlıqları ['ad_soyad','vezife','sifaris_sayi','gelir','marja','hedef_faiz'] kimi verilir, lakin getStaffPerformance StaffPerf obyektləri fərqli açarlardadır: ad (ad_soyad deyil), sifaris_say (sifaris_sayi deyil), cemi (gelir deyil), endirim/endirim_pct/roi. csvCell(r[h]) uyğun gəlməyən açarlarda undefined→boş qaytarır. Nəticədə 'vezife' xaric demək olar bütün sütunlar boş olur (ad sütun
- **Səbəb:** actions.ts sətir 113-116: başlıq massivi StaffPerf field adları ilə uyğunlaşdırılmayıb.
- **Təsir:** Əməkdaş performans ixracı praktiki olaraq istifadəsizdir (boş data).
- **Düzəliş:** Başlıqları StaffPerf açarlarına uyğunlaşdır (ad, vezife, sifaris_say, cemi, endirim_pct, roi) və ya rowsToCsv-ə açar→başlıq xəritələmə əlavə et.

### O48 [Maliyyə hesabatları] Silinmiş (ləğv edilmiş) xərclər maliyyə hesabatlarına və dashboard-a daxil olur
- **Fayl:** features/hesabatlar/pul-queries.ts (getExpenseCategories, sətir 147-157) və features/maliyye/queries.ts (getTopExpenseCategories sətir 236-247, getMaliyyeSummary aqreqatları sətir 30/123/131, gündəlik/aylıq P&L sətir 222/326)
- **Faktiki:** Bu hesabat sorğularının HEÇ birində `legv_de IS NULL` (və ya deleted_at) filtri yoxdur — yalnız sahibkar_id və tarix filtri var. deleteExpense xərci legv_de timestamp ilə soft-delete edir, lakin bu aqreqatlar onu cəmə daxil edir.
- **Səbəb:** pul-queries.ts getExpenseCategories: `WHERE x.sahibkar_id=... AND x.tarix>=...` — legv_de filtri yox. queries.ts getTopExpenseCategories və getMaliyyeSummary xercl_r.aggregate çağırışları yalnız tarix filtri ilə. Xərc siyahısı və EDV/yol-vergisi hesabatları (legv_de IS NULL var) ilə uyğunsuzdur.
- **Təsir:** Hesabatlar > Pul axını, Hesabatlar > Maliyyə (P&L), maliyyə xülasəsi səhifəsi, maliyyə export API (app/api/hesabatlar/maliyye/export), maliyyə dashboard top-xərc widget-i — silinmiş xərc məbləği mənfə
- **Düzəliş:** Bütün xərc aqreqatlarına `AND (legv_de IS NULL)` / Prisma `legv_de: null` əlavə et. Layihə standartına uyğun olaraq deleteExpense-də həm deleted_at həm legv_de yazmaq, və ya bütün filtrlərdə vahid sahə (legv_de) istifadə etmək tövsiyə olunur.

### O49 [Dashboard / Ticarət KPI] Dashboard 'bugün/həftə/ay satış' məbləği silinmiş və ləğv edilmiş satışları sayır
- **Fayl:** features/ticaret/satis-queries.ts (fetchSaleStatsRaw / getSaleStats, sətir 84-98)
- **Faktiki:** bugun/hefte/ay aqreqatları yalnız `qaralama: { not: true }` filtri ilədir — deleted_at və status='legv' filtri YOXDUR. Eyni faylda borc_total sorğusu (sətir 99-106) düzgün filtr tətbiq edir, lakin satış məbləği KPI-ları etmir. Qeyd: dashboard-queries.ts-də getTradeKpis həmin KPI-ları DÜZGÜN filtrlə hesablayır — yəni iki fərqli mənbə fərqli rəqəm verir.
- **Səbəb:** prismaUnscoped.satis_sifarisleri.aggregate where: yalnız { sahibkar_id, tarix, qaralama: { not: true } } — deleted_at: null və status: { notIn: ['legv','qaytarilib'] } buraxılıb.
- **Təsir:** Dashboard satış kartları (getSaleStats istifadə edən səhifə) ləğv edilmiş satışı gəlir kimi göstərir; getTradeKpis ilə fərqli rəqəm — istifadəçi üçün ziddiyyət.
- **Düzəliş:** where-ə `deleted_at: null, status: { notIn: ['legv','qaytarilib'] }` əlavə et (borc_total sorğusu və dashboard-queries.ts ilə eyni standart).

### O50 [Ticarət / Satışlar] Satışlar siyahısı yalnız son 50 sətri göstərir — pagination YOXDUR, qalan bütün satışlar UI-dan əlçatmazdır
- **Fayl:** app/(dashboard)/ticaret/satislar/page.tsx (SalesContent) + features/ticaret/satis-queries.ts (getSales) + features/ticaret/components/sales-table.tsx
- **Faktiki:** SatislarPage SalesContent içində getSales(filter) çağırır — page ötürülmür, ona görə həmişə page=1, take=50 işləyir (getSales: page=1,pageSize=50 default, take:pageSize, skip:(page-1)*pageSize). Səhifə sp.page-i HEÇ oxumur və <Pagination> render olunmur. SalesTable header-i isə real {total} nəticə (məs. 1240) göstərir, amma cədvəldə yalnız ilk 50 sətir var. 50-dən sonrakı bütün satışlar əlçatmazdı
- **Səbəb:** getSales(filter) page arqumentsiz çağırılır (satislar/page.tsx ~sətir 90) + page.tsx-də Pagination komponenti yoxdur. Query take:50/skip ilə paginated-dir, lakin UI bunu idarə etmir.
- **Təsir:** Ticarət (satış axtarışı/audit), Maliyyə (debitor üzgəcləmə üçün satışa keçid), Hesabatlar — istifadəçi köhnə satışı siyahıdan tapa bilmir, yalnız axtarış/filtr ilə daraltsa görünür.
- **Düzəliş:** Mehsullar/Müştərilər patternini tətbiq et: sp.page oxu, getSales(filter, page, PAGE_SIZE) çağır, SalesTable-a page/pageSize/basePath ötür və <Pagination total pageSize page basePath='/ticaret/satislar'> render et.

### O51 [Ticarət / Satışlar (və eyni pattern: Təkliflər, Alışlar, Əməliyyatlar)] Sütun başlığı ilə sıralama yalnız yüklənmiş 50/100 sətir üzərində client-side işləyir — server sort/dir parametrlərini IGNORE edir, ona görə qlobal sıralama yanlışdır
- **Fayl:** features/ticaret/components/sales-table.tsx (sorted=useMemo([...items].sort)) + features/ticaret/satis-queries.ts (orderBy sabit)
- **Faktiki:** SortableTh onClick URL-ə ?sort=...&dir=... yazır, lakin getSales sabit orderBy:[{tarix:desc},{yaradildi:desc}] istifadə edir və sort/dir-i heç oxumur. SalesTable client-side [...items].sort() yalnız serverdən gələn 50 (ən yeni) sətri yenidən sıralayır. Nəticədə 'ən böyük satış' əslində yalnız son 50 satış arasında ən böyükdür — qlobal deyil. Eyni qüsur teklif-table (take 100), purchases-table, ope
- **Səbəb:** Server query sort/dir parametrlərini orderBy-a tətbiq etmir (satis-queries.ts ~195, teklif-queries.ts ~152, alis-queries.ts ~52, operations-queries.ts ~52); cədvəl komponenti client-side sort edir.
- **Təsir:** Ticarət (satış/təklif/alış), Maliyyə (əməliyyatlar) — analitik qərarlar (top satış, ən köhnə borc) yanlış sıralamaya əsaslanır.
- **Düzəliş:** Sort/dir-i server query-yə ötür və orderBy dinamik qur (mehsullar getProducts.sirala kimi), sonra pagination ilə birlikdə işlət. Client-side sort-u sil ki, qismən datada yanıltmasın.

### O52 [Ticarət / Alışlar] Alışlar siyahısı yalnız ilk 50 alışı göstərir — pagination YOXDUR, qalan alışlar əlçatmazdır
- **Fayl:** app/(dashboard)/ticaret/alislar/page.tsx + features/ticaret/alis-queries.ts (getPurchases) + features/ticaret/components/purchases-table.tsx
- **Faktiki:** alislar/page.tsx getPurchases(filter) çağırır (page ötürülmür → page=1, take=50). PurchasesTable header-də {total} nəticə göstərir, amma cədvəldə yalnız 50 sətir; <Pagination> render olunmur. 50-dən sonrakı alışlar görünmür. Bu, Satışlar ilə eyni qüsurdur (cüt: Satışlar köhnə, Məhsullar modern — uyğunsuzluq).
- **Səbəb:** getPurchases(filter) page arqumentsiz; page.tsx-də Pagination yoxdur.
- **Təsir:** Ticarət (alış izləmə), Anbar (mədaxil sənədinə keçid), Maliyyə/Kreditor.
- **Düzəliş:** sp.page oxu, getPurchases(filter, page, PAGE_SIZE) + <Pagination basePath='/ticaret/alislar'> əlavə et.

### O53 [Maliyyə / Əməliyyatlar] Maliyyə əməliyyatları yalnız ilk 100 sətirlə məhdudlaşır — səhifə page=1 hard-coded, pagination yoxdur
- **Fayl:** app/(dashboard)/maliyye/emeliyyat/page.tsx + features/maliyye/operations-queries.ts (getOperations) + features/maliyye/components/operations-table.tsx
- **Faktiki:** emeliyyat/page.tsx getOperations(filter, 1, 100) çağırır — page sabit 1, take=100. OperationsTable header 'N qeyd' göstərir, sort client-side 100 sətir üzərində, <Pagination> yoxdur. 100-dən köhnə əməliyyatlar UI-dan görünmür.
- **Səbəb:** getOperations(filter, 1, 100) hard-coded page; page.tsx Pagination render etmir; server orderBy sabit.
- **Təsir:** Maliyyə (kassa/bank dövriyyəsi, audit), Hesabatlar — köhnə ödəniş/xərc əməliyyatı tapılmır.
- **Düzəliş:** sp.page oxu, getOperations(filter, page, PAGE_SIZE), server-side sort + <Pagination basePath='/maliyye/emeliyyat'>.

### O54 [Maliyyə / Debitor (və eyni: Kreditor)] Debitor/Kreditor BÜTÜN sətirləri serverə yükləyir (LIMIT yoxdur), filter/sort/axtarış JS-də edilir, pagination yoxdur — böyük tenant-da donma riski
- **Fayl:** app/(dashboard)/maliyye/debitor/page.tsx + app/(dashboard)/maliyye/kreditor/page.tsx + features/maliyye/queries.ts (getDebtors/getCreditors)
- **Faktiki:** getDebtors() raw SQL ilə LIMIT-siz bütün borclu sətirləri qaytarır; debitor/page.tsx allRows üzərində q/gecik/menecer filtr + sort JS-də edir və rows.map ilə HƏR sətri render edir (Pagination yoxdur). Üstəlik top-25 debitor üçün ayrıca getOpenSalesForCustomer N dəfə çağırılır (Promise.all 25 sorğu). Eyni vəziyyət Kreditor-da. Bu səhifələr ümumiyyətlə köhnə dizayndadır (lokal KpiCard, inline <form>
- **Səbəb:** getDebtors/getCreditors take/skip-siz; səhifə client-deyil server JS-də filtr edir, Pagination komponenti istifadə olunmur.
- **Təsir:** Maliyyə (debitor/kreditor idarəetmə) — yüzlərlə-minlərlə borclu olan tenant-da TTFB və serializasiya ağırlaşır, brauzer donma riski.
- **Düzəliş:** Server-side pagination + filtr (mehsullar/müştərilər patterni) tətbiq et; ən azı take + Pagination əlavə et, top-N open-sales pre-fetch-i drawer açılanda lazy et.

### O55 [Ticarət / Təkliflər] Təkliflər siyahısı sabit 100 sətirlə kəsilir — pagination yoxdur, 100-dən çox təklif görünmür
- **Fayl:** app/(dashboard)/ticaret/teklif/page.tsx + features/ticaret/teklif-queries.ts (getTeklifler, take:100)
- **Faktiki:** getTeklifler(filter, limit=100) sabit take:100 ilə kəsir; teklif/page.tsx <Pagination> render etmir. Status pill-ləri (counts) real toplamı göstərir, lakin cədvəl maksimum 100 sətir. 100-dən çox təklifi olan tenant köhnələri görə bilmir. (Satışlar vs Təkliflər cütü: hər ikisi köhnə pattern, lakin Təkliflər hətta sp.page belə yoxdur.)
- **Səbəb:** getTeklifler limit=100 hard; page yoxdur; Pagination yoxdur.
- **Təsir:** Ticarət (təklif izləmə, satışa çevirmə) — köhnə təklif əlçatmaz.
- **Düzəliş:** getTeklifler-ə page/pageSize əlavə et, count(*) qaytar, <Pagination basePath='/ticaret/teklif'> render et.

### O56 [Anbar / Konsiqnasiya, Bron, Transfer, İnventar] Anbar list səhifələri sabit take ilə kəsilir (300/200/200/50) — heç birində Pagination yoxdur, limitdən sonrakı qeydlər görünmür
- **Fayl:** app/(dashboard)/anbar/konsiqnasiya/page.tsx (getKonsList take:300), anbar/bron/page.tsx (getBronList take:200), anbar/transfer/page.tsx (getTransfers take:200), anbar/inventar/page.tsx (getInventories take:50)
- **Faktiki:** getKonsList take:300, getBronList take:200, getTransfers take:200, getInventories take:50 — hamısı sabit kəsir və müvafiq page.tsx-lərdə <Pagination> yoxdur. İnventar xüsusən aşağı limit (50) ilə daha tez problemə düşür. Bu modullar arasında limit dəyəri də qeyri-ardıcıldır (50 vs 200 vs 300).
- **Səbəb:** Query-lər take ilə kəsir, page/skip və Pagination dəstəyi əlavə edilməyib.
- **Təsir:** Anbar (konsiqnasiya/bron/transfer/sayım tarixçəsi) — köhnə sənədlər siyahıdan görünmür; tutarsız limitlər UX uyğunsuzluğu yaradır.
- **Düzəliş:** Vahid PAGE_SIZE + server-side skip/take + Pagination tətbiq et (hereketler/mehsullar referansı). İnventar take:50-i ən qabaqdır.

### O57 [Ticaret / Qaytarma / Maliyyə (server action error handling)] Raw Prisma/DB error mesajı istifadəçiyə toast kimi sızır (safeUserMessage bypass olunur)
- **Fayl:** features/ticaret/satis-actions.ts:200,249; features/ticaret/satis-yeni-actions.ts:592; features/qaytarma/actions.ts:137,274,312; features/maliyye/cancel-operation-action.ts:166; +~35 fayl
- **Faktiki:** ~40 action faylı catch blokunda birbaşa `return { ok: false, error: e instanceof Error ? e.message : 'Xəta' }` qaytarır. Bu dəyər UI-da `toast.error(res.error)` (məs. features/qaytarma/components/new-return-dialog.tsx:112, accept-return-button.tsx:19) ilə olduğu kimi göstərilir. $transaction içində FK pozulması (P2003), unique constraint (P2002), record-not-found (P2025) və ya recalculate* raw SQL
- **Səbəb:** Layihədə güclü safeUserMessage() sanitizer mövcuddur, lakin yalnız ~18 faylda istifadə olunur; ticaret/qaytarma/maliyyə/iscilier/ayarlar action-larının böyük hissəsi onu bypass edib raw e.message qaytarır. İntent olaraq atılan `throw new Error('Azərbaycanca mesaj')` halları düzgün işləyir, problem y
- **Təsir:** İstifadəçi təcrübəsi (qorxuducu texniki mesaj), həmçinin informasiya ifşası (DB sxema adları). Modullar: ticaret, qaytarma, maliyyə, iscilier, ayarlar, marketplace, crm.
- **Düzəliş:** Bütün catch blokarında `error: safeUserMessage(e, 'fallback')` istifadə et (intent throw-lar üçün safeUserMessage onsuz da <150 simvol az mesajı olduğu kimi qaytarır). Minimal addım: stock-actions.ts-dəki pattern-i (dostca pattern test + safeUserMessage fallback) hər yerə tətbiq et.

### O58 [İnteqrasiya / Excel import (API route)] İstifadəçiyə-baxan import endpoint raw String(e) (Prisma/DB xəta mətni) JSON-da qaytarır
- **Fayl:** app/api/inteqrasiya/import/[key]/route.ts:45,70; app/api/inteqrasiya/parse/[key]/route.ts:34
- **Faktiki:** importByKey catch-i `return NextResponse.json({ error: String(e) }, { status: 500 })` (sətir 70); parse catch-i `'Excel faylı oxuna bilmədi: ' + String(e)` (sətir 45). importByKey DB write etdiyi üçün Prisma constraint xətası (unique/FK) raw İngilis mətni kimi import-wizard UI-da görünür.
- **Səbəb:** API route catch bloku safeUserMessage istifadə etmir, String(e) ilə bütün error obyektini serializə edir.
- **Təsir:** İnteqrasiya/import modulu, istifadəçiyə texniki sızma. Server-to-server cron route-ları (String(e) qaytaran) low-risk-dir, amma bu endpoint istifadəçiyə baxır.
- **Düzəliş:** İki catch-də də `error: safeUserMessage(e, 'Fayl emal edilə bilmədi')` istifadə et; server-də console.error onsuz da var.

### O59 [Ticaret / Qaytarma / Maliyyə (eyni-zamanlılıq)] Status yoxlaması kilidsiz SELECT ilə oxunur — iki paralel sorğu (sürətli double-click / iki tab) hər ikisi keçə bilər
- **Fayl:** features/qaytarma/actions.ts:153-209 (acceptReturn); features/maliyye/cancel-operation-action.ts:47-82 (cancelFinanceOperation)
- **Faktiki:** acceptReturn tx içində ret.status !== 'tesdiqlenmemis' yoxlayır, amma findUnique kilid (FOR UPDATE) qoymur; eyni anda iki transaction hər ikisi 'tesdiqlenmemis' oxuyub stoku iki dəfə artıra bilər (READ COMMITTED altında). cancelFinanceOperation eyni naqil: findFirst status='legv' yoxlaması kilidsiz. UI disabled={pending} tək klik üçün qoruyur, amma iki tab / şəbəkə təkrarı qorunmur.
- **Səbəb:** İdempotentlik status sahəsi ilə yoxlanılır, lakin row-level lock və ya conditional update (updateMany where status='tesdiqlenmemis' → affected=0 yoxlaması) yoxdur.
- **Təsir:** Anbar (ikiqat stok artımı), maliyyə (ikiqat balans korreksiyası), qaytarma. POS-dakı client_op_id idempotentliyi burada yoxdur.
- **Düzəliş:** Status keçidini conditional updateMany ilə et: `updateMany({ where: { id, status: 'tesdiqlenmemis' }, data: { status: 'tamamlandi' } })` və `count === 0` olduqda 'artıq qəbul edilib' throw et — bu, ekstra effekt yazmazdan ƏVVƏL atomik kilid rolunu oynayır.

======================================================================

## 8. KİÇİK BUGLAR (17)
- [Debug / İnfo açılması] Production-da açıq debug endpoint — daxili ID-lər və DB diaqnostikası → Endpoint-i sil və ya `if(process.env.NODE_ENV==='production') return 404` + platform-admin yoxlaması əlavə et.
- [POS / Endirim sətir hesabı (yuvarlaqlaşma)] Sətir endirimi faiz-ə çevriləndə yuvarlaqlaşma son_mebleg ilə göstərilən məbləğ arasında qəpik fərqi yarada bilər → Sətir net məbləğini (cemi) birbaşa göndər/hesabla, faizə çevirməni minimuma endir; ya server, ya klient tək source kimi qəbul olunsun.
- [Qaytarma — orijinal satışla əlaqə] fastReturn miqdar/məbləği orijinal satış sətirinə qarşı yoxlamır — satılandan çox qaytarma mümkündür → fastReturn və returnFullSale-də qaytarılan miqdarı orijinal satış sətirinin miqdarından (mənfi əvvəlki qaytarmalar) çox olmamasına məhdudlaşdır.
- [Anbar / Hesabat] Stok 'sağlamlıq' KPI-da ümumi say stok sətri olmayan məhsulları da sayır — normal/saglamlik təhrifi → Total-ı eyni stok-əsaslı populyasiyaya bərabərləşdir (məs. stok sətri olan distinct mehsul) və ya 'yox' tərifinə stok sətri olmayanları da daxil et.
- [Ticaret marketplace satış (komissiya)] İstifadəçi komissiyanı qəsdən 0% qoyduqda sistem onu platform default-u ilə əvəz edir → Komissiya sahəsini nullable et (undefined=default istifadə et, 0=qəsdən sıfır). Sentinel 0 əvəzinə null/undefined yoxla.
- [Müştəri kartı (paylaşılan komponent) — Təchizatçı görünüşü] Təchizatçı kartında borc getContactStats (purchase_total - purchase_paid, status!=legv) ilə hesablanır — supplier-balance/statement ilə kiçik fərq riski → getContactStats aqreqasiyalarına deleted_at: null (və satışlar üçün qaytarilib istisnası) əlavə et ki, balans helper-ləri ilə eyni filtrdən istifadə o
- [Servis — Toplu status dəyişimi] Toplu status dəyişimi servis_status_tarixce yazmır və zəmanət uzatmasını/recalc-ı atlayır — tarixçə boşluğu → bulkChangeServisStatus-da hər id üçün status_tarixce row yarat (updateMany sonrası evvelki statusları oxuyub batch insert), ideal halda changeServisSt
- [Servis — Public rate-limit] Rate-limit audit_log sayımı sahibkar_id ilə filtrlənmir və xəta halında 'fail-open'-dir → audit count-a sahibkar_id əlavə et (token-dən məlumdur) və fail-open əvəzinə konservativ limit (məs. yalnız bu pəncərədə icazə) tətbiq et və ya logla.
- [Maaş / Bonus] Bonus/cərimə əlavəsində satış komissiyası gross-a daxil edilir, lakin yeni yaradılan bordroda satis_komisyon hesablanmır → Yeni bordro yaradan bütün yollarda (saveBonusOrPenalty, addDisciplinaryAction) cari ayın satış komissiyasını hesablayıb detal.satis_komisyon-a yazın, 
- [Tapşırıqlar → daily-briefing (auto borc tapşırığı)] Sistem yaratdığı borc tapşırığı tapshiriq_iscilier link-i yaratmır → borc-tasks.ts-də mesul üçün tapshiriq_iscilier.create(rol='icraci') əlavə et və ya bütün avtomatik yaratmaları vahid createTaskFor/internal helper-dən
- [Tapşırıqlar → Audit] Cron tərəfindən yaradılan overdue alert-lər audit log-a düşmür → _executeOverdueCheckForTenant-in özündə created>0 olduqda audit('overdue_yoxla','tapshiriq',null,{ mode:'cron', yaradilan_alert: created }) yaz (syste
- [Hesabatlar / Müqayisə action] Dövr müqayisəsi satış/məhsul metrikası qaralama (draft) satışları çıxmır → getValue() satış where-lərinə qaralama: { not: true } əlavə et.
- [Hesabatlar / Müştəri] VIP seqment kəsim həddi yanlış indeks ilə hesablanır (top 10% deyil) → VIP-i percentile əvəzinə açıq qaydaya bağla (məs. LTV > X və ya top N) və ya cutoff hesablamasını Math.max(1, ...) ilə qoru; dövr əsaslı LTV lazımdırs
- [Hesabatlar / Pul axını] 'Son 30 gün' başlığı altında qarışıq dövr: bəzi bloklar ay-əvvəli, bəziləri son 30 gün → Bütün blokları eyni dövrə (son 30 gün və ya bu ay) gətir, ya da hər kartın başlığında dövrü açıq göstər.
- [Soft-delete infrastruktur] Mərkəzi generic soft-delete/restore/hard-delete helperləri heç bir yerdə çağırılmır (ölü kod) — restore axını real deyil → Ya helperləri sil (ölü kod) ya da modul cancel action-larını onların üzərinə qur; satış/alış üçün restore action əlavə edərkən status+balans+stok bərp
- [Anbar / İnventar] Force soft-delete edilən məhsulun stok qalığı sıfırlanmır — inventar dəyərindən səssizcə itir → Force silmədə stoku anbar_hereketleri mexaric sətri ilə sıfırla (silmə səbəbi ilə) ki, inventar dəyəri düşməsi audit-də izlənsin.
- [UI/UX — Form validation tutarlılığı] Server validation generik 'Forma yanlışdır' qaytarır (hansı sahə səhvdir bilinmir); 121 forma manual useState validasiyası ilə işləyir → safeParse uğursuzluqlarında `parsed.error.issues[0]?.message` (sxemada Azərbaycanca .min/.max mesajları ilə) qaytar — cancelFinanceOperation:40-da art

### Əlavə (öz kodumda tapdığım): LiteThemeScript <script> React warning — client naviqasiyada dizayn atributları yenilənməyə bilər. Düzəliş: useEffect-ə qaytarıb SSR atributu root-da saxlamaq.

======================================================================

## 17. RİSKLİ HİSSƏLƏR (auditorların şübhəli qeyd etdiyi)
- [auth-perm] Mərkəzi qoruma modeli iki ayrı qatdan ibarətdir: (1) layout-dakı gateRoute YALNIZ səhifə naviqasiyasını qoruyur (x-pathname header), (2) server action-larda fərdi requireXxxActionPerm. Server action-lar gateRoute-dan KEÇMİR — yəni hansısa action-da action-perm unudulubsa, səhifə gating-i onu qorumur. 155 server action faylından yalnız ~85-i action-perm helper-i istifadə edir; qalanların bir hissəsi yalnız read və ya yalnız tenant-scope olsa da, ayar/maliyyə yazma action-larında boşluqlar tapıldı (yuxarıdakı buglar). Bütün 'use server' faylları sistematik audit edilməlidir.
- [auth-perm] gateRoute() tanınmayan prefiks üçün default-ALLOW edir (route-gate.ts sətir 112). Yeni modul/route əlavə olunduqda ROUTE_RULES-a yazılmazsa, o avtomatik açıq qalır (yalnız səhifə-daxili guard varsa qorunur). Yeni route əlavə edərkən bu siyahını yeniləmək intizamı vacibdir.
- [auth-perm] BYPASS_PREFIXES siyahısı (/elaqe, /tapshiriqlar, /ai, /xeberdarliqlar və s.) bu prefiksləri gateRoute-da tam default-allow edir; bu bölmələrin daxili səhifə/data guard-larına tam etibar olunur — onların icazə yoxlaması ayrıca audit edilməlidir.
- [auth-perm] rol_ad-əsaslı privileged bypass çox yerdə substring match-lə işləyir (rolAd.includes('admin'/'sahibkar'/'owner'/'direktor'/'muhasib')). RESERVED_ROLE_NAME yeni rol adlarını qorusa da, köhnə/seed/migrasiya ilə yaranmış adlarda bu sözlərin təsadüfi substring kimi olması (məs. 'administrativ köməkçi' → 'admin') yanlış privileged nəticə verə bilər. Tam-uyğunluq (===) və ya enum-əsaslı rol tipi daha təhlükəsizdir.
- [auth-perm] istifadeci_filial cədvəli sahibkar_id daşımır və TENANT_MODELS-də deyil — bu cədvələ toxunan BÜTÜN kodlar (yalnız saveFilialUserPerm yox) əl ilə tenant yoxlaması etməlidir; başqa istifadə yerləri də yoxlanmalıdır.
- [auth-perm] JWT 7 gün ömürlüdür və icazə kodları 300s cache + manuel refresh-perms endpoint ilə təzələnir; lakin rol_ad/aktiv stale qalır. /api/refresh-perms yalnız çağıranın öz rol_id-sinin cache-ini təzələyir — başqa istifadəçinin rolu dəyişdirildikdə onun cache-i təzələnmir (revalidateTag saveRolePerms-də edilir, amma changeUserRole-da yeni rolun cache-i deyil).
- [pos] Offline növbə (lib/pos/offline-queue.ts) localStorage QuotaExceeded olduqda ən köhnə 50%-ni atır (writeQueue sətir 45-52) — sinxron olunmamış offline satışlar SƏSSİZ İTİR. Audit/log yoxdur. Risk: kassa offline çox qalsa satış məlumatı tam itə bilər.
- [pos] finance_operations yaranması best-effort (try/catch, sətir 298-351) — uğursuz olsa satış bağlanır, sadəcə safeAuditLog 'finance_operation_skip' yazılır. Maliyyə hesabatı bu satışı görmür, kimsə əl ilə düzəltməlidir. Drift mənbəyi.
- [pos] commitCampaignApplications və applyBonusToSale transaction-dan KƏNARDA (commit-dən sonra) işləyir — biri uğursuz olsa satış var, amma kampaniya/bonus tətbiq olunmur (qismən hal). Atomik deyil.
- [pos] checkCustomerCreditLimit və discount limit yoxlamaları $transaction-dan ƏVVƏL (pre-flight) edilir; transaction daxilində təkrar yoxlanmır. İki paralel nisyə satışı eyni anda limiti keçə bilər (TOCTOU). Üstəlik borc field bug-u ilə birlikdə limit onsuz da effektsiz.
- [pos] qaralama/park edilmiş satış localStorage-də 24 saat saxlanılır, lakin restore zamanı stok/qiymət/endirim_mode köhnə dəyərlərlə bərpa olunur — aralıqda qiymət dəyişibsə köhnə qiymətlə satıla bilər (UI yenidən validate etmir).
- [pos] Stealth (scale) UI göstəricilərinə tətbiq olunur (session-queries s çarpanı), amma əsl satış məbləğlərinə yox — auditə görə qəsdən ola bilər, lakin sessiya zolağı ilə real kassa fərqi yarada bilər.
- [pos] looksLikeBarcode 6+ rəqəm pattern-i: 6+ rəqəmli SKU/kod ad axtarışı ilə tapılmır, yalnız barkod lookup-a düşür — barkodu olmayan rəqəmli kodlu məhsul tapılmaya bilər.
- [ticaret-lifecycle] İki ayrı qaytarma alt-sistemi mövcuddur və davranışları fərqlidir: features/qaytarma/actions.ts (acceptReturn — orijinal satışın son_mebleg-ini AZALDIR) və features/ticaret/qaytarma-tez-actions.ts (fastReturn/returnFullSale — odenilmis-i ARTIRIR). Eyni biznes hadisəsi (müştəri qaytarması) iki müxtəlif uçot mexanizmi ilə işlənir — uzunmüddətli drift və qarışıqlıq riski. Hansının 'rəsmi' olduğu aydın deyil.
- [ticaret-lifecycle] kassa_emeliyyatlari-də qaytarma sətirinin işarə konvensiyası (mənfi mebleg) sənədləşdirilməyib və modullar arasında ziddiyyətlidir (kassa-queries müsbət-medaxil-mənfi fərz edir, pul-queries müsbət-xaric fərz edir). Yeni hesabat yazan tərtibatçı asanlıqla səhv tərəfi seçə bilər.
- [ticaret-lifecycle] returnFullSale tam qaytarmada satışın son_mebleg-ini saxlayır (yalnız status='qaytarilib'), getSalesKpi/getDailySales isə qaytarilib statusunu çıxmadan son_mebleg-i gəlir kimi sayır — bu 'gross satış + ayrıca qaytarma sətiri' dizaynı kimi izah oluna bilər, AMMA marja hesabatında belə ayrıca qaytarma sətiri yoxdur, ona görə net mənfəət yanlışdır. Dizayn niyyəti sənədləşdirilməlidir.
- [ticaret-lifecycle] cancelSale-də __BLOCKED__ blocker yalnız səbəb mətnində 'ödəniş/refund/geri qayt/avans' sözləri olduqda keçilir (sətir 285-298) — bu zəif bir 'acknowledge' mexanizmidir; istifadəçi sadəcə bu sözü yazaraq real refund etmədən ödənilmiş satışı ləğv edə bilər, kassa reverse-i isə nisyə-hissəvi halda baş vermir (yuxarıdakı orta bug).
- [ticaret-lifecycle] qaytarma_satirlari heç vaxt orijinal satis_sifaris_satirlari ilə birbaşa bağlanmır (yalnız header original_id ilə) — hissəvi qaytarmada hansı sətirin/miqdarın qaytarıldığını dəqiq izləmək və ikiqat qaytarmanı önləmək çətindir.
- [payment-debt] lib/balance/customer-balance.ts:95 — avans=0 hardcode: kontragentler.avans heç vaxt SoT alacaq-a daxil edilmir. Müştəri 10 borclu, 5 avansı varsa, alacaq=10 göstərilir (net 5 yox). Avans yeni nisyə satışda avtomatik tətbiq olunmur. Receivables sistematik şişir; avans və borc eyni anda mövcud ola bilər (məntiqi ziddiyyət).
- [payment-debt] cashflow-queries.ts:32-44 — 'daxil' SUM(odenilmis) satışın tarix-i ilə bucket-lənir. Nisyə satışın odenilmis-i sonradan ödənişlə artır, amma bucket orijinal satis.tarix-dədir. İyunda yığılan yanvar nisyə ödənişi cash-flow-da YANVAR daxil kimi görünür — real pul axını vaxtı yox, gəlir tanınma vaxtı göstərilir. Cash-flow hesabatı yanlış dövrə aid edir.
- [payment-debt] recordContactPayment idempotency guard-ı yoxdur (receivePartialPayment-də [IDEM:] var, maliyye/actions.ts:1081-1093). PaymentDialog ikiqat submit / refresh / ikinci tab dublikat ödəniş yarada bilər (qaimələri over-pay edib avansa itələyər + ikinci finance_op).
- [payment-debt] İki sign konvensiyası eyni vaxtda kod bazasında: borc müsbət (SoT yazır) vs mənfi (bəzi KPI/widget gözləyir). Yeni sorğu yazan developer hansı konvensiyaya güvənəcəyini bilməyəcək — gələcək reqressiya riski yüksək.
- [payment-debt] Müştəri borcu üç fərqli formula ilə göstərilir: getDebtors canlı open-total (avans çıxılmır, servis daxil deyil), calculateCustomerBalance (servis daxil, avans=0), getContactStats (detail). Eyni müştəri üçün fərqli rəqəmlər — istifadəçi etibarını pozur.
- [payment-debt] applyAdvanceToInvoice avans qaliqını findFirst snapshot-dan (k.avans) oxuyur, transaksiya başlamazdan əvvəl — concurrent iki avans tətbiqi eyni avansı iki dəfə sərf edə bilər (race condition, avans mənfiyə düşə bilər).
- [anbar-stock] features/ticaret/satis-actions.ts cancelSale heç bir 'stok faktiki azaldılıbmı' yoxlaması etmir — təsdiq-gözləyən və ya finalize olunmamış (yeni statuslu, decrement olmamış) satışın ləğvi stoku QONDARMA olaraq artırır (heç vaxt azaldılmamış malı 'geri qaytarır') + saxta medaxil hərəkəti. Birinci kritik bug ilə birləşəndə daha təhlükəli.
- [anbar-stock] Konsiqnasiya geri qəbulu (acceptKonsReturn) malı `hedef_anbar_id ?? k.anbar_id`-ə qaytarır — konsiqnasiya verilərkən mənbə anbar ən-çox-stoklu anbar avtomatik seçilirdi (createKons), geri qaytarmada başqa anbara düşə bilər; ledger düzgün qalsa da fiziki/anbar uyğunsuzluğu mümkündür.
- [anbar-stock] satis_sifaris_satirlari.cemi DB-generated sütundur (miqdar*qiymet*(1−endirim)); başlıq son_mebleg əl ilə hesablanır — vat/catdirma/endirim_mebleg başlıqda, sətrdə yox. Qaytarmada `total` sətirdən hesablanır, vat/çatdırılma daxil edilmir; nisyə qaytarmada açıq borca tətbiq olunan məbləğ vat-sız ola bilər (kiçik uyğunsuzluq).
- [anbar-stock] emitStockChange (kanal/marketplace sync) bir çox yoldan çağırılır — təsdiq-gözləyən finalize edilməyən satış stoku azaltmadığından kanal sync düzgün miqdar göndərsə də, kritik bug #1 səbəbindən faktiki stok yanlış qaldığı halda marketplace-ə yanlış qalıq push oluna bilər.
- [anbar-stock] scanStockDrift yalnız stok sətri olan (mehsul,anbar) cütlərini yoxlayır; ledgerdə hərəkəti olan amma stok sətri silinmiş cütlər drift hesabına düşmür (LEFT JOIN stok → ledger tərəfi orphan qalır).
- [maliyye] recurring (runRecurringCheck) təkrarlanan əməliyyatları status='aktiv' kimi birbaşa yaradır, threshold təsdiq gate-i tətbiq etmir — yüksək məbləğli recurring transfer/xərc avtomatik aktivləşir və balansa təsir edir, təsdiq mərhələsini ötür. Yoxlanmalı: getThresholdMap/needsApproval recurring-də işləmir.
- [maliyye] paySupplierAllOpen və paySupplierInvoice-də checkAccountSufficient yoxlaması alis_sifarisleri.odenilmis increment-dən SONRA çağırılır. Transaction içində rollback olduğu üçün korrupsiya olmur, amma kod ardıcıllığı kövrəkdir; gələcəkdə partial commit risk yaradır.
- [maliyye] approveOperation status gozleyen_tesdiq→aktiv keçirir, lakin təsdiqdən sonra recalculateAccountBalance ÇAĞIRILMIR (yalnız status update + revalidatePath). Beləliklə təsdiqlənmiş yüksək məbləğli əməliyyat maliye_hesablari.qaliq cache-inə dərhal əks olunmur — yalnız həmin hesaba növbəti əməliyyat recalc edəndə düzəlir. calculateAccountBalance source-of-truth düz olsa da cache drift yaranır.
- [maliyye] markPayoutReceived hesab/ödəniş-növü ziddiyyəti yoxlamasını (ALLOWED marketplace_payout: bank/kart/marketplace) tətbiq ETMİR — bu yoxlama yalnız saveQuickOperation-da var. Payout-u nağd kassaya yönəltmək mümkün ola bilər (yalnız payout-accept-dialog UI filtri qoruyur).
- [maliyye] calculateAccountBalance valyuta yoxlamır: fərqli valyutalı hesab arasında transferdə azn_meblegh/meblegh2 AZN-ə çevrilmə düzgün olmalıdır, amma əgər meblegh2 mənbə valyutada saxlanılarsa transfer_daxil səhv ola bilər. valyuta_mubadile formu 'hədəf məbləğ alınan valyutada' deyir — bu dəyərin AZN-ə çevrilməsi (yoxsa xarici valyutada) yoxlanmalıdır.
- [maliyye] borc_silinme (yon='neutral', needKontragent) hesaba təsir etmir, lakin kontragent balansına necə təsir etdiyi və audit izi bu auditdə dərinləşdirilmədi — borc silinməsinin debitor/kreditor balansına düzgün əks olunması yoxlanmalıdır.
- [marketplace] Webhook satışı musteri verilibsə recalculateCustomerBalance çağırır (route.ts:243) və odenilmis=cem qoyur — B2C marketplace adətən anonim olduğundan musteri çox vaxt null olur; lakin musteri varsa balansın necə davrandığı (gross 'ödənilmiş' kimi) əl ilə yoxlanmalıdır.
- [marketplace] Webhook satışında stok yalnız defaultAnbar (ilk anbar id asc) üzərindən azalır (route.ts:122); satış həqiqətdə başqa anbardan olmalıdırsa stok yanlış anbardan düşür. Çox-anbarlı sahibkarda risk.
- [marketplace] Webhook satışında stok qismən çatışmırsa azaldilan=min(qalig, miqdar) edilir amma satış tam məbləğlə (cem) yazılır — satılmış miqdar vs faktiki azaldılmış stok arasında uyğunsuzluq (oversell) baş verə bilər; spec-ə birbaşa aid deyil amma stok/satış data-axınına təsir edir.
- [marketplace] getMarketplacePlatformCards (maliyye/marketplace-queries.ts) və getPlatformBreakdown (hesabatlar) net üçün COALESCE(xalis_meblegh, son_mebleg - komisyon_meblegh) istifadə edir; webhook satışları üçün hər ikisi NULL/0 olduğundan net=gross — bütün marketplace mənfəət hesabatları şişik göstərə bilər.
- [marketplace] startMarketplaceReconciliation ferq:0 sabit yazır (actions.ts:786) amma schema-da ferq generated column-dur; manual ferq yazısı generated dəyərlə ziddiyyət/iqnor oluna bilər — payout fərq hesablanması əl ilə yoxlanmalı.

## 18. SİZİN ƏL İLƏ YOXLAMALI OLDUĞUNUZ SSENARİLƏR
- [auth-perm] Aşağı icazəli istifadəçi (yalnız isci.view, məs. satıcı) ilə daxil ol və birbaşa /iscilier/maas URL-inə keç — bütün əməkdaşların maaş cədvəlinin göründüyünü və 'Export' düyməsi ilə Excel endirilə bildiyini yoxla (gözlənilən: icazə-yox redirect olmalıdır, amma hazırda data açılır).
- [auth-perm] Kassir/anbarçı rolu ilə daxil ol, browser dev-tools/şəbəkə ilə createFilialHesab və ya saveFilial server action-ını birbaşa çağır (formData ilə) — yeni maliyyə hesabı/filial yaradıla bildiyini yoxla. Eyni şəkildə saveFilialUserPerm ilə özünə kassa_biler/gizli_alish_biler icazəsi ver.
- [auth-perm] İki ayrı sahibkar (tenant A və B) yarat. A tenant-ındakı istifadəçi ilə saveFilialUserPerm action-ını B tenant-ının istifadeci_id + B-nin filial_id-si ilə çağır — yazmanın baş tutub-tutmadığını yoxla (gözlənilən: bloklanmalı; hazırda tenant yoxlaması yoxdur).
- [auth-perm] Real API key ilə xarici çağırış simulyasiya et: GET /api/v1/marketplace/products?kanal=<kod>&key=<key> və POST /api/v1/marketplace/orders/<kanal> — 200 yox, 500 [tenant-guard] xətası aldığını təsdiqlə (marketplace inteqrasiyasının sınıq olduğunu göstərir).
- [auth-perm] Admin istifadəçini başqa istifadəçiyə changeUserRole ilə 'kassir'-ə endir, HƏMİN istifadəçinin hələ açıq sessiyasında /maliyye, /ayarlar kimi admin bölmələrinə girə bildiyini yoxla (7 gün JWT staleness). Eyni testi toggleUserField(aktiv=false)/deleteUser ilə təkrarla — deaktiv edilmiş istifadəçinin hələ də işləyə bildiyini yoxla.
- [auth-perm] Risk qaydaları: adi istifadəçi ilə saveRiskRules action-ını birbaşa çağırıb maya_alti_action='warn' (block əvəzinə) et; sonra maya-altı satışın artıq bloklanmadığını POS-da yoxla.
- [auth-perm] Maliyyə icazəsi olmayan istifadəçi ilə /api/musteri/<id>/hesab-cixaris.csv?from=..&to=.. URL-ini aç — müştərinin tam debet/kredit/balans CSV-sinin endirilə bildiyini yoxla.
- [pos] Qarışıq ödəniş: Pro rejimdə 100 AZN səbət, 40 nağd + 30 kart + 30 bank böl, satışı tamamla. Yoxla: gün sonu kassada cari_negd 100 yox 40 olmalı; kassanı bağla — fark 60 AZN çatmazlıq görünürmü? Maliyyə → hesablar: kart/bank hesabına 30+30 düşübmü yoxsa hamısı nağda?
- [pos] Kart satışı: bir məhsulu 'Kart' ilə sat. Maliyyə → maliye hesabları: bu məbləğ nağd hesaba yoxsa kart/POS-terminal hesabına düşdü? Bank köçürmə ilə də yoxla.
- [pos] Nisyə kredit limiti: müştəriyə borc_limiti=100 təyin et. 60 AZN-lik 2 ayrı nisyə satış et (cəm 120). İkinci satış bloklanmalıdır — bloklanırmı, yoxsa keçir? (Gözlənti: bug səbəbi ilə keçəcək.)
- [pos] Offline + təkrar: İnterneti kəs, kupon+loyalty bonuslu satış et (növbəyə düşür). İnterneti aç, 'Sinxronlaşdır'-a 2 dəfə bas. Yoxla: bir satış yarandı (dublikat yox), AMMA campaign_usage/kupon current_uses və loyalty bonus 1 dəfəmi, 2 dəfəmi tətbiq olundu?
- [pos] Kupon limiti: max_uses=1 olan kupon yarat, POS-da iki ayrı satışda tətbiq et. İkinci satışda kupon rədd edilməlidir — edilirmi? (Gözlənti: coupons.current_uses artmadığı üçün təkrar işləyəcək.)
- [pos] Bonus sərfi + endirim limiti: kassirə aşağı endirim limiti (məs 5%) ver. Müştərinin 50 AZN loyalty bonusu olsun, onu 100 AZN satışda sərf et (manual endirim 0). Satış 'sahibkar təsdiqi tələb olunur' deyə bloklanırmı? Təsdiq → 'pending-sale' orphan qeydi yarandımı?
- [pos] Paralel POS çek nömrəsi: eyni kassada (2 brauzer/2 cihaz) eyni anda iki satış tamamla. İki satışın POS çek nömrəsi (qaime_nomresi) eynidirmi yoxsa fərqli?
- [pos] Sessiya zolağı: bank köçürmə və nisyə satışları et. POS üst zolaqda 'Bank' və 'Borc' cəmləri artırmı yoxsa 0 qalır?
- [ticaret-lifecycle] NƏĞD satış qaytarma yoxlaması: 100 AZN nağd satış et (kassa balansını qeyd et) → /ticaret/satislar-dan 'Tam qaytar' (returnFullSale) ilə qaytar → kassa balansı 100 azaldımı? (gözlənilən bug: AZALMIR). Müqayisə üçün eyni satışı fastReturn (tez qaytarma skan) ilə qaytarıb fərqi gör.
- [ticaret-lifecycle] Cash-flow işarə yoxlaması: bu günə 1 refund/qaytarma yarat → /hesabatlar/pul və dashboard günlük cash-flow-a bax → refund 'xaric'i artırıb net-i AZALDIRMI yoxsa səhvən net-i ARTIRIR? Eyni zamanda /maliyye kassa balans görünüşü ilə müqayisə et — iki ekran fərqli rəqəm göstərirsə sign bug təsdiqlənir.
- [ticaret-lifecycle] Mənfəət/marja yoxlaması: bir məhsulu sat (marja hesabatında mənfəəti qeyd et) → həmin satışı tam qaytar → /hesabatlar/marja yenidən bax → mənfəət/gəlir azaldımı? (gözlənilən bug: dəyişmir, qaytarılan mal hələ mənfəət sayılır).
- [ticaret-lifecycle] Qaralama/təsdiq ləğvi stok yoxlaması: stoku 10 olan məhsulu QARALAMA (və ya təsdiq tələb edən) satışa sal → satışı ləğv et → məhsulun stoku 10-da qalmalıdır, AMMA gözlənilən bug: stok 11-ə qalxır (fantom mədaxil). anbar/hereketler-də saxta 'medaxil' sətiri yarananını yoxla.
- [ticaret-lifecycle] Hissəvi ödənilmiş nisyə ləğvi: 100 AZN nisyə satış, 30 AZN nağd hissəvi ödəniş et (kassa +30) → satışı 'ödəniş geri qaytarıldı' səbəbi ilə ləğv et → kassa registr balansı (/maliyye) 30 azaldımı? Hesab balansı ilə kassa registri uyğundurmu? (gözlənilən bug: hesab balansı düzəlir, kassa registri 30 saxlayır).
- [ticaret-lifecycle] KRİTİK SSENARİ (keçməli): A müştərisinə 90 AZN nisyə + 30 AZN nisyə (ödənişsiz) sat → borc 120 → 30-luğu ləğv et → müştəri borcu (/maliyye/debitor və müştəri detalı) 90 göstərməlidir, ləğv olunmuş sənəd aktiv borca təsir etməməlidir. Bu düzgün işləməlidir — regresiya yoxlaması kimi saxla.
- [payment-debt] Müştəriyə eyni gün iki nisyə qaimə yarat: 2 AZN və 100 AZN. 10 AZN ödəniş et (PaymentDialog və NisyePaymentQuick hər ikisi ilə ayrıca). Yoxla: 2 AZN qaimə tam bağlanır, 100 AZN-dən 8 düşür (qalıq 92), avans 0, ümumi borc 92. Sonra qaimələrin eyni vaxtda yaradıb 10 ödənişin HANSI qaiməyə getdiyini yoxla — FIFO sırası gözlənilən kimidirmi (tarix eyni olduqda).
- [payment-debt] Müştəri overpay: 50 AZN borca 80 AZN ödə → 30 avans yaranmalı. Sonra bu 50 AZN ödənişi maliyyə/əməliyyat səhifəsindən LƏĞV et. Yoxla: qaimələr yenidən açılırmı VƏ kontragentler.avans 30 azalıb 0 olurmu (gözlənti: HƏ; faktiki risk: avans 30-da fantom qalır).
- [payment-debt] 30 AZN avansı olan müştəriyə yeni 40 AZN nisyə qaimə yarat, sonra hesab-çıxarış aç. Avans yeni qaiməyə avtomatik tətbiq olunurmu? Avans tətbiq düyməsi ilə 30 tətbiq et və hesab-çıxarışda cemi_kredit/son_qaliq-ın eyni 30 AZN-i İKİQAT saymadığını yoxla.
- [payment-debt] Borclar (elaqe) PaymentDialog ilə 20 AZN ödəniş qəbul et. Sonra: (a) maliyyə kassa/bank hesab qaliqı 20 AZN artıbmı? (gözlənti: artmalı; risk: artmır, hesab_id NULL). (b) müştəri hesab-çıxarışında bu 20 AZN ödəniş sətri görünürmü? (risk: görünmür, type_kod='musteri_odenis').
- [payment-debt] Maliyyə dashboard KPI kartlarını yoxla: debitor_cem (alici_borcu) və kreditor_cem rəqəmləri real müştəri alacaq cəmi / təchizatçı borc cəmi ilə üst-üstə düşürmü? getTopDebtors widget-i ilə debitor_cem KPI-si eyni rəqəmi göstərirmi? (risk: kreditor_cem=0, debitor səhv field-dən).
- [payment-debt] Yalnız 'kontakt redaktə' (musteri.duzelt) icazəsi olan, 'odenis.qebul' icazəsi OLMAYAN istifadəçi ilə daxil ol və borclar səhifəsindən ödəniş qəbul etməyə çalış — bloklanmalıdır (faktiki: keçir).
- [payment-debt] Təchizatçıya açıq borcu 50 AZN ikən 70 AZN ödə. Yoxla: kassadan 70 çıxır, təchizatçı borcu 0 olur, qalan 20 AZN harada izlənir? Təchizatçı hesab-çıxarışında balans mənfi (biz avans verdik) düzgün göstərilirmi yoxsa 20 itir.
- [anbar-stock] Təsdiq tələb edən satış (Ayarlar > satış təsdiqi aktiv, və ya maya-altı 'approval' rejimi): yeni satış yarat → təsdiq mərkəzində təsdiqlə → satışı 'Tamamla'. Sonra: (a) anbar/stok-da həmin məhsulun miqdarı azaldımı? (b) kassa/maliyyə hesabatında gəlir göründümü? (c) nisyə isə müştəri borcu yarandımı? Gözlənilən hamısı 'hə'; faktiki — heç biri olmayacaq (kritik bug #1).
- [anbar-stock] Çox-anbarlı satış: bir satışda 1-ci sətir Anbar A, 2-ci sətir Anbar B-dən seç, tamamla. Sonra satışı ləğv et (cancelSale) və ya tam qaytar (returnFullSale). Anbar A və B stoklarını yoxla — B-nin malı A-ya yazılıbmı? (kritik bug #2).
- [anbar-stock] Bron testi: bir məhsulun bütün stokuna qaralama+rezerv et (stok_bron aktiv). Anbar/stok-da 'movcud' 0 görünür. POS-a/yeni-satışa get — həmin məhsul hələ də mövcud kimi seçilirmi və satıla bilirmi? (orta bug — bron qorumur).
- [anbar-stock] Alış maya: eyni alış üçün əlavə xərc (gömrük/çatdırılma) daxil et. (a) 'İndi qəbul et' ilə yarat — məhsul kartında alış qiyməti xərcsiz xam qiymət qaldı? (b) Başqa alışı 'gozlemede' yarat, sonra 'Qəbul et' — alış qiyməti xərc daxil real maya oldu? İki nəticəni müqayisə et (orta bug #4).
- [anbar-stock] Sayım stale: böyük anbarda tam sayım başlat, sayımı tamamlamamış həmin məhsuldan POS satışı et, sonra sayımı tamamla. Stok faktiki sayım dəyərinə qayıdıb satışı 'udduğu' (stok şişdiyi) halı yoxla; anbar/hereketler-də hərəkət deltası faktiki dəyişiklikdən fərqlidirmi? (orta bug #6).
- [anbar-stock] Drift skanı: Ayarlar/Nəzarət — scanStockDrift / anomali ekranında yuxarıdakı ssenarilərdən sonra drift sayını yoxla (cache vs ledger uyğunsuzluğu görünməlidir).
- [maliyye] Marketplace payout testi: marketplace_payout finance_operation_types BOŞ olan yeni sahibkar yarat, payout qəbul et (markPayoutReceived), bank balansını qeyd et; sonra həmin bank hesabına adi xərc/transfer et (recalc tetiklensin) və balansa bax — payout məbləği itibsə kritik bug təsdiqlənir.
- [maliyye] Təsisçi pulu testi: nağd kassanın qaliqını qeyd et, 'Təsisçi pulu' əməliyyatı ilə 1000 ₼ əlavə et, kassa qaliqına bax — qaliq dəyişməyibsə (1000 ₼ görünmürsə) bug təsdiqlənir. Eyni qaydada 'Tahtəl hesab' ilə pul çıxar.
- [maliyye] Default kassa fallback testi: hesab seçmədən maaş ödə (bordro-pay), servis qəbzində ilkin ödəniş al, alış sənədini 'indi öde' ilə yarat — pulun düzgün nağd kassadan çıxdığını yoxla. Çıxmırsa (bank-a düşürsə və ya borc yaranırsa) nagd/negd bug-u təsdiqlənir.
- [maliyye] Ləğv olunmuş əməliyyat xülasəsi: bir neçə əməliyyat yarat, birini ləğv et (cancelFinanceOperation), /maliyye/emeliyyat səhifəsində KPI kartlarındakı cəm/net ilə siyahıdakı sətirləri tutuşdur — ləğv olunan hələ cəmdə görünürsə bug təsdiqlənir.
- [maliyye] Net hesablama testi: yalnız maaş + hesablı xərc (y_n='mexaric') olan ay üçün /maliyye/emeliyyat net göstəricisinə bax — outflow net-dən çıxmırsa (net süni yüksəkdirsə) mexaric/xaric uyğunsuzluğu təsdiqlənir.
- [maliyye] Ödəniş növü ziddiyyəti: nisyə ödənişi və ya xərc yaradarkən odenis_nov='kart' seç, hesab kimi nağd kassanı seç — sistem qəbul edirsə (bloklamırsa) hesab/ödəniş-növü ziddiyyəti yoxlamasının olmadığı təsdiqlənir.

## ✅ KEÇƏN YOXLAMALAR (düzgün işləyən təsdiqlənmiş davranışlar)
- [auth-perm] Multi-tenant izolyasiyasının ƏSAS mexanizmi düzgündür: lib/db/prisma.ts-dəki `tenant-filter` Prisma extension TENANT_MODELS siyahısındakı bütün modellərdə read/update/delete üçün avtomatik `sahibkar_id` filtri inject edir, create-də dəyər qoyur, upsert update-ində sahibkar_id dəyişməsini bloklayır. Kontekst yoxdursa `[tenant-guard]` throw edir (fail-closed).
- [auth-perm] AsyncLocalStorage tenant konteksti (lib/db/tenant-context.ts) globalThis-də cache olunur ki, HMR/çoxlu modul instansiyası eyni storage-i paylaşsın — bu, prisma.ts və with-tenant.ts arasında kontekstin görünməməsi riskini aradan qaldırır. sahibkarId HƏMİŞƏ session-dan (auth()) gəlir, istifadəçi input-undan yox.
- [auth-perm] prismaUnscoped istifadələri (196 yer) əsasən unstable_cache içində (AsyncLocalStorage cache-ə keçmir) və ya cron/public/admin yerlərdə olub, demək olar hər biri explicit `where: { sahibkar_id: sahibkarId }` filtri ilədir; sahibkarId requireTenant()-dən gəlir. Audita rast gəlinən bütün belə oxumalar tenant-scoped idi.
- [auth-perm] Maliyyə modulu (features/maliyye/actions.ts) nümunəvi qorunub: saveExpense/deleteExpense/saveQuickOperation/approveOperation/rejectOperation/cancelOperation/closeGunSonu/receivePartialPayment/payAllOpenInvoices və s. hər biri requireMaliyyeActionPerm + yüksək məbləğ üçün requireHighValueApproval çağırır, nəticəni yoxlayır.
- [auth-perm] POS satış server action-u (features/pos/sale-action.ts) requireTicaretActionPerm(['pos.satis']) ilə backend-də qorunub; əməliyyat withTenant içində icra olunur.
- [auth-perm] Anbar məhsul əməliyyatları (features/anbar/actions.ts: saveProduct/deleteProduct/restoreProduct/bulkUpdateProducts) requireAnbarActionPerm ilə icazə yoxlanır, maya qiyməti canViewCost/redactCost ilə redact olunur.
- [auth-perm] İstifadəçi/rol idarəetməsinin əsas hissəsi (features/ayar/actions.ts: createUser, updateUserProfile, toggleUserField, changeUserRole, resetUserPassword, deleteUser, saveRole, saveRolePerms, cloneRole, deleteRole, createRoleFromTemplate, updateUserIpRestriction, setUserSessionLimit) requireAyarActionPerm('ayar.idare'/'ayar.rol_idare') ilə qorunub və tenant-scope (sahibkar_id) yoxlaması var.
- [auth-perm] İmtiyaz qaldırma müdafiəsi: RESERVED_ROLE_NAME regex (sahibkar|admin|owner|direktor|mühasib) custom rol adında bu sözlərin işlədilməsini bloklayır — substring privilege bypass (gateRoute rolAd.includes('admin')) qarşısı alınır. Sistem rolları (sistem=true) tenant-a aid olmadığı üçün redaktə/silinmə əlçatmazdır.
- [auth-perm] Login axını (auth.ts) güclüdür: brute-force rate limit (checkLoginRate), tenant status='aktiv' yoxlaması, abunə bitmə/status yoxlaması, audit log (recordLoginAttempt), bcrypt timing log. JWT-yə icazələr qəsdən qoyulmur (4KB cookie limiti) — getRequestPermissions() ilə DB-dən yüklənir.
- [auth-perm] Public marketplace order API (orders/[kanal]) düzgün tenant binding edir — runWithTenant API key-dən alınan sahibkarId ilə qurulur, verifyApiKey hash müqayisəsi ilə düzgün sahibkarı tapır (cross-tenant key spoofing yoxdur).
- [pos] Stok azalması race-safe: safeStockDecrement (lib/db/stock-guards.ts) `UPDATE stok SET miqdar=miqdar-x WHERE miqdar>=x` atomik şərt ilə işləyir + step 3-də FOR UPDATE lock var. Paralel iki satış stoku mənfiyə apara bilmir. Çatmazlıqda 0 sətir → xəta atılır, transaction rollback.
- [pos] anbar_hereketleri yazılışı düzgün: hər sətir üçün nov='mexaric', ref_nov='satis_sifarisi', ref_id=sale.id ilə bir hərəkət yaranır — anbar hesabatı/anomaliya bu satışı görür.
- [pos] satis_sifaris_satirlari `cemi` GENERATED sütun olaraq saxlanılır (set edilmir) — düzgün.
- [pos] Sənəd nömrəsi (nomre) tam race-safe: nextDocNumber PG funksiyası/counter cədvəli ON CONFLICT DO UPDATE RETURNING ilə atomik. `nomre` DB-də @unique.
- [pos] Nisyə satışda kassaya pul düşmür (odenis_nov==='nisye' → kassa_emeliyyatlari və finance_operations yaradılmır) — düzgün. odenilmis=0 təyin olunur.
- [pos] client_op_id idempotentliyi üçün DB-də partial-unique index MÖVCUDDUR: scripts/migrations/2026-06-08-audit-fix-columns.sql → `CREATE UNIQUE INDEX satis_client_op_uniq ON satis_sifarisleri(sahibkar_id, client_op_id) WHERE client_op_id IS NOT NULL`. Eyni payload-un (offline replay/double-click) eyni UUID-u saxlandığı üçün təkrar createSale dublikat satış sətri YARATMIR (race-i index, app-i findFirst tutur).
- [pos] Bonus serfi tək sayılır: bonus son_mebleg-dən çıxılır (endirim_mebleg-ə daxil) VƏ applyBonusToSale loyalty kartından decrement edir — qoşa azaltma yoxdur. applyBonusToSale balans>=mebleg atomik şərt ilə (updateMany) işləyir.
- [pos] Müştəri borc balansı satışdan sonra recalculateCustomerBalance ilə kontragentler.alacaq-a yazılır; debitor detal siyahısı da eyni live (son_mebleg-odenilmis) məntiqi işlədir — bu iki yer uyğundur.
- [pos] Nağd ödənişdə üstü (change) yalnız UI-də hesablanır, kassaya son_mebleg yazılır — düzgün.
- [ticaret-lifecycle] KRİTİK SSENARİ DÜZGÜNDÜR: 90 AZN nisyə + 30 AZN nisyə (ödənişsiz) → 30-luq satışı cancelSale ilə sil → borc 90 qalır. Səbəb: lib/balance/customer-balance.ts calculateCustomerBalance() borcu source-of-truth-dan (satis_sifarisleri) hesablayır və `status NOT IN ('legv','qaytarilib') AND deleted_at IS NULL` filtri tətbiq edir. cancelSale satışı status='legv' + deleted_at=NOW() edir, sonra recalculateCustomerBalance çağırır → ləğv olunmuş 30-luq aqreqatdan düşür, 90 qalır. Ödənişsiz nisyədə odenilmis=0 olduğu üçün __BLOCKED__ blocker də işə düşmür, ləğv təmiz keçir.
- [ticaret-lifecycle] Müştəri borcu (alacaq) üçün vahid həqiqət mənbəyi (recalculateCustomerBalance) doğru qurulub — manual increment/decrement əvəzinə hər mutate-dan sonra satis_sifarisleri-dən yenidən hesablanır, bu da drift riskini əhəmiyyətli azaldır. Bütün əsas yollar (satış yaratma, recordSalePayment, cancelSale, acceptReturn, fastReturn, returnFullSale) recalc çağırır.
- [ticaret-lifecycle] cancelSale-də finance_operations reverse-i düzgündür: satışa bağlı aktiv finance_operations sətirləri status='legv' edilir və recalculateAccountBalance ilə hesab balansı source-of-truth-dan bərpa olunur (audit #4 qeydi göstərir bu əvvəl yox idi, indi var).
- [ticaret-lifecycle] satış yaratmada stok azalması atomic və race-safe-dir: safeStockDecrement check-and-decrement edir, kifayət stok yoxdursa throw edir (mənfi stok qarşısı alınır). Stok yalnız aktiv (qaralama deyil + təsdiq tələb olunmayan) satışlarda azalır.
- [ticaret-lifecycle] acceptReturn-də təchizatçı qaytarması (alis_qaytarma) stoku safeStockDecrement ilə azaldır və mənfi stoku önləyir; müştəri qaytarması additive increment edir — hər iki istiqamət düzgün.
- [ticaret-lifecycle] kassa-queries.ts (kassa balans görünüşü) mənfi-mebleg qaytarma sətirini DÜZGÜN oxuyur: qaytarma `mexaric/xerc` çoxluğunda olmadığı üçün medaxil-ə düşür, mebleg mənfi olduğundan balansı düzgün azaldır (balans = acilis + medaxil − mexaric).
- [payment-debt] KRİTİK SSENARİ DÜZGÜN İŞLƏYİR: 2 AZN + 100 AZN qaimə, 10 AZN ödəniş → 2 tam bağlanır, 100-dən 8 düşür (qalıq 92), avans 0. Hər iki əsas allokator (features/elaqe/actions.ts:404-421 recordContactPayment və features/maliyye/actions.ts:1138-1156 receivePartialPayment) açıq qaimələri tarix sırası ilə gəzir, hər birinə Math.min(remain, qalig) tətbiq edir, yalnız BÜTÜN qaimələr bağlandıqdan SONRA qalan məbləğ avansa keçir (toAdvance = Math.max(0, remain)). 'səhv: 2 bağlanır, 8 avans, 100 toxunulmur' davranışı kodda YOXDUR.
- [payment-debt] Allokasiya alqoritmi 5 giriş nöqtəsində eyni cascade məntiqindən istifadə edir (receivePartialPayment, payAllOpenInvoices, paySupplierAllOpen, paySupplierInvoice, recordContactPayment) — ayrı-ayrı ad-hoc məntiq yoxdur.
- [payment-debt] Müştəri borcu source-of-truth düzgün derive olunur: alacaq = SUM(son_mebleg - odenilmis) aktiv nisyə satışlardan (lib/balance/customer-balance.ts:60-73). odenilmis artımı avtomatik alacaq-ı düşürür, manual increment yoxdur — drift riski az.
- [payment-debt] finance_operations.y_n Prisma field-i DB sütunu 'yön'-ə map olunub (schema.prisma:1861), ona görə account-balance.ts raw SQL-də yön='daxil' filtri ilə Prisma y_n yazıları eyni sütundur — burada uyğunsuzluq YOXDUR.
- [payment-debt] Ödənişlər atomik transaksiyada icra olunur: qaimə update + avans + finance_operations + payment_allocations + recalc + audit hamısı bir prisma.$transaction içində (məs. maliyye/actions.ts:1159-1285).
- [payment-debt] checkAccountSufficient transaksiya daxilində throw edir (paySupplierAllOpen:1719-1721), throw → tam rollback, ona görə yetərlilik yoxlamasının writes-dən sonra çağırılması balansı pozmur.
- [payment-debt] getCreditors (maliyye/queries.ts:831-835) həm müsbət, həm mənfi borc konvensiyasını GREATEST(borc, ABS(LEAST(borc,0)), open_total) ilə tolere edir və canlı open_total-a fallback edir — kreditor SİYAHISI düzgün işləyir.
- [payment-debt] getCashFlowForecast (cashflow-queries.ts:122-130) müştəri üçün alacaq, təchizatçı üçün borc>0 (müsbət konvensiya) oxuyur — supplier-balance.ts-in yazdığı müsbət borc ilə UYĞUNDUR.
- [anbar-stock] Tək mənbə (single source) — POS, yeni-satış, marketplace, məhsul-kartı və anbar/stok hamısı eyni `stok` cədvəlindən oxuyur. Pickerlər `searchProducts` (features/pos/sale-queries.ts) ilə `stok` relation-undan, anbar/stok `getStokRows` (features/anbar/stok-queries.ts) eyni cədvəldən. UUID/SQL injection riski yox — parametrli sorğular.
- [anbar-stock] Atomik məxariç müdafiəsi — lib/db/stock-guards.ts `safeStockDecrement` `UPDATE stok SET miqdar=miqdar-x WHERE miqdar>=x` ilə paralel satışlarda mənfi stoku önləyir; bütün satış/transfer/defekt yolları bunu istifadə edir. POS əlavə olaraq `FOR UPDATE` lock qoyur.
- [anbar-stock] POS satışı (features/pos/sale-action.ts) tam ardıcıldır: stok azalır + `mexaric` hərəkəti + kassa_emeliyyatlari + finance_operations + müştəri balansı recalc, hamısı bir transaksiyada, tək `anbar_id` ilə daxili uyğun.
- [anbar-stock] Alış qəbulu (receivePurchase, features/ticaret/alis-actions.ts) `real_maya_eded` (proporsional əlavə xərc daxil) ilə stok.son_qiymet VƏ mehsullar.alish_qiymeti-ni yeniləyir — COGS düzgün; `FOR UPDATE` lock ilə double-medaxil önlənir.
- [anbar-stock] Source-of-truth ledger (lib/balance/product-stock.ts) bütün hərəkət növlərini düzgün işarə ilə toplayır (medaxil/transfer_giris/qaytarma_*/inventar_artim = +; mexaric/transfer_cixis/defekt_cixis/konsiqnasiya_mexaric/inventar_azalma = −) və drift detection (scanStockDrift) verir.
- [anbar-stock] Transfer (transferStock, features/anbar/stock-actions.ts) mənbədən atomik azalma + hədəfə artım + iki hərəkət qeydi (transfer_cixis/transfer_giris) bir transaksiyada — düzgün.
- [anbar-stock] Sayım (completeInventar) fərqi olan sətrlər üçün işarəli `inventar_artim`/`inventar_azalma` hərəkəti yazır, mənfi fərqdə xerc kateqoriyasına zərər yazır — maliyyə təsiri izlənir.
- [anbar-stock] Silinmiş/qeyri-aktiv məhsullar yeni satışda seçilmir — bütün pickerlər `aktiv:true` filtrləyir; keçmiş satış sətrlərində mehsul_id relation qaldığı üçün ad itmir (mehsullar onDelete:NoAction).
- [maliyye] lib/balance/account-balance.ts — calculateAccountBalance source-of-truth düzgün qurulub: yalnız deleted_at IS NULL AND status='aktiv' sətirləri sayılır, ona görə ləğv/silinmiş əməliyyat REAL balansa (maliye_hesablari.qaliq recalc) təsir etmir. DB sütunu @map("yön") olduğu üçün raw SQL-də 'yön' istifadəsi düzgündür.
- [maliyye] checkAccountSufficient mənfi balans qoruyucusu source-of-truth-dan (cache deyil) oxuyur; maas-actions, paySupplierAllOpen, paySupplierInvoice, saveExpense, saveExpenseWithInvoiceLink hamısı bu yoxlamanı transaction içində çağırır — kifayət qədər pul olmayanda atılır və rollback olur.
- [maliyye] cancelFinanceOperation (cancel-operation-action.ts) tam geri qaytarma edir: status=legv + deleted_at, allocation-lar silinir, satış/alış odenilmis decrement olunur, hesab + müştəri + təchizatçı balansları recalc olunur. Source-of-truth filter sayəsində ləğv olunan əməliyyat avtomatik balansdan çıxır.
- [maliyye] Transfer (type_kod='transfer') və valyuta_mubadile (iki hesablı) calculateAccountBalance-də düzgün işlənir: mənbə hesab transfer_mexaric (azn_meblegh) çıxılır, hədəf hesab transfer_daxil COALESCE(meblegh2, azn_meblegh) əlavə olunur — fərqli valyutalarda meblegh2 düzgün tətbiq olunur.
- [maliyye] nisye-payment-quick.tsx odenis_nov dəyərini seçilmiş hesabın nov-undan derive edir (hesabNovToOdenis) — bu doğru yanaşmadır, hesab/ödəniş-növü uyğunluğunu UI səviyyəsində təmin edir.
- [maliyye] receivePartialPayment FIFO overflow cascade alqoritmi düzgündür: artıq məbləğ növbəti açıq qaiməyə keçir, yalnız bütün qaimələr bağlandıqdan sonra avansa düşür; idempotency_key ilə 5-dəqiqəlik duplicate qoruması var.
- [maliyye] saveQuickOperation threshold-u keçən əməliyyatda status='gozleyen_tesdiq' qoyur və qaliq recalc-ı YALNIZ təsdiq lazım deyilsə icra edir (if (!needsApproval)) — yəni təsdiq gözləyən əməliyyat balansa təsir etmir, doğru davranış.
- [marketplace] createMarketSatis (features/ticaret/market-satis-action.ts) gross/net/komissiya hesablamasını TƏLƏB OLUNAN kimi düz edir: son_mebleg = gross (100 qalır, dəyişmir), komisyon_meblegh = gross*faiz (14), xalis_meblegh = net (86). umumi_mebleg/son_mebleg net-ə endirilmir — spec-ə uyğun.
- [marketplace] createMarketSatis bank hesabını DƏRHAL artırmır — yalnız finance_marketplace_payments-də gözləyən payout yaradılır (sətir 241), bank yalnız markPayoutReceived çağırılanda artır (maliyye/actions.ts:1388 qaliq increment). Spec-in 'payout gözləmədə, bank yalnız payout gələndə artır' tələbi prinsipdə təmin olunur.
- [marketplace] Webhook (app/api/v1/marketplace/orders/[kanal]/route.ts) heç bir bank/kassa/finance_operations əməliyyatı yaratmır (grep ilə təsdiqləndi) — yəni gross webhook satışında bankı dərhal şişirtmir.
- [marketplace] Webhook HMAC imza yoxlaması var (verifyWebhookSignature, sətir 53-56) və imza səhv olduqda 401 qaytarır; kanal secret tapılmazsa 404.
- [marketplace] Webhook satışı stok-u TRANSACTION daxilində safeStockDecrement ilə azaldır və anbar_hereketleri (nov=mexaric, ref_nov=satis_sifarisi) yazır — stok hərəkəti audit izlənə bilir (sətir 207-228).
- [marketplace] markPayoutReceived (maliyye/actions.ts:1339) payout-u 'odenildi' edir, bank qaliq-ını faktiki məbləğlə artırır, finance_operations marketplace_payout daxil qeydi yaradır və ferq-i saxlayır — payout qəbulu axını düzgündür.
- [marketplace] returnFullSale (qaytarma-tez-actions.ts:343) marketplace satışında — payout ARTIQ QƏBUL OLUNUBSA (finance_operations marketplace_payout sətri varsa) — proporsional (ratio) əks finance_operations qeydi yaradır, həm tam, həm hissəvi qaytarmada işləyir; bu hissə düzgün dizayn edilib.
- [marketplace] satis_sifarisleri.external_id üçün partial unique index (satis_external_id_uniq, sahibkar_id+external_id) migration faylında mövcuddur (scripts/migrations/2026-06-08-audit-fix-columns.sql) — DB səviyyəsində webhook idempotentliyi üçün əsas mövcuddur.
- [credit-sale] createKreditSatis düzgün: satış son_mebleg=umumi (150 — müştəri qiyməti) saxlayır, odenis_nov='kredit', status='yeni', kredit_satislari qeydi status='qeyd', pul_alindi=false yaradır. Müştəri borcu YARADILMIR.
- [credit-sale] Stok düzgün azalır: safeStockDecrement (race-safe) + anbar_hereketleri 'mexaric' ref_nov='satis_sifarisi' ilə yazılır (kredit-yeni-actions.ts:131-167). Stok modulu düzgün əks olunur.
- [credit-sale] Müştəri borcunun VAHID MƏNBƏYİ (lib/balance/customer-balance.ts) kredit satışını DÜZGÜN istisna edir: filter `odenis_nov IN ('nisye','borc')` — kredit/kredit_qeyd daxil deyil. recalculateCustomerBalance və recalculateAllCustomerBalances eyni filter ilə kontragentler.alacaq-a yazır → kredit satış alacaq-a düşmür.
- [credit-sale] Debitor hesabatı (features/maliyye/queries.ts getDebtors, customer-statement.ts, customer-invoices-action.ts, actions.ts, triggers.ts) hamısı `odenis_nov IN ('nisye','borc')` filtri ilədir → kredit satış DEBİTORA DÜŞMÜR (tələbə uyğun).
- [credit-sale] Müqavilə/müddət/faiz/bank/komissiya kredit_satislari-də saxlanılır (bank, muddet_ay, faiz_illik, magaza_net, musteri_cemi, aylik_odenis, bank_komissiya, baslama/bitme_tarixi, muqavile qeydi). Sahə itkisi yoxdur.
- [credit-sale] recordKreditPayment bank ödənişində: maliye_hesablari.qaliq increment olunur + finance_operations 'qaime/daxil' yazılır → bank/kassa düzgün artır (FOR UPDATE lock ilə duplikat qorunur).
- [credit-sale] getCustomerCreditStatus (satis-yeni-actions.ts:720) müştəri 'Cari borc' badge-ini `odenis_nov IN ('nisye','borc')` ilə hesablayır → satış detalı header-də 'Borc yoxdur' düzgün göstərir.
- [elaqe] Müştəri borcu üçün vahid mənbə (lib/balance/customer-balance.ts) mövcuddur: alacaq = aktiv nisyə satışların qalığı (son_mebleg - odenilmis) + servis qalığı. recalculateCustomerBalance() satış/ödəniş/ləğv/qaytarmadan sonra çağırılır.
- [elaqe] Müştəri kart başlığındakı 'Borc balansı' (app/(dashboard)/elaqe/musteriler/[id]/page.tsx:124 — Math.max(0, stats.sales_total - stats.sales_paid)) və debitor siyahısı (getDebtors — SUM(son_mebleg - odenilmis)) eyni düsturdan istifadə edir; nağd satışlarda odenilen=sonMebleg təyin olunduğu üçün (satis-yeni-actions.ts:351) nağd satış borca 0 əlavə edir — beləliklə kart başlığı ilə debitor adətən uyğun gəlir.
- [elaqe] Hesab çıxarışı (ekran) və CSV (app/api/musteri/[id]/hesab-cixaris.csv/route.ts) EYNİ getCustomerStatement mənbəsindən qidalanır — ekran/CSV arasında uyğunsuzluq yoxdur.
- [elaqe] Satışın ləğvi (satis-actions.ts) status=legv + deleted_at yazır, bağlı finance_operations sətirlərini də legv edir və həm müştəri balansını, həm hesab balansını yenidən hesablayır — borc və kassa düzgün geri qaytarılır.
- [elaqe] Təchizatçı tərəfi daxili olaraq ardıcıldır: supplier-balance.ts borc = SUM(umumi_mebleg - odenilmis), təchizatçı siyahısı kontragentler.borc-u oxuyur, supplier-statement.ts alış qaiməsi/ödəniş/qaytarmadan qalıq qurur — eyni mənbə (alis_sifarisleri + alis_odenis) əsasında.
- [elaqe] Müştəri 360 jurnalı (getCustomerJourney) ödənişlərə allocation/qaimə bağlantısını, hesab adını, link-i düzgün göstərir; lead/satış/qaytarma/servis/əlaqə/ödəniş hadisələri vahid xronologiyada birləşir.
- [elaqe] Açıq qaimələr bloku (MaliyyeTabSection — getOpenSalesForCustomer) yalnız nisyə/borc, status NOT IN (legv,qaytarilib), qaralama=false filtri ilə qalığı düzgün hesablayır və debitor/alacaq ilə eyni məntiqdədir.
- [servis] recordPayment atomic transaction içində işləyir: finance_operations (xidmet_geliri, y_n=daxil, hesab_id) + satis_sifarisleri (status=tamamlandi) + servis_qeydleri.musteriden_alinan += mebleg + müştəri balans recalc birlikdə yazılır. hesab balansı finance_operations-dan aggregate edildiyi üçün kassa düzgün artır.
- [servis] Stok çıxışı düzgün: addEhtiyatHisse 'stok' cədvəlini atomik race-safe updateMany({miqdar:{gte}}, decrement) ilə azaldır və anbar_hereketleri jurnalı (nov=servis_mexaric, ref_nov=servis, ref_id) yazır. Stok kifayət deyilsə mənfi stok yaratmır, servis_mexaric_stoxsuz işarələnir.
- [servis] recordPayment ilə yaranan satis_sifaris_satirlari sətri stoku AZALTMIR (stok yalnız satis-yeni-actions/POS axınında azalır), ona görə müştərinin öz cihazı (mehsul_id) səhvən anbardan silinmir.
- [servis] Müştəri borcu source-of-truth (lib/balance/customer-balance.ts) servis qalığını düzgün hesablayır: GREATEST(temir_xerci - musteriden_alinan, 0), status!='redd_edildi', deleted_at IS NULL. Hər mutate-dan sonra recalculateCustomerBalance(tx) çağırılır (createServis, changeStatus, teklif, ehtiyat, ödəniş, ehtiyat-silmə).
- [servis] borc rejimli ödəniş kassa/satış yaratmır, yalnız balansı recalc edir — servis qalığı temir_xerci əsasında düzgün borc kimi qalır (double-count yox).
- [servis] deleteEhtiyatHisse hard-delete deyil, reversal (nov=servis_iade) yazır və temir_xerci-ni geri azaldır + balans recalc — audit izi qorunur.
- [servis] Status dəyişimi (changeServisStatus) atomikdir: servis_qeydleri.updateMany + servis_status_tarixce row bir $transaction. redd_edildi üçün məcburi səbəb tələb olunur, müştəriye_tehvil-də qapanma_tarixi/qapayan_id yazılır.
- [servis] Multi-tenant qoruma: servis_qeydleri/zemanetler TENANT_MODELS-dədir, prisma extension sahibkar_id avtomatik inject edir; əlavə olaraq mutasiya action-ları açıq sahibkar_id filtri ilə də findFirst yoxlaması edir (defense-in-depth).
- [servis] Public endpoint token qoruması düzgün: verifyServisToken HMAC-SHA256(servis_id:sahibkar_id) timing-safe müqayisə + rate-limit, UUID təxminini blok edir.
- [servis] Audit log: bütün əsas əməliyyatlar (YARAT, STATUS_DEYISDI, ODENIS, EHTIYAT_HISSE, ZEMANET_UZADILDI, BILDIRIS, müştəri rey/onay) safeAuditLog ilə yazılır; ödəniş itkisi riski (kassa yoxdursa) ODENIS_ITKI_RISKI kimi audit-ə düşür.

======================================================================

## 20. NÖVBƏTİ ADDIM PLANI (təsdiqinizdən sonra)

**Faza A — Təhlükəsizlik (dərhal):** K1 (maaş icazəsi), K2 (filial icazə + cross-tenant), K5 (admin action guard-ları), K4 (sessiya ləğvi), K26 (servis portal crash)
**Faza B — Pul bütövlüyü:** K6 (qarışıq ödəniş), K9 (refund sign), K11/K23/K32 (qaytarma/ləğv reverse), K13/K31 (borc mənbələri), K14/K15 (kontragent ödənişləri), K19/K20/K21 (balans etiketləri), K25, K33
**Faza C — Marketplace/Kredit:** K3 (public API 500), K18/K22/K24 (payout/webhook)
**Faza D — Satış axını:** K12 (fantom stok), K16 (təsdiq materiallaşması), K17 (çox-anbar), K7/K8 (kupon/loyalty dublikat)
**Faza E — Maaş/Hesabat:** K27/K28/K29, K10/K30
**Faza F — Canlı: CANLI-1 (yetim data təmizliyi), CANLI-2 (SQL alias)
Hər faza: düzəliş → build → regression test (mövcud scripts/qa) → push.
