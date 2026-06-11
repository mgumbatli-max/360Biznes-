# Funksional Axın Auditi — 2026-06-11

İstifadəçinin sadaladığı 10 əməliyyat axınının adversarial kod-izləməsi (runtime/məntiqi/bütövlük — tsc tutmur).
**Cəmi 47 bug: 11 kritik, 25 orta, 11 kiçik.**

> Status: TƏSDİQ GÖZLƏYİR — istifadəçi 'düzəlt' deyəndə fazalı düzəldiləcək.

## [1] 🔴 KRİTİK · İşçi yarat / redaktə / sil (deaktiv)
**Re-aktivasiya deleted_at/isden_cixdi-ni təmizləmir — login-li, lakin 'çıxıb' və siyahıda görünməyən xəyal işçi**

- **Yer:** `features/iscilier/actions.ts:49-74 (baseData + update) və 123-132 (deactivateEmployee)`
- **Repro:** 1) İşçini deaktiv et → deactivateEmployee aktiv=false, isden_cixdi=now, deleted_at=now, deleted_by təyin edir. 2) Həmin işçini Redaktə dialoqunda aç (detail səhifəsindən və ya 'silinmiş' filtrindən), 'Aktivdir' checkbox-u işarələ, Yenilə. 3) saveEmployee baseData yalnız aktiv=true yazır — deleted_at və isden_cixdi-yə TOXUNMUR (baseData-da bu sahələr yoxdur).
- **Gözlənilən:** Re-aktivasiya zamanı (aktiv=true edildikdə) deleted_at=null, deleted_by=null, isden_cixdi=null də sıfırlanmalıdır; və ya soft-deleted işçinin sıradan saveEmployee ilə re-aktiv edilməsi bloklanıb ayrıca 'bərpa et' əməliyyatına yönləndirilməlidir.
- **Faktiki:** İşçi aktiv=true olur və auth.ts:67 (where aktiv:true) ona LOGIN icazəsi verir — sistemə yenidən girə bilir. Amma deleted_at hələ doludur: getEmployees default 'aktiv' filtrində (queries.ts:42 deleted_at=null) onu GÖSTƏRMİR. Üstəlik isden_cixdi dolu qaldığından queries.ts:108 status='cixib' kimi göstərir. Yəni: girişi olan, 'işdən çıxıb' damğalı, aktiv siyahıda görünməyən tutarsız qeyd.
- **Bütövlük/risk:** Bütövlük: soft-delete invariantı pozulur (deleted_at!=null ⇒ aktiv=false olmalı idi). Təhlükəsizlik: deaktiv/silinmiş işçi gizlicə login qabiliyyəti qazanır, siyahıda görünmür → audit/nəzarətdən qaçır.

## [2] 🔴 KRİTİK · İstifadəçi yarat/sil + rol təyini + ROL İCAZƏ effe
**cloneRole reserved rol adı yoxlamır → privilege escalation (admin/owner adlı rol klonlanır, üzvləri tam admin olur)**

- **Yer:** `features/ayar/actions.ts:356-359 (RoleCloneSchema) və 378-386 (roles.create)`
- **Repro:** rol.idare icazəsi olan adi əməkdaş (sahibkar/admin DEYİL) cloneRole çağırır: source_id=istənilən tenant/sistem rol, ad='Admin köməkçi' (və ya 'owner', 'direktor', 'sahibkar' substring-i). RoleSchema-dakı RESERVED_ROLE_NAME refinement burada YOXDUR. Sonra changeUserRole ilə özünü həmin rola keçirir (rol.idare ilə icazəlidir). isAyarPrivileged() və gateRoute() rol AD-da 'admin'/'owner'/'sahibkar'/'direktor' substring-i axtarır → həmin istifadəçi BÜTÜN ayar action-larına (createUser/deleteUser/changeUserRole) və BÜTÜN route-lara tam giriş qazanır.
- **Gözlənilən:** cloneRole-da da RoleSchema kimi RESERVED_ROLE_NAME refinement tətbiq olunmalı (audit #17 saveRole-da var, klonda unudulub). Eyni qayda createRoleFromTemplate üçün lazım deyil (sabit meta adlar).
- **Faktiki:** Klonlanan rol adı yalnız min2/max50 ilə yoxlanır; reserved ad keçir → rol AD substring əsaslı privilege guard-lar (isAyarPrivileged, gateRoute) aldanır.
- **Bütövlük/risk:** Tam tenant ələ keçirmə: ixtiyari əməkdaş özünü admin edib pul/stok/borc daxil hər şeyə yaza, başqa istifadəçiləri silə bilər.

## [3] 🔴 KRİTİK · İstifadəçi yarat/sil + rol təyini + ROL İCAZƏ effe
**changeUserRole: yalnız rol.idare tələb edir, hədəf-istifadəçi məhdudiyyəti yoxdur → öz rolunu yüksəldə bilər (self-escalation) və sahibkar/owner-i demote edə bilər (lockout)**

- **Yer:** `features/ayar/actions.ts:915-940`
- **Repro:** 1) Self-escalation: rol.idare olan əməkdaş changeUserRole(id=ÖZÜ, rol_id=daha çox icazəli tenant rolu) çağırır — heç bir 'özünün rolunu dəyişə bilməzsən' yoxlaması yoxdur, yalnız user+rol tenant-da var deyə yoxlanır. cloneRole ilə birləşəndə tam admin olur. 2) Owner lockout: həmin əməkdaş sahibkar/owner istifadəçisinin rolunu icazəsiz adi rola dəyişir; owner-in tam girişi rol_ad substring-inə bağlı olduğundan (isAyarPrivileged/gateRoute/getRequestPermissions) owner panellərdən kilidlənir.
- **Gözlənilən:** changeUserRole istifadeci.idare (rol yox) tələb etməli; hədəf istifadəçi sahibkar/owner-dirsə (və ya cari istifadəçinin özüdürsə yüksəliş istiqamətində) bloklanmalı; rol təyini icazə səviyyəsini cari istifadəçinin səviyyəsindən yuxarı qaldıra bilməməli.
- **Faktiki:** Heç bir self/owner mühafizəsi yoxdur; rol.idare olan hər kəs istənilən tenant istifadəçisinin (o cümlədən özünün və sahibkarın) rolunu istənilən tenant roluna dəyişir.
- **Bütövlük/risk:** Owner lockout (administrativ DoS) + birləşmiş escalation ilə tam ələ keçirmə.

## [4] 🔴 KRİTİK · Müştəriyə satış
**Nağd/kart satışda kassa_id məcburi deyil — pul heç bir kassaya/hesaba düşmür, satış "tam ödənilmiş" görünür (pul yox olur)**

- **Yer:** `features/ticaret/satis-yeni-actions.ts:357-466 (xüsusilə 381: `if (odenilen > 0 && data.kassa_id)`), kassa_id Zod-da nullish (66)`
- **Repro:** createOrUpdateSatisYeni({odenis_nov:"negd", kassa_id:null, lines:[...100 AZN], qaralama:false}) çağır. Bu AI agent axınında REALDIR — agent-tools.ts:695-702 createOrUpdateSatisYeni-ni odenis_nov="negd" və HEÇ kassa_id GÖNDƏRMƏDƏN çağırır. Server: defaultOdenilen=sonMebleg → odenilen=sonMebleg → isFullPaid=true → odenilmis=sonMebleg, status="tamamlandi". Sonra 381-də kassa_id null olduğu üçün NƏ kassa_emeliyyatlari NƏ də finance_operations yaranmır.
- **Gözlənilən:** Nağd/kart/köçürmə ödənişi üçün server kassa_id (və ya hesab_id) MƏCBURİ tələb etməli; tapılmazsa satışı rədd etməli VƏ YA odenilmis-i artırmamalı. Pul yazılmadan satış "tamamlandi" olmamalı.
- **Faktiki:** Satış 100% ödənilmiş kimi bağlanır (odenilmis=son_mebleg), stok azalır, lakin pul heç bir kassa_emeliyyatlari və ya finance_operations qeydinə düşmür. Kassa balansı və P&L/cashflow gəliri əskik göstərir.
- **Bütövlük/risk:** PUL: kassa/finance ledger-də mədaxil itir → kassa qaliqı və gəlir hesabatı aşağı; müştəri balansına da düşmür (nisyə deyil) → satış gəliri tamamilə hesabatdan kənarda qalır.

## [5] 🔴 KRİTİK · Qaytarma
**İkiqat qaytarma bloku YOXDUR — eyni satışı/sətri dəfələrlə qaytarmaq olur (stok şişir, pul/borc ikiqat azalır)**

- **Yer:** `features/ticaret/qaytarma-tez-actions.ts:343-378 (returnFullSale hissəvi), :112-178 (fastReturn), :48-86 (scanLookup miqdar_qaliq)`
- **Repro:** 1) 100₼-lıq nəğd satış yarat (1 məhsul, 5 ədəd). 2) returnFullSale ilə hissəvi qaytar (1 sətir) → satış statusu DƏYİŞMİR (yalnız fullReturn-da 'qaytarilib' olur; nəğdə odenilmis-ə də toxunmur). 3) Eyni satışın eyni sətrini yenidən returnFullSale ilə qaytar — heç bir yoxlama yoxdur. fastReturn-da scanLookup hər dəfə eyni satışı tapır, miqdar_qaliq = recent.miqdar (əvvəlki qaytarmaları çıxmır), istənilən qədər təkrar olur.
- **Gözlənilən:** Hər sətir üçün artıq_qaytarılan miqdarı (SUM qaytarma_satirlari WHERE original sale) hesablanıb, qaytarılacaq miqdar (sold − already_returned) ilə məhdudlaşdırılmalı; aşırılarsa throw.
- **Faktiki:** Heç bir kod 'bu sətirdən nə qədər artıq qaytarılıb' yoxlamır. qaytarma_satirlari-də öncəki qaytarmaların cəmi ilə müqayisə YOXDUR. Hər təkrar: stoka yenidən increment, kassaya yeni mənfi refund, nisyədə odenilmis yenidən artar.
- **Bütövlük/risk:** Stok süni şişir; nəğd satışda kassadan dəfələrlə pul çıxır; nisyədə müştəri borcu sıfırın altına/artıq azalır. Birbaşa pul itkisi.

## [6] 🔴 KRİTİK · Qaytarma
**nov enum uyğunsuzluğu — manual qaytarmalar müştəri/təchizatçı statement-ində GÖRÜNMÜR (borc/alacaq drift)**

- **Yer:** `features/qaytarma/actions.ts:71 (nov='satis_qaytarma'/'alis_qaytarma') vs features/maliyye/customer-statement.ts:87,127 (nov='musteri') və features/maliyye/supplier-statement.ts:81,119 (nov='techizatci')`
- **Repro:** 1) createReturn ilə təchizatçıya qaytarma yarat (forma nov='techizatci' → DB-yə 'alis_qaytarma' yazılır), acceptReturn et. 2) Təchizatçı hesabatını (supplier-statement) aç. Qaytarma sətri filter `nov = 'techizatci'`-ə uyğun gəlmir → görünmür. Eyni problem müştəri tərəfində: createReturn 'satis_qaytarma' yazır, customer-statement `nov = 'musteri'` axtarır.
- **Gözlənilən:** nov dəyəri vahid olmalı (hər yerdə ya 'musteri'/'techizatci' YA da 'satis_qaytarma'/'alis_qaytarma') və statement filtri onunla üst-üstə düşməli.
- **Faktiki:** createReturn DB-yə 'satis_qaytarma'/'alis_qaytarma', fastReturn/returnFullSale isə 'musteri' yazır. Statement-lər yalnız 'musteri'/'techizatci' filtrləyir → bütün manual createReturn qaytarmaları hesabatdan düşür.
- **Bütövlük/risk:** Hesabat (statement) son_qaliq-ı kontragentler.borc/alacaq source-of-truth-dan fərqlənir — müştəriyə/təchizatçıya çıxarılan akt yanlışdır.

## [7] 🔴 KRİTİK · Ödəniş
**recordContactPayment təchizatçıya (techizatci) ödənişdə borcu azaltmır, pulu səhvən MƏDAXİL kimi yazır**

- **Yer:** `features/elaqe/actions.ts:367-543 (xüsusən 386-397, 463-508); UI tetikleyici: features/elaqe/components/contacts-table.tsx:487-488 + app/(dashboard)/elaqe/techizatcilar/page.tsx:124-132; data: features/elaqe/queries.ts:190`
- **Repro:** 1) Elaqe → Techizatcilar səhifəsini aç. 2) Borcu olan (kontragentler.borc > 0) bir təchizatçı üçün cədvəldə 'Ödəniş al' (PaymentDialog) düyməsi görünür — contacts-table.tsx:487 yalnız c.borc>0 yoxlayır, nov yoxlanmır; queries.ts:190-də techizatci üçün c.borc = kontragentler.borc (bizim ona borcumuz). 3) Məbləğ daxil et və təsdiqlə → recordContactPayment çağırılır.
- **Gözlənilən:** Təchizatçı ödənişi ayrı axınla (alış sənədinə bağlı, alis-payment-action / paySupplier) getməli, finance_operations y_n='mexaric' olmalı, recalculateSupplierBalance çağırılmalı və ya recordContactPayment k.nov === 'techizatci' halında bloklanmalı/yönləndirilməlidir. Hazırda PaymentDialog təchizatçı sətrində ümumiyyətlə göstərilməməli idi.
- **Faktiki:** recordContactPayment 379-383-də k.nov-u select edir AMMA heç yoxlamır. FIFO yalnız satis_sifarisleri (musteri_id = həmin kontragent, odenis_nov IN nisye/borc) üzərində işləyir — təchizatçının adətən satışı olmadığı üçün distribution=[] olur, bütün məbləğ remain→toAdvance-a düşür və kontragentler.avans-a increment edilir (442-450). Sonra YALNIZ recalculateCustomerBalance çağırılır (459-460), recalculateSupplierBalance YOX — təchizatçının borc-u heç azalmır. Üstəlik finance_operations type 'musteri_odenis' y_n='daxil' yaradılır (463-508) — yəni təchizatçıya ödəniş PULUN İÇƏRİ GƏLMƏSİ kimi qeyd olunur, halbuki real pul ÇIXIR. Nağd hesab balansı azalmaq əvəzinə artır.
- **Bütövlük/risk:** Kritik: pul səhv istiqamətdə (mexaric əvəzinə daxil) qeyd olunur → hesab/kassa balansı ödəniş qədər YANLIŞ ARTIR; təchizatçı borcu azalmır (kreditor hesabatı şişmiş qalır); kontragentlər.avans-da mənasız avans yığılır.

## [8] 🔴 KRİTİK · Xərc yarat / sil (features/maliyye/actions
**Xərc silinəndə bağlı finance_operations geri qaytarılmır — hesab qaliqı həmişəlik aşağı qalır (pul itir)**

- **Yer:** `features/maliyye/actions.ts:224-266 (deleteExpense), müqayisə: actions.ts:130-168 (saveExpense yaratma)`
- **Repro:** 1) Hesab/kassa seçərək xərc yarat (məs. 500₼, hesab_id verilir). saveExpense L149 finance_operations sətri yaradır (y_n='mexaric', qeyd='[XERC:<id>] ...') və L167 recalculateAccountBalance hesab qaliqını 500₼ azaldır. 2) Həmin xərci Xərclər siyahısından sil (ExpenseRowActions → deleteExpense). 3) deleteExpense YALNIZ xercl_r.legv_de=NOW qoyur (L238-245), bağlı finance_operations sətrinə HEÇ TOXUNMUR. 4) finance_operations sətri hələ status='aktiv', deleted_at IS NULL qalır → calculateAccountBalance (account-balance.ts L67-73) onu mexaric kimi saymağa davam edir → hesab qaliqı 500₼ aşağı qalır, halbuki xərc silinib.
- **Gözlənilən:** Xərc silinəndə (yaratmada yaradılmış) finance_operations sətri də ləğv edilməli (status='legv', deleted_at=NOW) və hesab qaliqı recalculateAccountBalance ilə geri qaytarılmalı — eynən cancelFinanceOperation (cancel-operation-action.ts L83-154) etdiyi kimi. Yalnız xercl_r soft-delete kifayət deyil.
- **Faktiki:** deleteExpense yalnız xercl_r-i soft-delete edir; '[XERC:<id>]' tag-lı finance_operations sətri aktiv qalır, hesab balansı azalmış qalır. Heç bir kodda bu tag üzrə finance_operations ləğvi yoxdur (grep ilə təsdiqləndi).
- **Bütövlük/risk:** Hesab/kassa qaliqı (maliye_hesablari.qaliq) silinmiş xərc qədər həmişəlik az qalır — pul fiziki olaraq 'itir'. Hər silinən hesablı xərc balans drift-i yaradır; recalculateAllAccountBalances belə düzəltməz, çünki finance_operations hələ aktivdir.

## [9] 🔴 KRİTİK · Maliyyə əməliyyatı yarat / sil / ləğv
**approveOperation təsdiqdən sonra hesab qaliqını recalc ETMİR — yüksək məbləğli əməliyyat aktivləşir, balans köhnə qalır**

- **Yer:** `features/maliyye/actions.ts:830-868 (approveOperation)`
- **Repro:** 1) Quick op (məs. xərc/transfer) threshold-dən yuxarı məbləğlə yaradılır → saveQuickOperation status='gozleyen_tesdiq' qoyur və line 633 `if(!needsApproval)` səbəbindən recalculateAccountBalance ÇAĞIRILMIR (düzgün — hələ aktiv deyil). 2) Admin /maliyye/emeliyyat-da 'Təsdiqlə' edir → approveOperation status='aktiv' edir. 3) Lakin approveOperation-da heç bir recalculateAccountBalance(hesab_id/hesab_id2) çağırışı yoxdur (line 838-846 yalnız status update). 4) Hesab artıq aktiv mexaric/daxil əməliyyatına sahibdir, amma maliye_hesablari.qaliq köhnə dəyərdə qalır.
- **Gözlənilən:** approveOperation `aktiv`-ə keçirdikdən sonra op.hesab_id və op.hesab_id2 üçün recalculateAccountBalance çağırmalı (cancelFinanceOperation-dakı kimi).
- **Faktiki:** Təsdiqdən sonra finance_operation aktiv olur (calculateAccountBalance onu sayır) AMMA cache qaliq field yenilənmir. UI (account-queries.ts:81,240,280) cache qaliq-ı oxuyur → istifadəçi köhnə/yanlış balans görür. Balans yalnız HƏMİN hesaba növbəti əməliyyat recalc tetiklədikdə özünü düzəldir.
- **Bütövlük/risk:** Hesab/kassa qaliqı yüksək məbləğli təsdiqlənmiş əməliyyatdan sonra real-dünya balansından sapır (drift). Birbaşa pul/balans bütövlüyü pozulur.

## [10] 🔴 KRİTİK · Maliyyə əməliyyatı yarat / sil / ləğv
**deleteExpense xərci silir, lakin saveExpense-in yaratdığı bağlı [XERC:] finance_operation-u ləğv ETMİR — pul iki yerdə qalır, hesab qaliqı geri qaytarılmır**

- **Yer:** `features/maliyye/actions.ts:224-266 (deleteExpense) vs 130-168 (saveExpense)`
- **Repro:** 1) saveExpense hesab_id ilə çağrılır → xercl_r yaranır VƏ əlavə olaraq finance_operations qeydi (type_kod='xerc', y_n='mexaric', status='aktiv', qeyd=`[XERC:${id}]`) yaranır + recalculateAccountBalance hesabı azaldır (line 149-167). 2) Sonra deleteExpense(id) çağrılır → yalnız xercl_r.legv_de timestamp qoyulur (line 238-245). 3) Bağlı finance_operations qeydinə HEÇ toxunulmur, recalculateAccountBalance ÇAĞIRILMIR.
- **Gözlənilən:** deleteExpense bağlı [XERC:id] finance_operation-u da status='legv'+deleted_at qoymalı və recalculateAccountBalance(hesab_id) çağırmalı (xərc məbləğini hesaba geri əlavə etməli).
- **Faktiki:** Xərc 'silinmiş' görünür (xerc cədvəlində/hesabatda yox), AMMA finance_operations qeydi hələ status='aktiv', deleted_at=null qalır → /maliyye/emeliyyat siyahısında görünür (operations-queries.ts:69-70 status!='legv' AND deleted_at=null filtri), maliyyə dashboard-ında mexaric kimi sayılır VƏ hesab qaliqı azaldılmış vəziyyətdə qalır (heç vaxt geri qaytarılmır).
- **Bütövlük/risk:** Pul iki dəfə effektə düşür: xərc reportu üçün silindi, lakin cash-flow/hesab balansı azaldılmış qalır. Hesab qaliqı kalıcı olaraq aşağı (drift). Cash-flow hesabatında orfan mexaric.

## [11] 🔴 KRİTİK · Tapşırıq AXIN auditi
**createTask başqa tenant-ın istifadəçisinə tapşırıq atayır — cross-tenant sızma (mesul_id/icracilar tenant-da yoxlanmır + tapshiriq_iscilier-də sahibkar_id yoxdur)**

- **Yer:** `features/tapshiriqlar/actions.ts:170-228 (mesul_id/icracilar istifadəsi), lib/db/tenant-models.ts (tapshiriq_iscilier siyahıda YOX), prisma/schema.prisma model tapshiriq_iscilier (sahibkar_id sütunu yoxdur)`
- **Repro:** 1) İstifadəçi A (sahibkar X) DevTools / birbaşa fetch ilə createTask FormData göndərir: mesul_id = B (sahibkar Y-nin istifadəçisi UUID-si), icracilar=[B]. 2) Zod yalnız .uuid() format yoxlayır, B-nin tenant-a aid olduğunu YOX. 3) prisma.tapshiriq_iscilier.createMany çağırılır — bu cədvəl TENANT_MODELS-də yoxdur və sahibkar_id sütunu yoxdur, ona görə $extends heç bir filtr/inject etmir → B (foreign tenant) tapshiriqlar-a 'icraci' kimi yazılır. 4) bildirisler.createMany istifadeci_id=B ilə yaranır (sahibkar_id cari tenant X inject olunur), yəni B-yə yad tenant adından bildiriş gedir və ya FK səbəbindən qarışıq data yaranır.
- **Gözlənilən:** mesul_id və icracilar daxilindəki hər UUID cari sahibkar_id-yə aid aktiv istifadəçi olmalıdır (prisma.istifadeciler.findMany ilə filtrlə, tapılmayan ID-ləri at/rədd et). UI users siyahısı tenant-scoped olsa da, action birbaşa çağırıla bildiyi üçün server-də mütləq yoxlanmalıdır.
- **Faktiki:** Server heç bir tenant-üzvlük yoxlaması etmir; tapshiriq_iscilier tenant-filtrsizdir, ona görə ixtiyari (yad tenant) istifadəçi UUID-si tapşırığa bağlanır.
- **Bütövlük/risk:** Multi-tenant izolyasiya pozulur: yad tenant istifadəçisi tapşırıq icraçısı/məsulu olur, ona yad şirkət adından bildiriş gedir; 'mənim tapşırıqlarım' / KPI / performance hesablamaları cross-tenant data daşıyır.

## [12] 🟠 ORTA · İşçi yarat / redaktə / sil (deaktiv)
**saveEmployee redaktəsi soft-deleted işçini deleted_at guard-ı olmadan dəyişir**

- **Yer:** `features/iscilier/actions.ts:67-74 (findUnique/update where:{id}) və detail-queries.ts:6-12 getEmployeeFullDetail (where:{id}, deleted_at filtri yox)`
- **Repro:** Soft-deleted işçinin id-si ilə detail səhifəsi (app/(dashboard)/iscilier/[id]/page.tsx:54 yalnız notFound, deleted_at yoxlamır) açılır → EmployeeDialog initial ilə doldurulur → saveEmployee update where:{id} (deleted_at:null şərti YOXDUR).
- **Gözlənilən:** Redaktə/detail soft-deleted qeydi ya bloklamalı (notFound/icaze-yox), ya da yalnız 'bərpa' axınına icazə verməlidir. saveEmployee update-də deleted_at:null şərti və ya açıq bərpa bayrağı olmalıdır.
- **Faktiki:** Silinmiş (deleted_at!=null) işçi sərbəst redaktə/re-aktiv oluna bilir; heç bir 'bu işçi silinib, əvvəlcə bərpa edin' qoruması yoxdur. Bu #1 kritik buqu daha asan tetikleyir.
- **Bütövlük/risk:** Soft-deleted qeydin sakitcə dəyişdirilməsi audit izini qarışdırır və #1-i mümkün edir.

## [13] 🟠 ORTA · İşçi yarat / redaktə / sil (deaktiv)
**getEmployeeStats soft-deleted işçiləri ümumi say və yeni işçi sayına daxil edir**

- **Yer:** `features/iscilier/queries.ts:165 (count() — where yox), :174 (count where:{ise_baslama gte monthStart} — deleted_at yox), nəticədə :181 passiv = total - aktiv`
- **Repro:** 1) Bir işçini deaktiv et (soft-delete: deleted_at, aktiv=false). 2) getEmployeeStats çağır (HeadcountSection). 3) total = istifadeciler.count() bütün qeydləri (soft-deleted daxil) sayır.
- **Gözlənilən:** Bütün count/aggregate sorğularına deleted_at:null şərti əlavə olunmalı (digər soft-delete modulları kimi), ya da stats getEmployees ilə eyni recordStatus məntiqini izləməlidir.
- **Faktiki:** total və passiv (=total-aktiv) və bu_ay_yeni göstəriciləri soft-deleted işçiləri də sayır, halbuki siyahı (getEmployees recordStatus='aktiv') onları gizlədir. Headcount kartları ilə cədvəl say UYĞUNSUZ olur. (aktiv və maas_cemi aqreqatları aktiv:true+isden_cixdi:null filtri ilə təsadüfən düzgün qalır, çünki soft-deleted həmişə aktiv=false-dur.)
- **Bütövlük/risk:** Hesabat bütövlüyü: heyət sayı və passiv sayı şişirdilir; idarəetmə qərarları yanlış rəqəmlər üzərində qurulur.

## [14] 🟠 ORTA · Müştəri yarat/sil
**Toplu silmə (bulkDeactivate) blocker yoxlamasını tamamilə bypass edir — borclu/açıq sənədli müştəri gizlədilir**

- **Yer:** `features/elaqe/actions.ts:929-933 (bulkDeactivate → bulkSetStatus:900-927) vs deactivateContact:180-223`
- **Repro:** 1) Müştəri A-nın açıq nisyə satışı / alacaq > 0 olsun. 2) /elaqe/musteriler-də A-nı SEÇ → 'Sil (deaktivləşdir)' toplu düyməsi (contacts-table.tsx:144 doBulkDeactivate). 3) bulkSetStatus(ids,false) çağırılır → prisma.kontragentler.updateMany({where:{id:{in:ids}}, data:{aktiv:false}}) heç bir findContactBlockers yoxlaması etmir. Müqayisə üçün tək sətir deactivateContact(id) eyni müştərini 'aktiv borc və ya açıq sənədləri var' deyə BLOKLAYIR.
- **Gözlənilən:** Toplu deaktivasiya da hər id üçün findContactBlockers işlədib borclu/açıq sənədli kontragentləri ya atmalı (skip+say), ya da xəta qaytarmalıdır. force olmadan blocker varsa deaktiv olunmamalıdır.
- **Faktiki:** Toplu yolda açıq borcu/satışı olan müştəri sual-sorğusuz deaktiv edilir və default siyahıdan (where.aktiv=true) yox olur; UI 'X qeyd silindi' deyir. Tək-sətir yolda eyni əməliyyat qadağandır — qeyri-ardıcıl davranış və qoruma boşluğu.
- **Bütövlük/risk:** Borc/alacaq DB-də itmir (sahə saxlanılır), amma debitor müştəri gizlədilir → debitor siyahısında görünməyə bilər; borc izlənməsi/yığım pozulur. Maliyyə bütövlüyünə dolayı təsir.

## [15] 🟠 ORTA · Müştəri yarat/sil
**saveContact (tam forma) yaratma yolunda telefon/voen/email dublikat yoxlaması yoxdur — eyni müştəri dublikatları yaranır**

- **Yer:** `features/elaqe/actions.ts:131-167 (create branch)`
- **Repro:** 1) Eyni telefon/voen ilə eyni müştərini contact-dialog-dan iki dəfə yarat (və ya iki cihaz/iki tab, ya da formanı yenidən aç → submit). 2) saveContact create branch heç bir prisma.kontragentler.findFirst dedup etmir, birbaşa create edir. Müqayisə: quickCreateCustomer (quick-create-customer.ts:51-63) telefon dublikatını bloklayır, importContacts (actions.ts:759-779) telefon/email/voen dedup edir.
- **Gözlənilən:** Yaratmadan əvvəl ən azı telefon (normalizePhone ilə) və/və ya voen üzrə mövcudluq yoxlanmalı, dublikat halında xəta və ya mövcud qeydə yönləndirmə olmalı — quickCreateCustomer/importContacts ilə eyni davranış.
- **Faktiki:** Eyni telefon/voen/email ilə neçə dəfə submit olunsa, o qədər ayrı kontragent qeydi yaranır (DB-də kontragentler-də voen/telefon UNIQUE constraint yoxdur — schema 2761-2762). Dublikat müştərilər borc/satış tarixçəsini parçalayır.
- **Bütövlük/risk:** Borc itmir, lakin eyni real müştəri 2+ qeydə bölünür → debitor/alacaq cəmləri, hesabatlar və FIFO ödəniş paylanması yanlış müştəriyə düşə bilər.

## [16] 🟠 ORTA · İstifadəçi yarat/sil + rol təyini + ROL İCAZƏ effe
**deleteUser soft-delete email-i azad etmir + createUser dublikat yoxlaması aktiv filtri etmir → silinmiş istifadəçinin email-i ilə yeni hesab yaradıla bilmir**

- **Yer:** `features/ayar/actions.ts:979-1008 (deleteUser) + 785-788 (createUser dup check) + schema.prisma:2615 @@unique([sahibkar_id, email])`
- **Repro:** İstifadəçi silinir (aktiv=false, email saxlanır). Sonra eyni email ilə yeni istifadəçi yaratmaq istənir: createUser-dakı findFirst({where:{sahibkar_id,email}}) aktiv filtri olmadan köhnə (deaktiv) sətri tapır → 'Bu email artıq mövcuddur' xətası. Bu fayl daxilində restore action da yoxdur (yalnız toggleUserField(aktiv=true) ilə qaytarmaq olar, amma reuse ssenarisi tam bloklanır).
- **Gözlənilən:** Ya soft-delete-də deleted_at/deleted_by/delete_reason (schema-da mövcud sütunlar, sətir 2421-2423) doldurulub email azad edilməli (məs. email-i suffikslə arxivləmək), ya da createUser dup yoxlaması 'aktiv:true' ilə məhdudlaşıb deaktiv hesabı bərpa təklif etməli.
- **Faktiki:** deleted_at istifadə olunmur, yalnız aktiv=false + deaktiv_tarix/sebeb yazılır; email unique sahibsiz qalır və yenidən istifadə bloklanır.
- **Bütövlük/risk:** Funksional çatışmazlıq + DB-də ölü email kilidi; data bütövlüyünə birbaşa zərər yox, amma əməliyyat axını qırılır.

## [17] 🟠 ORTA · İstifadəçi yarat/sil + rol təyini + ROL İCAZƏ effe
**saveRolePerms transaksiyada icaze_id-lərin mövcudluğu yoxlanmır → uydurma/yanlış icaze_id-lər createMany-də FK xətası ilə bütün rolu icazəsiz qoya bilər**

- **Yer:** `features/ayar/actions.ts:144-173`
- **Repro:** icaze_ids form sahəsi yalnız 'Number.isFinite && >0' ilə süzülür; icazeler cədvəlində mövcudluğu yoxlanmır. $transaction əvvəlcə deleteMany (köhnə icazələri silir), sonra createMany. createMany-də mövcud olmayan icaze_id-ə görə FK constraint atılsa, transaksiya rollback olur — bu halda OK. AMMA skipDuplicates yalnız dublikatı atır, FK pozuntusunu yox; əgər icaze_id mövcud deyilsə tam rollback → 'Yadda saxlanmadı'. Real risk: client tərəfdən qismən düzgün ID-lər (köhnə/silinmiş icazələr) göndərilərsə nəticə qeyri-müəyyən; daha əsası bütün rol icazələri əvvəlcə silinir, uğursuzluqda istifadəçi heç nə dəyişmədiyini düşünür.
- **Gözlənilən:** createMany-dən əvvəl ids icazeler cədvəli ilə validate olunmalı (findMany select id, where id in ids) və yalnız mövcud olanlar yazılmalı; ya da transaksiya nəticəsi açıq raportlanmalı.
- **Faktiki:** ID-lər DB ilə tutuşdurulmur; yalnız ədəd/işarə yoxlaması var.
- **Bütövlük/risk:** Rol icazə paketi səhv ID-lərlə qismən/tam itə bilər (delete-then-create naxışı).

## [18] 🟠 ORTA · Müştəriyə satış
**Adi satış modalında nisyə üçün borc/kredit limiti backend-də enforce edilmir**

- **Yer:** `features/ticaret/satis-yeni-actions.ts — bütün createOrUpdateSatisYeni boyu checkCustomerCreditLimit çağırışı YOXDUR (yalnız read-only getCustomerCreditStatus 731 var)`
- **Repro:** Müştərinin borc_limiti=500, cari borcu=480 olsun. Modal/agent vasitəsilə odenis_nov="nisye" (və ya hissəvi qalıq borc) 1000 AZN satış göndər. POS-da (sale-action.ts:114 checkCustomerCreditLimit) bu bloklanır, lakin adi satış action-ı heç yoxlamır.
- **Gözlənilən:** POS-dakı kimi nisyə/hissəvi-borc satışlarda checkCustomerCreditLimit ilə server-side yoxlama + override mexanizmi olmalı.
- **Faktiki:** Limit aşan nisyə satış sərbəst yaranır; müştəri borcu limitdən qat-qat yuxarı qalxır. Backend-də guard yoxdur (yorum 729 "to block Borc payment when over limit" deyir, amma blok faktiki olaraq yoxdur).
- **Bütövlük/risk:** BORC: kredit limiti pozulur, müştəri borcu nəzarətsiz artır (balans düzgün hesablanır, lakin biznes-qaydası guard-ı backend-də yoxdur).

## [19] 🟠 ORTA · Müştəriyə satış
**Adi satış action-ında double-submit idempotensi yoxdur — eyni satış iki dəfə yaranır (qoşa stok azalması + qoşa ödəniş)**

- **Yer:** `features/ticaret/satis-yeni-actions.ts:98-277 — client_op_id sahəsi heç istifadə olunmur (POS-dakı sale-action.ts:154-170 + DB satis_client_op_uniq index-i var, adi axında YOXDUR)`
- **Repro:** yeni-satis-modal.tsx onSave yalnız client-side `pending`/disabled ilə qorunur. Şəbəkə ləng cavabında istifadəçi yenidən klik etsə VƏ YA retry baş versə (və ya iki paralel server-action çağırışı), createOrUpdateSatisYeni iki ayrı nextDocNumber alır, iki ayrı satis_sifarisleri + iki dəfə safeStockDecrement + iki dəfə kassa/finance qeydi yaradır. Heç bir client_op_id / unique guard yoxdur.
- **Gözlənilən:** POS-dakı kimi client_op_id (və ya idempotency açarı) qəbul edib mövcud satışı qaytarmaq; ən azı qısa pəncərədə eyni (musteri, totals, lines) təkrarını tutmaq.
- **Faktiki:** Eyni satış üçün 2 sənəd, stok 2× azalır, kassa/finance-ə 2× mədaxil, müştəri balansı (nisyədirsə) 2× borc.
- **Bütövlük/risk:** PUL+STOK+BORC: hər üçü dublikat olur.

## [20] 🟠 ORTA · Müştəriyə satış
**input.id ilə "redaktə" niyyəti CREATE branch-ına düşür — finalize olunmuş satışı düzəltmək əvəzinə yeni dublikat satış yaradır**

- **Yer:** `features/ticaret/satis-yeni-actions.ts:102-103 (id oxunur, satis.duzelt icazəsi verilir) vs 213/249 (yalnız qaralama_id update edir; id CreateSchema-da yoxdur → Zod strip edir)`
- **Repro:** createOrUpdateSatisYeni({id:<finalize olunmuş satis>, ...lines, odenis_nov:"negd"}) çağır (qaralama_id GÖNDƏRMƏDƏN). Zod data.id-ni atır, data.qaralama_id undefined → kod 249-dakı CREATE branch-ına düşür: yeni nömrə, yeni satış, stok yenidən azalır.
- **Gözlənilən:** id verilibsə ya gerçək redaktə (mövcud satışı update + köhnə hərəkətləri geri al) həyata keçirilməli, ya da açıq xəta qaytarılmalı. id-ni icazə üçün oxuyub məntiqi axında tamam yox saymaq səhvdir.
- **Faktiki:** Orijinal satış toxunulmaz qalır; tamamilə yeni satış yaranır və stok ikinci dəfə azalır — istifadəçi "redaktə etdim" zənn edir.
- **Bütövlük/risk:** STOK: ikinci məxaric → stok qaliqı yanlış azalır; PUL: ikinci kassa/finance qeydi.

## [21] 🟠 ORTA · Qaytarma
**acceptReturn orijinal sənədi (son_mebleg/umumi_mebleg) ENDİRİR, statement isə həm endirilmiş sənədi həm də qaytarma kreditini sayır → ikiqat azalma**

- **Yer:** `features/qaytarma/actions.ts:233-242 (son_mebleg endirir) və :260-266 (umumi_mebleg endirir); customer-statement.ts:156 (endirilmiş son_mebleg debet) + :188 (geri_qaytarildi kredit); supplier-statement.ts:137 + :167`
- **Repro:** nov uyğunsuzluğu (yuxarıdakı bug) düzələn kimi bu üzə çıxır: 1) 100₼ nisyə satış. 2) createReturn 40₼ + acceptReturn → satis.son_mebleg 60₼-ə endirilir. 3) Statement: satış debet=60 (endirilmiş) + qaytarma kredit=40 → net 20 (səhv). Düzgün: ya orijinal 100 debet + 40 kredit = 60, ya da endirilmiş 60 debet + 0 kredit = 60.
- **Gözlənilən:** Ya orijinal sənəd toxunulmaz qalsın + qaytarma ayrı kredit kimi göstərilsin, ya da sənəd endirilsin VƏ qaytarma statement-də göstərilməsin.
- **Faktiki:** acceptReturn balansı recalc ilə düzgün saxlasa da (son_mebleg-i azaldıb source-of-truth-a güvənir), statement eyni azalmanı İKİ DƏFƏ tətbiq edir (həm endirilmiş sənəd, həm ayrı qaytarma sətri).
- **Bütövlük/risk:** Statement son_qaliq həqiqi borcdan az görünür — debitor/kreditor aktı səhv.

## [22] 🟠 ORTA · Qaytarma
**acceptReturn-da NƏĞD/KART satışın qaytarılması üçün kassa refund YOXDUR (fastReturn/returnFullSale-da var) — uyğunsuz pul axını**

- **Yer:** `features/qaytarma/actions.ts:150-287 (acceptReturn — heç bir kassa_emeliyyatlari.create yoxdur); müq. qaytarma-tez-actions.ts:239-254 (fastReturn) və :556-578 (returnFullSale)`
- **Repro:** 1) Orijinal nəğd satış. 2) createReturn ilə müştəri qaytarması yarat, acceptReturn et. Stok artır, amma kassaya heç bir mənfi əməliyyat düşmür → müştəriyə nağd pul qaytarılsa da kassa balansı azalmır.
- **Gözlənilən:** acceptReturn nəğd/kart müştəri qaytarmasında da kassadan refund (mənfi mebleg) yaratmalı, ya da bütün axın vahid funksiyaya yönəlməli.
- **Faktiki:** acceptReturn yalnız stok + son_mebleg/odenilmis/balans korreksiyası edir, kassa refund yaratmır. fastReturn və returnFullSale isə nəğd satışda kassaya mənfi əməliyyat yazır. Eyni biznes hadisəsi iki yolla fərqli nəticə verir.
- **Bütövlük/risk:** Kassa qalığı real pulu əks etdirmir — müştəriyə nağd verilən pul sistemdə qeydə alınmır.

## [23] 🟠 ORTA · Qaytarma
**createReturn original_id-ni heç vaxt yazmır → acceptReturn-də orijinal satış/alış korreksiyası (balans+status) İŞLƏMİR**

- **Yer:** `features/qaytarma/actions.ts:23-30 (CreateReturnSchema original_id sahəsi yoxdur), :68-90 (create.data original_id yazmır) və :223,252 (acceptReturn `if (ret.original_id)` — həmişə false)`
- **Repro:** 1) new-return-dialog ilə müştəri qaytarması yarat (original_id forma/schema-da yoxdur). 2) acceptReturn et. `ret.original_id` null olduğu üçün satış/alış son_mebleg, odenilmis, status='qaytarilib' korreksiyası BLOKU heç vaxt çağrılmır.
- **Gözlənilən:** createReturn original_id qəbul edib saxlamalı (CreateReturnSchema + create.data), ki acceptReturn orijinal sənədə təsir edə bilsin. İndi bu kod tamamilə ölüdür.
- **Faktiki:** Manual qaytarma yalnız stok artırır/azaldır və qaytarma_sifarisleri-ni 'tamamlandi' edir; orijinal satışa heç bir təsir yoxdur (status 'qaytarilib' olmur, borc azalmır).
- **Bütövlük/risk:** Manual müştəri qaytarması müştəri borcunu azaltmır (nisyə satış 'aktiv' qalır, qalıq tam saxlanır) — müştəri artıq qaytardığı malın pulunu hələ borclu görünür.

## [24] 🟠 ORTA · Qaytarma
**returnFullSale: nəğd/kart hissəvi qaytarmada kassa refund VAR, amma satışın son_mebleg azalmır → gəlir şişik qalır**

- **Yer:** `features/ticaret/qaytarma-tez-actions.ts:556-578 (nəğd refund həm tam həm hissəvi) və :580-604 (son_mebleg/status yalnız fullReturn-da və ya nisyədə dəyişir)`
- **Repro:** 1) 100₼ NƏĞD satış (odenilmis=100). 2) returnFullSale ilə 1 sətir (40₼) hissəvi qaytar. 3) Kassadan 40₼ refund yazılır (refund=min(40,100)). LAKİN isNisye=false → son_mebleg/status dəyişmir, fullReturn=false → 'qaytarilib' olmur.
- **Gözlənilən:** Nəğd hissəvi qaytarmada son_mebleg də qaytarılan məbləğ qədər azalmalı və ya gəlir reportu qaytarmanı nəzərə almalı.
- **Faktiki:** Kassadan pul çıxır, amma satışın son_mebleg hələ 100 qalır, status aktiv. Gəlir hesabatında satış 100₼ gəlir kimi qalır, refund kassada ayrı çıxış kimi görünür.
- **Bütövlük/risk:** Gəlir/marja hesabatı qaytarılan nəğd satışda şişik qalır; kassa düz, gəlir səhv → drift.

## [25] 🟠 ORTA · Ödəniş
**recordContactPayment-də server tərəfdə over-pay (artıq ödəniş) bloku yoxdur — artıq məbləğ səssizcə avansa düşür**

- **Yer:** `features/elaqe/actions.ts:360-365 (PaymentSchema), 408-425 (FIFO + toAdvance), 442-450`
- **Repro:** Müştəri detal/borclar səhifəsində 'Ödəniş al' aç, məbləğ sahəsinə qalıq borcdan ÇOX rəqəm yaz (UI max={maxAmount}-i HTML max-dır, type=number ilə manual/inspect ilə keçilə bilər və ya FormData birbaşa göndərilə bilər). Təsdiqlə.
- **Gözlənilən:** Ya server over-pay-i bloklamalı (recordSalePayment kimi), ya da ən azı avansa düşən məbləğ barədə açıq warning/return qaytarmalıdır ki, istifadəçi səhv rəqəmi anlasın.
- **Faktiki:** PaymentSchema yalnız mebleg.positive() yoxlayır — yuxarı hədd YOXDUR. recordSalePayment-dəki kimi (satis-actions.ts:82-83) 'qalıq borcdan çoxdur' bloku burada yoxdur. Artıq məbləğ toAdvance kimi kontragentler.avans-a increment olunur (442-450), istifadəçiyə heç bir xəbərdarlıq qaytarılmır (warning sahəsi yoxdur), toast yalnız 'Ödəniş qeydə alındı' deyir.
- **Bütövlük/risk:** Müştəri borcu 0-a düşür amma artıq pul avans kimi gizli qalır; recalculateCustomerBalance avans=0 hardcode etdiyi üçün (customer-balance.ts:95,99) avans heç bir balansa daxil edilmir — yığılan avans yalnız ayrı action-larda görünür, ümumi alacaq hesabatında itir.

## [26] 🟠 ORTA · Ödəniş
**recordContactPayment FOR UPDATE lock-suz işləyir — paralel/double-submit qaimələri over-pay edə bilər**

- **Yer:** `features/elaqe/actions.ts:386-439 (openSales oxunması tranzaksiyadan KƏNAR, sonra tx daxilində increment)`
- **Repro:** Eyni kontragent üçün PaymentDialog-u iki dəfə sürətlə göndər (double-submit; payment-dialog.tsx-də submit zamanı düymə yalnız useTransition-pending ilə bağlanır, lakin iki ayrı tab/sürətli klik mümkündür). Hər iki çağırış openWithQalig-i eyni qalıqla oxuyur.
- **Gözlənilən:** Qaimələr tx daxilində FOR UPDATE ilə kilidlənməli və qalıq tx daxilində yenidən oxunmalıdır; double-submit / paralel ödəniş dublikat finance_operations və over-pay yaratmamalıdır.
- **Faktiki:** openSales/openWithQalig hesablanması (386-406) prisma.$transaction-dan ƏVVƏL, lock-suz oxunur. recordSalePayment-dəki SELECT ... FOR UPDATE (satis-actions.ts:48-53) analoqu burada YOXDUR. İki paralel çağırış eyni qaiməyə hər biri qalıq qədər increment(odenilmis) edə bilər → satis_sifarisleri.odenilmis son_mebleg-dən çox olur (over-pay). recalculateCustomerBalance Math.max(0, ...) ilə alacaq-ı 0-a sıxır, beləliklə drift gizlənir, amma odenilmis cədvəldə şişmiş və iki finance_operations 'daxil' yaradılmış olur (ikiqat mədaxil).
- **Bütövlük/risk:** İkiqat finance_operations daxil → hesab balansı 2x artır; satis_sifarisleri.odenilmis > son_mebleg drift; idempotentlik yoxdur.

## [27] 🟠 ORTA · Xərc yarat / sil (features/maliyye/actions
**Xərc redaktəsində məbləğ dəyişikliyi bağlı finance_operations-a tətbiq olunmur — balans köhnə məbləğdə qalır**

- **Yer:** `features/maliyye/actions.ts:110-123 (saveExpense edit budağı)`
- **Repro:** 1) hesab_id ilə 500₼ xərc yarat → finance_operations 500₼ mexaric. 2) Eyni xərci redaktə edib mebleg=200₼ et (forma id ilə göndərir). 3) saveExpense edit budağı (L118 updateMany) yalnız xercl_r-i yeniləyir; bağlı finance_operations.meblegh/azn_meblegh dəyişmir və recalculateAccountBalance çağırılmır.
- **Gözlənilən:** Redaktədə məbləğ/hesab dəyişdikdə bağlı finance_operations sətri yenilənməli və hesab balansı recalc olunmalı.
- **Faktiki:** finance_operations 500₼-də qalır, hesab balansı yeni 200₼-i əks etdirmir; xercl_r 200₼, finance_op 500₼ — iki mənbə uyğunsuz.
- **Bütövlük/risk:** Hesab qaliqı və xərc bütövlüyü pozulur: Xərclər siyahısı/P&L 200₼ göstərir, hesab balansı isə 500₼ azalmış qalır.

## [28] 🟠 ORTA · Maliyyə əməliyyatı yarat / sil / ləğv
**rejectOperation status guard-sız VƏ recalc-sız — aktiv əməliyyatı 'redd' edib balansı/allocation-ları geri qaytarmadan pulu balansdan çıxarır**

- **Yer:** `features/maliyye/actions.ts:871-911 (rejectOperation)`
- **Repro:** 1) Aktiv finance_operation mövcuddur (məs. qaime ödənişi, allocation-larla, hesab qaliqına daxil olub). 2) rejectOperation(id) çağrılır → where filtri yalnız {id, sahibkar_id} (line 879-880), status guard YOXDUR → aktiv əməliyyatı da status='redd' edir. 3) calculateAccountBalance redd-i saymır (yalnız status='aktiv') → əməliyyatın balans effekti yox olur, AMMA rejectOperation recalculateAccountBalance ÇAĞIRMIR → cache qaliq köhnə qalır. 4) Üstəlik allocation-lar silinmir, satis.odenilmis geri açılmır, avans reversal edilmir (cancelFinanceOperation bunları edir, rejectOperation etmir).
- **Gözlənilən:** rejectOperation where-də status:{in:['gozleyen_tesdiq','gozleyir']} guard olmalı (yalnız təsdiq gözləyəni rədd etmək olar). Aktiv op rədd edilməməli; ləğv üçün cancelFinanceOperation istifadə olunmalı.
- **Faktiki:** Aktiv əməliyyat 'redd' olunanda hesab cache qaliqı stale qalır + bağlı satış/alış odenilmis və avans düzgün geri qaytarılmır. UI normalda Rədd düyməsini yalnız isPending (gozleyen_tesdiq) üçün göstərir (operation-row-actions.tsx:196), lakin server action birbaşa çağrıla bilər → backend müdafiə boşluğu.
- **Bütövlük/risk:** Aktiv əməliyyatın səhv rədd edilməsi halında hesab qaliqı və kontragent borc/avans balansı pozulur.

## [29] 🟠 ORTA · Maliyyə əməliyyatı yarat / sil / ləğv
**runRecurringCheck təkrarlanan əməliyyat instansiyası yaradır, lakin heç bir balans recalc çağırmır**

- **Yer:** `features/maliyye/actions.ts:2606-2632 (runRecurringCheck)`
- **Repro:** 1) Cron/manual runRecurringCheck işləyir → təkrarlanan qaydadan finance_operations.create ilə yeni aktiv əməliyyat yaranır (status='aktiv', hesab_id/hesab_id2/kontragent_id ilə, line 2607-2628). 2) Yaradıldıqdan sonra recalculateAccountBalance / recalculateCustomerBalance / recalculateSupplierBalance ÇAĞIRILMIR (yalnız revalidatePath + bustMaliyyeCache).
- **Gözlənilən:** Hər yaradılan recurring instansiyasından sonra (və ya batch sonunda toplu olaraq) təsirlənmiş hesab_id/hesab_id2/kontragent_id üçün recalculate* çağrılmalı.
- **Faktiki:** calculateAccountBalance yeni aktiv recurring əməliyyatı sayır, lakin maliye_hesablari.qaliq cache yenilənmir → hesab qaliqı təkrarlanan əməliyyatların sayına görə drift edir, ta ki başqa əməliyyat həmin hesabı recalc edənə qədər.
- **Bütövlük/risk:** Avtomatik təkrarlanan kirayə/abunə/maaş ödənişləri hesab qaliqını real-time əks etdirmir — cache drift.

## [30] 🟠 ORTA · Tapşırıq AXIN auditi
**requires_approval (Rəhbər təsdiqi tələb olunur) tamamilə ölü funksiyadır — heç yerdə tətbiq olunmur, icraçı təsdiqsiz 'tamamlandi' edir**

- **Yer:** `features/tapshiriqlar/actions.ts:205 (yalnız create-də yazılır), changeTaskStatus 357-453 (yoxlama yoxdur); repo-da approveTask/approved_by/approved_at yazan heç bir action yoxdur (grep boş)`
- **Repro:** 1) Tapşırıq 'Rəhbər təsdiqi tələb olunur' işarəli yaradılır → requires_approval=true DB-yə yazılır. 2) İcraçı QuickStatusButtons → changeTaskStatus(taskId, 'tamamlandi') çağırır. 3) changeTaskStatus yalnız açıq checklist blocker-ini yoxlayır; requires_approval / approved_at / approved_by-a heç vaxt baxmır. 4) Status birbaşa 'tamamlandi' olur, tamamlandi_de yazılır, approved_at NULL qalır.
- **Gözlənilən:** requires_approval=true olan tapşırıq 'tamamlandi'-yə keçməzdən əvvəl approved_by/approved_at dolmuş olmalı (və ya 'gozlemede'-də qalıb rəhbər təsdiqini gözləməli); icraçı birbaşa tamamlaya bilməməli.
- **Faktiki:** Bayraq saxlanılır amma heç vaxt yoxlanılmır; təsdiq mexanizmi (approveTask action, /tesdiq inteqrasiyası) ümumiyyətlə yoxdur. İstifadəçiyə vəd edilən nəzarət işləmir.
- **Bütövlük/risk:** Biznes nəzarət bütövlüyü: təsdiq tələb edən iş axınları rəhbər təsdiqi olmadan 'tamamlandı' kimi sayılır (KPI/bonus hesablamalarına da düşür).

## [31] 🟠 ORTA · Tapşırıq AXIN auditi
**createTask double-submit / təkrar çağırış dublikat tapşırıq yaradır (idempotensiya yoxdur)**

- **Yer:** `features/tapshiriqlar/actions.ts:133-316 (createTask), components/new-task-dialog.tsx:57-80 (onSubmit)`
- **Repro:** 1) Eyni formanı sürətlə 2 dəfə submit et (zəif şəbəkə, ikiqat klik, və ya action-ı script ilə 2 dəfə çağır). 2) useTransition pending UI-da düyməni disable etsə də, server-side heç bir təkrar-mühafizə (dedup açarı, unikal məhdudiyyət, son N saniyədə eyni başlıq yoxlaması) yoxdur. 3) Hər çağırış ayrı $transaction-da yeni tapshiriqlar sətri + ayrı bildirişlər yaradır.
- **Gözlənilən:** Eyni yaradan + eyni başlıq + qısa pəncərədə təkrar create-in qarşısı alınmalı (idempotency key / debounce server-side / unikal şərt) ki, double-submit dublikat tapşırıq və ikiqat bildiriş yaratmasın.
- **Faktiki:** Hər submit yeni tapşırıq + yeni bildiriş dəstini yaradır; eyni iş 2 dəfə listdə görünür və icraçıya 2 bildiriş gedir.
- **Bütövlük/risk:** Bildiriş/iş sayğacları (KPI, dashboard badge) şişir; broadcast halında hər təkrarda bütün aktiv əməkdaşlara yenidən bildiriş gedir.

## [32] 🟠 ORTA · Tapşırıq AXIN auditi
**createTask-da keçmiş tarixli xatırlatma yazıla bilir, amma heç bir cron onu göndərmir — bildiriş yaranmır (setTaskReminder-dəki 'indi göndər' məntiqi burada yoxdur)**

- **Yer:** `features/tapshiriqlar/actions.ts:200-201, 243-254 (createTask xatirlatma); müqayisə üçün setTaskReminder 643-668 (isNow → dərhal bildiriş); app/api/cron/ altında tapshiriq xatırlatma dispatcher YOXDUR (yalnız check-overdue-tasks deadline üçündür)`
- **Repro:** 1) Yeni tapşırıq dialoqunda 'Xatırlatma' sahəsinə keçmiş və ya 'indi'-yə yaxın datetime ver (datetime-local min yoxdur, keçmiş seçilə bilir). 2) createTask onu validasiyasız new Date(d.xatirlatma) kimi yazır, xatirlatma_gonderildi=false, və tapshiriq_xatirlatmalar sətri yaradır. 3) setTaskReminder-dən fərqli olaraq, createTask 'isNow' yoxlaması etmir → dərhal bildiriş YOX. 4) Heç bir cron tapshiriq_xatirlatmalar/xatirlatma sahəsini emal edib bildiriş göndərmir (grep: yalnız actions.ts və tenant-models.ts istinad edir). Yəni xatırlatma yalnız fetchActiveReminderCount badge-ində (xatirlatma <= now) görünür, push/bildiriş heç vaxt getmir.
- **Gözlənilən:** Ya createTask da setTaskReminder kimi keçmiş/indi xatırlatma üçün dərhal bildiriş yaratmalı, ya da xatırlatmaları dövri göndərən cron olmalı; minimum keçmiş tarix validasiya ilə rədd/normallaşdırılmalı.
- **Faktiki:** createTask-dan qoyulan xatırlatma heç vaxt bildiriş kimi 'atəşlənmir'; tapshiriq_xatirlatmalar sətri yazılır amma onu oxuyan/göndərən proses yoxdur — ölü data + işləməyən xatırlatma.
- **Bütövlük/risk:** Xatırlatma vədi yerinə yetirilmir; tapshiriq_xatirlatmalar cədvəlində gonderildi=false sətirlər toplanır (heç vaxt təmizlənmir).

## [33] 🟠 ORTA · Alış sifarişi yarat / qəbul / sil
**Sənəd nömrəsi (nomre) race-unsafe əl ilə generasiya olunur — atomik nextDocNumber helper-i import edilib AMMA istifadə olunmur**

- **Yer:** `features/ticaret/alis-actions.ts:10 (import), 73-79 (faktiki generasiya); lib/db/sened-nomre.ts:41 (istifadə olunmayan helper)`
- **Repro:** 1) İki istifadəçi (və ya double-submit) eyni anda createPurchase çağırır. 2) Hər iki tranzaksiya `findFirst({ where: { nomre: { startsWith: 'ALS-2026-' }}, orderBy: { nomre: 'desc' }})` ilə eyni lastNum=N oxuyur (FOR UPDATE / lock yoxdur). 3) Hər ikisi `ALS-2026-0000(N+1)` hesablayır. 4) nomre schema-da @unique (qlobal) olduğu üçün ikinci INSERT unique violation atır → 'Alış qaiməsi yaradılmadı'. nextDocNumber (sened_nomre_counter ON CONFLICT DO UPDATE) məhz bunu həll edir, line 10-da import olunub, lakin heç yerdə çağırılmır (dead import).
- **Gözlənilən:** Sənəd nömrəsi atomik counter ilə (nextDocNumber) yaradılmalı; paralel/double-submit-də collision olmamalı.
- **Faktiki:** Manual max+1 findFirst istifadə olunur (helper docstring-inin 'race-unsafe son resort' adlandırdığı yol); paralel yaratma birində unique-violation xətası verir.
- **Bütövlük/risk:** Çoxlu eyni-vaxtlı alış yaratma uğursuz olur; istifadəçi xəta görüb təkrar basa bilər. Dublikat YARANMIR (unique constraint qoruyur), amma əməliyyat itkisi/qarışıqlıq yaranır.

## [34] 🟠 ORTA · Alış sifarişi yarat / qəbul / sil
**Çoxkirayəçi (multi-tenant) nomre toqquşması — nomre qlobal @unique, generator isə yalnız tenant daxilində sayır**

- **Yer:** `features/ticaret/alis-actions.ts:73-79; prisma/schema.prisma alis_sifarisleri.nomre @unique (qlobal, @@unique([sahibkar_id, nomre]) YOXDUR)`
- **Repro:** 1) Tenant A öz ilk alışını yaradır → findFirst tenant-scoped olduğu üçün lastNum=0 → nomre = 'ALS-2026-00001'. 2) Tenant B də öz ilk alışını yaradır → onun üçün də lastNum=0 → eyni 'ALS-2026-00001'. 3) İkinci INSERT qlobal @unique constraint-ə düşür → unique violation → 'Alış qaiməsi yaradılmadı'.
- **Gözlənilən:** Hər tenant müstəqil ardıcıllıqla nomre almalı; başqa tenant-ın nömrəsi A tenant-ın yaratmasını bloklamamalı (ya @@unique([sahibkar_id, nomre]), ya da nextDocNumber-in tenant-aware counter-i).
- **Faktiki:** nomre qlobal unikaldır, generator isə tenant daxili max+1 verir → fərqli tenant-lar eyni nömrəni istehsal edib bir-birinin yaratmasını bloklayır.
- **Bütövlük/risk:** Bir tenant-ın fəaliyyəti digər tenant-ın alış yaratmasını dayandıra bilər (tenant izolyasiyası pozulması — DoS-bənzəri).

## [35] 🟠 ORTA · Alış sifarişi yarat / qəbul / sil
**Təsdiq gözləyən (tesdiq_gozleyir) alış dərhal təchizatçı borcuna düşür — təsdiqdən əvvəl borc kimi sayılır**

- **Yer:** `lib/balance/supplier-balance.ts:50-54 (status NOT IN ('legv') — tesdiq_gozleyir exclude edilmir); features/ticaret/alis-actions.ts:88-92, 171 (needsApproval halında recalc edilmir, amma status tesdiq_gozleyir saxlanır)`
- **Repro:** 1) Admin 'alış qaiməsi təsdiq tələbi'ni aktiv edib. 2) createPurchase → status='tesdiq_gozleyir', umumi_mebleg=X, odenilmis=0. createPurchase-da needsApproval=true olduğu üçün recalculateSupplierBalance burada çağırılmır (cache stale qalır). 3) Lakin həmin təchizatçıya başqa bir alış/ödəniş əməliyyatı recalculateSupplierBalance-i tetiklər → calculateSupplierBalance sorğusu tesdiq_gozleyir alışı da SUM(umumi_mebleg - odenilmis)-ə qatır (yalnız 'legv' exclude olunur). 4) Nəticədə hələ təsdiqlənməmiş alış kreditor borcu kimi görünür.
- **Gözlənilən:** Təsdiq gözləyən alış təsdiqlənənə qədər borca düşməməli (satış tərəfində materializeApprovedSale pattern-i ilə təsir təsdiqdən sonra yaranır).
- **Faktiki:** calculateSupplierBalance 'tesdiq_gozleyir' statusunu exclude etmir → təsdiq gözləyən alış dərhal borc kimi sayıla bilir; rədd edilərsə (status='legv') yenidən düşür, amma aralıqda borc şişir.
- **Bütövlük/risk:** Təchizatçı borcu (kontragentler.borc) və kreditor passivi təsdiqlənməmiş sənədlə şişir — maliyyə hesabatında səhv passiv.

## [36] 🟠 ORTA · Alış sifarişi yarat / qəbul / sil
**cancelPurchase-də təsdiq blocker-i yanlış cədvələ sorğu vurur — 'Təsdiq sorğusu' blocker-i heç vaxt tapılmır**

- **Yer:** `lib/blockers/find-purchase-blockers.ts:24-31 (tx.tesdiq_sorgulari, hedef_nov/hedef_id, status='gozlemede'); faktiki sorğu tesdiq_telep-də saxlanır (features/tesdiq/create.ts:115, resurs_nov/resurs_id)`
- **Repro:** 1) Təsdiq tələbli alış yaradılır → tesdiq_telep cədvəlinə resurs_nov='alis_sifarisi', resurs_id=purchaseId, status='gozleyir' yazılır (alis_sifarisleri.status='tesdiq_gozleyir'). 2) İstifadəçi həmin alışı cancelPurchase ilə ləğv etməyə çalışır → locked.status==='tesdiq_gozleyir' branch-ı findPurchaseBlockers çağırır. 3) findPurchaseBlockers tesdiq_SORGULARI cədvəlində hedef_nov='alis_sifarisi' axtarır — amma sorğu tesdiq_TELEP-dədir → nəticə boş. 4) Nəticə: blockers=[] qaytarılır, istifadəçiyə 'təsdiq sorğusunu rədd edin' deyilir, amma hansı sorğu olduğu göstərilmir (link/ID yoxdur).
- **Gözlənilən:** Pending təsdiq tələbi (tesdiq_telep-dən resurs_nov='alis_sifarisi', resurs_id=purchaseId, status='gozleyir') blocker kimi qaytarılmalı və düzgün /tesdiq/<id> link verilməli.
- **Faktiki:** Səhv cədvəl (tesdiq_sorgulari) + səhv sahə adları (hedef_nov/hedef_id) sorğulanır → blocker boş; istifadəçi hansı təsdiqi rədd edəcəyini görmür.
- **Bütövlük/risk:** Bütövlük pozulmur (cancel yenə bloklanır), amma UX/iş axını qırılır — istifadəçi təsdiqi tapıb rədd edə bilmir, alış ləğv olunmaz vəziyyətdə ilişib qala bilər.

## [37] 🟡 KİÇİK · Müştəri yarat/sil
**Avto-loyalty kart kodu Date.now() əsaslıdır — eyni millisaniyədə yaranan ikinci müştəri kartsız qalır (səssiz)**

- **Yer:** `features/elaqe/actions.ts:150-161`
- **Repro:** 1) İki müştəri eyni millisaniyə daxilində yaradılsın (sürətli ardıcıl/paralel saveContact create). 2) kartKod = `LK${Date.now().toString().slice(-9)}` hər ikisi üçün eyni alınır. 3) loyalty_cards-da @@unique([sahibkar_id, kart_kod]) (schema 6460+) ikinci create-i pozur, .catch(e=>console.warn) onu səssiz udur.
- **Gözlənilən:** kart_kod təkrarsız generasiya olunmalı (məs. UUID/crypto random suffix və ya kontragent_id əsaslı) və ya kollizyon halında retry edilməli; ən azı @@unique([sahibkar_id, kontragent_id] olduğundan kontragent başına 1 kart) — amma kart_kod kollizyonu auto-create-i kontragentdən asılı olmayan səbəbdən bloklayır.
- **Faktiki:** İkinci müştəri üçün loyalty kart YARANMIR; istifadəçiyə heç bir xəbərdarlıq getmir, müştəri kartsız qalır (orphan/əskik). Həmçinin slice(-9) → 9 rəqəm millisaniyə dəqiqliyini saxlamır, kollizyon ehtimalı yüksəkdir.
- **Bütövlük/risk:** Pul/stok bütövlüyünə təsir yoxdur, yalnız loyalty kart əskik qalır.

## [38] 🟡 KİÇİK · İstifadəçi yarat/sil + rol təyini + ROL İCAZƏ effe
**İstifadəçi rolu dəyişəndə (changeUserRole) köhnə icazə paketi JWT səbəbindən ~60 saniyə qüvvədə qalır**

- **Yer:** `features/ayar/actions.ts:932-933 + auth.ts:194-216 (jwt callback 60s) + lib/auth/get-permissions.ts:24`
- **Repro:** changeUserRole yalnız revalidatePath edir, JWT-dəki rol_id-i yeniləmir. getRequestPermissions session.user.rol_id-ə baxır; bu dəyər jwt callback-də yalnız 60_000ms-dən bir DB ilə yenilənir. Beləliklə rol aşağı salınsa belə istifadəçi ən çox ~60 san köhnə (geniş) icazələrlə işləyə bilər; rol yüksəldilsə yeni icazələri ~60 san gec görür.
- **Gözlənilən:** Rol dəyişdikdə hədəf istifadəçinin sessiyası məcburi yenilənməli (session-version/jwt invalidation) ki, dərhal qüvvəyə minsin — xüsusən aşağı-salma (deescalation) halında.
- **Faktiki:** 60s pəncərə var (sənədləşdirilmiş K4 azaltması), 'dərhal' deyil.
- **Bütövlük/risk:** Qısa müddətli icazə sürüşməsi; pul/stok birbaşa deyil, lakin deescalation gecikir.

## [39] 🟡 KİÇİK · Müştəriyə satış
**finance_operations hesab tapılmayanda hesab_id=null ilə yazılır — kassa hesabatı ilə maliyə hesab balansı arasında uyğunsuzluq**

- **Yer:** `features/ticaret/satis-yeni-actions.ts:417-461 (hesabIdForOp null qala bilər) və features/pos/sale-action.ts:386-418`
- **Repro:** Sahibkarda uyğun növdə (nağd/kart/bank) aktiv maliye_hesablari və kassanın maliye_hesab_id-si yoxdursa, hesabIdForOp=null. finance_operations.create hesab_id=null ilə işləyir, sonra recalculateAccountBalance `if (hesabIdForOp)` ilə skip olunur.
- **Gözlənilən:** Hesab tapılmazsa ya default hesab yaradılmalı/məcburi seçilməli, ya da operator xəbərdar edilməli; hesab_id=null finance_operation yaratmamalı.
- **Faktiki:** finance_operation hesab_id=null kimi qalır → account-balance.ts heç bir hesaba aid etmir; kassa_emeliyyatlari isə pulu kassa hesabatında göstərir. İki ledger arasında fərq yaranır.
- **Bütövlük/risk:** PUL: maliyə-hesab balansı ilə kassa hesabatı drift edir (gəlir görünür amma hesab qaliqına düşmür).

## [40] 🟡 KİÇİK · Qaytarma
**nextReturnNumber sıra-nömrəsi race-condition — paralel iki createReturn eyni nömrəni almağa cəhd edir**

- **Yer:** `features/qaytarma/actions.ts:32-44 (nextReturnNumber findFirst+1, transaction-dan kənar, lock-suz); schema nomre @unique`
- **Repro:** İki istifadəçi/iki tab eyni anda createReturn çağırır. Hər ikisi son nömrəni oxuyur (Q-YYMMDD-0007), ikisi də 0008 hesablayır. nomre @unique olduğu üçün biri unique-violation alır → 'Qaytarma yaradılmadı'.
- **Gözlənilən:** Nömrə generasiyası DB sequence/advisory-lock ilə, və ya unique-violation-da retry ilə həll olunmalı.
- **Faktiki:** Nömrə generasiyası transaction-dan KƏNAR və lock-suz. Dublikat yox (unique qoruyur), amma əməliyyat səbəbsiz uğursuz olur.
- **Bütövlük/risk:** Dublikat yox (unique guard), amma rəqabətdə əməliyyat itə bilər.

## [41] 🟡 KİÇİK · Qaytarma
**returnFullSale stok geri ƏLAVƏ-də updateMany — stok sətri yoxdursa səssiz keçir (medaxil hərəkəti yazılır, stok artmır)**

- **Yer:** `features/ticaret/qaytarma-tez-actions.ts:452-459 (stok.updateMany increment) — müq. fastReturn:182-188 stockIncrement upsert`
- **Repro:** Satışdan sonra məhsulun həmin anbardakı stok sətri silinibsə, returnFullSale `stok.updateMany WHERE mehsul+anbar` 0 sətrə toxunur. Increment baş vermir, amma anbar_hereketleri 'medaxil' yazılır.
- **Gözlənilən:** fastReturn-dakı kimi stockIncrement (upsert) işlədilməli ki stok sətri yaransın.
- **Faktiki:** updateMany 0 sətir tapsa səssiz keçir; stok artmır, lakin hərəkət jurnalı və qaytarma 'tamamlandi' görünür.
- **Bütövlük/risk:** Stok qalığı anbar_hereketleri cəmi ilə uyğunsuzlaşır (anomali hesabatında üzə çıxar).

## [42] 🟡 KİÇİK · Qaytarma
**fastReturn nisyə: qaytarma açıq borcdan çoxdursa artıq (overpaid) hissə üçün refund/avans yoxdur**

- **Yer:** `features/ticaret/qaytarma-tez-actions.ts:228-238 (apply=min(total,qalig), yalnız odenilmis increment)`
- **Repro:** 100₼ nisyə satış, müştəri 70₼ ödəyib (odenilmis=70, qalig=30). 100₼-lıq mal qaytarılır (total=100). apply=min(100,30)=30 → odenilmis 100, status tamamlandi. Qalan 70₼ üçün nə refund nə avans yaranır.
- **Gözlənilən:** total > qalig olduqda fərq (total−qalig) kassa refund və ya müştəri avansı kimi qeydə alınmalı.
- **Faktiki:** Yalnız açıq borc bağlanır; müştərinin əvvəl ödədiyi 70₼ üçün heç bir geri-qaytarma/avans qeydə alınmır.
- **Bütövlük/risk:** Müştəriyə borclu qalırıq amma sistemdə iz yoxdur — pul/borc bütövlüyü pozulur.

## [43] 🟡 KİÇİK · Xərc yarat / sil (features/maliyye/actions
**Yaratma finance_operations type_kod='xerc' istifadə edir, lakin P&L/unified xərc sorğuları yalnız 'xercler' sayır — sorğular arası uyğunsuzluq**

- **Yer:** `features/maliyye/actions.ts:139-153 və 2212-2226 (kod:'xerc'); features/maliyye/unified-expense-query.ts:83,128 (type_kod='xercler')`
- **Repro:** saveExpense/saveExpenseWithInvoiceLink finance_operation_types.kod='xerc' yaradıb type_kod='xerc' yazır. getUnifiedExpenses/getUnifiedExpenseTotal yalnız type_kod='xercler' filtrləyir, ona görə bu finance_op-lar P&L unified xərc cəminə düşmür (yalnız xercl_r budağı sayır). Eyni xərc üçün saveQuickOperation isə type_kod='xercler' yaradır (L498) — beləliklə sistemdə iki ayrı xərc tipi (xerc vs xercler) mövcuddur.
- **Gözlənilən:** Bütün xərc finance_operations vahid type_kod (məs. 'xercler') istifadə etməli ki, unified sorğular və hesabatlar ardıcıl olsun.
- **Faktiki:** İki fərqli type_kod ('xerc' və 'xercler'). saveExpense ilə yaranan finance_op-lar unified xərc hesabatına düşmür (yaxşı tərəfi: P&L-də ikiqat sayılma yoxdur; pis tərəfi: əməliyyat jurnalı/hesabat fərqli yerlərdə fərqli nəticə verir və silmə tag-ı '[XERC:]' üzrə tapılması daha kövrək olur).

## [44] 🟡 KİÇİK · Maliyyə əməliyyatı yarat / sil / ləğv
**saveQuickOperation: xaric/transfer üçün qaliq yetərlilik (checkAccountSufficient) yoxlaması yoxdur + idempotency açarı yoxdur (double-submit dublikat yaradır)**

- **Yer:** `features/maliyye/actions.ts:426-688 (saveQuickOperation)`
- **Repro:** A) Qaliq yoxlaması: saveExpense (line 134), maas-actions, alis-actions, paySupplier hamısı checkAccountSufficient çağırır; saveQuickOperation xaric/transfer növü üçün heç bir sufficiency yoxlaması etmir → hesab mənfiyə düşə bilər. B) Double-submit: receivePartialPayment idempotency_key dedup-a malikdir (line 1082-1096), saveQuickOperation-da heç bir idempotency/dedup yoxdur — eyni forma iki dəfə submit olunsa iki finance_operations qeydi yaranır.
- **Gözlənilən:** Xaric/transfer üçün checkAccountSufficient çağrılmalı (digər action-larla uyğunluq); double-submit üçün idempotency açarı və ya qısa-pəncərə dedup tətbiq olunmalı.
- **Faktiki:** Quick əməliyyat (transfer/xərc/avans) hesabda kifayət pul olmadan keçə bilir (overdraft); double-click iki eyni əməliyyat yaradır (balans source-of-truth-dan toplandığı üçün hər ikisi sayılır → pul iki dəfə xaric).
- **Bütövlük/risk:** Hesab balansı mənfiyə düşə bilər; double-submit nəticəsində eyni xərc/transfer ikiqat balansdan çıxa bilər.

## [45] 🟡 KİÇİK · Tapşırıq AXIN auditi
**changeTaskStatus status keçidlərini yoxlamır — tamamlanmış/ləğv olunmuş tapşırıq sərbəst 'yeni'/'icrada'-ya qaytarıla bilir, tamamlandi_de qalıq olaraq qalır**

- **Yer:** `features/tapshiriqlar/actions.ts:388-392 (patch yığımı), 357-453`
- **Repro:** 1) Tapşırıq 'tamamlandi' olur → tamamlandi_de set. 2) changeTaskStatus(taskId, 'icrada') çağırılır (icazə var). 3) patch yalnız status='icrada', baslandi_de=now təyin edir; tamamlandi_de SIFIRLANMIR, köhnə tamamlanma tarixi qalır. 4) Eyni cür 'legv'→'yeni' də heç bir məhdudiyyət olmadan keçir.
- **Gözlənilən:** Açıq status-maşını: tamamlandi/legv kimi terminal statusdan geri açılışda tamamlandi_de NULL-a qaytarılmalı (və/və ya yenidən-açma ayrıca icazə/audit ilə); ən azı tamamlandi_de təmizlənməli ki, hesabat/KPI uyğunsuz qalmasın.
- **Faktiki:** Status sərbəst geri qaytarılır, lakin tamamlandi_de köhnə dəyəri saxlayır → 'icradadır' statusda olan tapşırıqda tamamlanma tarixi var.
- **Bütövlük/risk:** KPI/hesabat: tamamlandi_de-yə əsaslanan analitika (stats-queries, kpi-actions) yanıltıcı — açıq tapşırıq tamamlanmış kimi tarixə düşür.

## [46] 🟡 KİÇİK · Tapşırıq AXIN auditi
**Schema CreateTaskSchema-da tip üçün .default('adi') boş string ilə işləmir (amma create-də ?? 'adi' var); escalation_to/kime_id tenant-da yoxlanmır**

- **Yer:** `features/tapshiriqlar/actions.ts:104 (tip optional.or(literal('')) — default heç vaxt tətbiq olunmur), 117 escalation_to, 209 yazma; setTaskReminder 579 kime_id, 607/636/646 istifadə`
- **Repro:** escalation_to: forma boş gəlsə '' olur, create-də `escalationEnabled && d.escalation_to ? ... : null` ilə null-a düşür (ok). LAKİN escalation_to=B (yad tenant UUID) verilsə, tenant yoxlaması olmadan birbaşa yazılır → overdue cron-da bildirisler.create(istifadeci_id=B) yad tenant istifadəçisinə bildiriş göndərir. Eyni problem setTaskReminder kime_id üçün: kime_id ixtiyari UUID ola bilər, tapshiriq_xatirlatmalar.istifadeci_id və bildirisler.istifadeci_id-yə tenant yoxlanmadan yazılır.
- **Gözlənilən:** escalation_to və kime_id da mesul_id/icracilar kimi cari sahibkar_id istifadəçilərinə qarşı yoxlanmalı; tip üçün ya .or(literal('')) silinib default işləməli, ya da hazırkı ?? 'adi' saxlanmalı (funksional olaraq ok, amma schema default yanıltıcıdır).
- **Faktiki:** escalation_to/kime_id tenant yoxlamasız yazılır (#1 ilə eyni cross-tenant bildiriş vektoru); tip schema default-u effektsizdir.
- **Bütövlük/risk:** Yenə cross-tenant bildiriş riski (escalation rəhbəri / xatırlatma hədəfi yad tenant ola bilər).

## [47] 🟡 KİÇİK · Alış sifarişi yarat / qəbul / sil
**Bütün sətir qiymətləri 0 olarkən əlavə xərclər (gömrük/çatdırılma) heç bir sətrin mayasına paylanmır — itir, amma umumi_mebleg-ə daxil olur**

- **Yer:** `features/ticaret/alis-actions.ts:61-63, 110-111`
- **Repro:** 1) createPurchase: lines hamısı qiymet=0 (LineSchema qiymet min(0) icazə verir), gomruk=100. 2) subtotal = 0. 3) paylananXerc = subtotal>0 ? ... : 0 → 0. 4) realMayaEded = 0 + 0/miqdar = 0 → stoka maya 0 yazılır. 5) umumi = subtotal + elaveXerc = 100 → təchizatçı borcu 100 yaranır, amma heç bir məhsulun mayasına 100 düşmür.
- **Gözlənilən:** Əlavə xərc subtotal=0 olarkən ya bərabər (miqdara görə) paylanmalı, ya da bu hal qadağan edilməli.
- **Faktiki:** subtotal=0 halında bütün əlavə xərc COGS/inventardan kənarda qalır; borc isə həmin məbləği əhatə edir → inventar dəyəri ilə borc arasında uyğunsuzluq.
- **Bütövlük/risk:** COGS/inventar dəyəri əskik qiymətləndirilir (maya 0), borc isə xərci əhatə edir — marja hesabatı şişir.

---
## Sağlam görünən hissələr (audit qeydləri)

- **İşçi yarat / redaktə / sil (deaktiv):** Sağlam görünən hissələr: (1) Tenant guard tam işləyir — lib/db/prisma.ts $extends findUnique/update/delete where-ə sahibkar_id inject edir; Prisma 6.19.3 filtered-findUnique dəstəklədiyindən cross-tenant findUnique null qaytarır, cross-tenant update P2025 verir. (2) İcazə guard hər iki yazma action-da backend-də var (requireHrActionPerm). (3) Özünü deaktiv bloku düzgün (id===istifadeciId). (4) Ema
- **Müştəri yarat/sil:** Sağlam görünən hissələr: (1) Tenant guard — kontragentler tenant-models.ts:101-dədir; prisma $extends (lib/db/prisma.ts) findUnique/update/updateMany-ə where.sahibkar_id inject edir, create-də data.sahibkar_id qoyur, upsert-də tenant dəyişdirməyi qadağan edir → cross-tenant deaktivasiya/oxu bloklanır. (2) İcazə guard backend-də hər action-da var (requireElaqeActionPerm: saveContact nov-a görə must
- **İstifadəçi yarat/sil + rol təyini + ROL İCAZƏ effe:** SAĞLAM GÖRÜNƏN HİSSƏLƏR:
- ROL İCAZƏ effektivliyi (əsas sual): saveRolePerms → revalidateTag(`role-perms:${rolId}`,"max") + icazələrin JWT-də SAXLANMAMASI (auth.ts 168-170) sayəsində rola icazə ver/sil DƏRHAL təsir edir, JWT cache-də QALMIR. Bu düzgün dizayndır.
- Tenant guard: bütün action-lar withTenant + requireTenant; rol/istifadəçi əməliyyatları findFirst({sahibkar_id}) ilə tenant-a bağlanıb;
- **Müştəriyə satış:** SAĞLAM görünən hissələr:
- Stok azalması ATOMİKDİR: hər iki axın safeStockDecrement (UPDATE stok SET miqdar=miqdar-x WHERE miqdar-bron>=x) istifadə edir; 0 sətir → xəta, mənfi/oversell bloklanır. POS əlavə olaraq FOR UPDATE lock də edir. Bron exclude (excludeSatisId) qaralama→finalize axınında düz işləyir.
- POS double-submit QORUNUR: client_op_id find + DB partial unique index `satis_client_op_un
- **Qaytarma:** SAĞLAM görünən hissələr: (1) acceptReturn-da FOR UPDATE lock (actions.ts:160-162) double-click/iki-tab paralel qəbulu bloklayır — stok ikiqat artmaz. (2) Stok geri-əlavə düzgün anbara gedir: returnFullSale orijinal mexaric hərəkətlərindən mehsul→anbar xəritəsi qurur (qaytarma-tez-actions.ts:422-436, çox-anbarlı satış üçün doğru). (3) Refund məbləği DÜZGÜN mənfi yazılır: kassa_emeliyyatlari.mebleg 
- **Ödəniş:** Sağlam görünən hissələr: recordSalePayment over-pay+lock+kredit-bloku+default kassa+finance recalc tam düzgündür; icazə guard-ları hər iki action-da backend-də var (recordContactPayment-də əvvəlki 'musteri.duzelt' səhvi 'odenis.qebul'-a düzəldilmiş — sətir 368-371); tenant inject withTenant ilə; balanslar manual increment əvəzinə source-of-truth recalculate* funksiyaları ilə hesablanır (customer/s
- **Xərc yarat / sil (features/maliyye/actions:** Yoxlanan və SAĞLAM görünən hissələr: (1) Tenant guard — bütün oxu/yazma sahibkar_id ilə (findFirst/updateMany where sahibkar_id), withTenant+requireTenant düzgün. (2) İcazə guard backend-də var: saveExpense requireMaliyyeActionPerm(yarat/idare), deleteExpense xerc.idare, createExpenseCategory çoxlu icazə. (3) Soft-delete düzgün tətbiq olunub (legv_de + legv_sebeb + legv_eden_id), hard-delete yoxdu
- **Maliyyə əməliyyatı yarat / sil / ləğv:** SAĞLAM görünən hissələr: (1) cancelFinanceOperation (cancel-operation-action.ts) yaxşı qurulub — FOR UPDATE lock ilə paralel/ikiqat ləğv qarşısı (line 53-55), status='legv'||deleted_at idempotency guard (line 78-80), allocation silmə + satis/alis odenilmis decrement, avans reversal ([AVANS] vs adi ödəniş halları ayrı), hesab + kontragent recalc — hamısı tək $transaction içində atomik. (2) Tenant g
- **Tapşırıq AXIN auditi:** Sağlam görünən hissələr: (1) İcazə guard backend-də real var — requireTapshiriqPerm('tapshiriq.yarat'/'tapshiriq.atayir'), assertTaskAccess (yaradan/mesul/icraci/admin) hər mutation-da çağırılır, dismiss/snooze yalnız mesul/icraci-yə icazə verir. (2) Tenant guard ($extends sahibkar_id inject) tapshiriqlar/bildirisler/tapshiriq_obyektleri/checklist/kommentleri üçün işləyir. (3) createTask və create
- **Alış sifarişi yarat / qəbul / sil:** Yoxlanan və SAĞLAM görünən hissələr: (1) Tenant guard — lib/db/prisma.ts $extends READ/WRITE əməliyyatlarına sahibkar_id inject edir, findUnique-a da (Prisma müasir versiyada non-unique əlavə filtrlərə icazə verir), $transaction tx client extended client-dir → receivePurchase/cancelPurchase findUnique-ları tenant-safe. (2) Double-receive qoruması — receivePurchase-da `SELECT ... FOR UPDATE` + stat