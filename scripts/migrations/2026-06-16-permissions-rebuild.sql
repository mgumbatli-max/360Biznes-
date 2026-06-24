-- ============================================================================
-- 2026-06-16: İCAZƏ SXEM KÖÇÜRMƏSİNİ TAMAMLAYAN REBUILD (auto-generated)
-- Sınıq migrasiyalar (rollar/r.kod + DB-də olmayan rollar) atomik fail olmuşdu.
-- Bu fayl: yeni kodları kataloqa əlavə + grant-ları real rollara (sistem+klon)
-- tətbiq + qalan app kodlarını (alias/servis) seed edir. İdempotent.
-- ============================================================================
BEGIN;

-- ─── menbe: 2026-06-01-anbar-permissions.sql ───
-- ============================================================================
-- M: Anbar modulu icazələri — məhsul, stok, satınalma, sayım, qiymət
-- ============================================================================
-- Anbar modulunun 16 alt-bölməsi var. Hər biri üçün ayrı icazə.
-- Anbardar adi əməliyyatlar edə bilir, menecer + alış / sayım, sahibkar hər şey.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('anbar.oxu',           'Anbar səhifəsi',           'Anbar', 'Master icazə — /anbar səhifəsinə giriş'),
  ('mehsul.oxu',          'Məhsul siyahısı',          'Anbar', 'Məhsul kataloqu görmək'),
  ('mehsul.yarat',        'Məhsul yarat',             'Anbar', 'Yeni məhsul əlavə (ProductWizard)'),
  ('mehsul.duzelt',       'Məhsul redaktə',           'Anbar', 'Mövcud məhsulu dəyişmək'),
  ('mehsul.sil',          'Məhsul sil/arxivlə',       'Anbar', 'Məhsulu silmək və ya arxivləmək'),
  ('mehsul.yukle',        'Excel ilə yüklə',          'Anbar', '/anbar/mehsul-yukle — toplu import'),
  ('stok.oxu',            'Stok cədvəli',             'Anbar', '/anbar/stok — hansı anbarda nə qədər var'),
  ('stok.duzelis',        'Stok düzəliş',             'Anbar', 'Manual stok artırmaq/azaltmaq'),
  ('stok.transfer',       'Anbarlar arası transfer',  'Anbar', '/anbar/transfer — mal hərəkəti'),
  ('stok.bron',           'Stok bron',                'Anbar', '/anbar/bron — müştəri rezervi'),
  ('satinalma.oxu',       'Satınalma',                'Anbar', '/anbar/satinalma — alış sənədləri'),
  ('satinalma.yarat',     'Alış sənədi yarat',        'Anbar', 'Təchizatçıdan yeni alış'),
  ('sayim.oxu',           'Sayım',                    'Anbar', '/anbar/inventar — sayım sənədləri'),
  ('sayim.yarat',         'Yeni sayım',               'Anbar', 'Sayım başlatmaq'),
  ('qiymet.oxu',          'Qiymət siyahısı',          'Anbar', '/anbar/qiymet — qiymət siyahıları'),
  ('qiymet.duzelt',       'Qiymət dəyiş',             'Anbar', 'Bulk qiymət yeniləməsi'),
  ('kateqoriya.idare',    'Kateqoriya/marka',         'Anbar', '/anbar/kateqoriyalar + /anbar/markalar redaktə'),
  ('konsiqnasiya.oxu',    'Konsiqnasiya',             'Anbar', '/anbar/konsiqnasiya — komissiya satışı'),
  ('anbar.hesabat',       'Hesabatlar',               'Anbar', '/anbar/hesabat + /anbar/hereketler analitika'),
  ('anbar.anomali',       'Anomaliya aşkarı',         'Anbar', '/anbar/anomali — AI əsaslı anomaliya')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND (i.kod = 'anbar.oxu' OR i.kod LIKE 'mehsul.%' OR i.kod LIKE 'stok.%'
        OR i.kod LIKE 'satinalma.%' OR i.kod LIKE 'sayim.%' OR i.kod LIKE 'qiymet.%'
        OR i.kod IN ('kateqoriya.idare', 'konsiqnasiya.oxu', 'anbar.hesabat', 'anbar.anomali'))
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer → satinalma və qiymət daxil, hesabat
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'manecer'
   AND i.kod IN (
     'anbar.oxu', 'mehsul.oxu', 'mehsul.yarat', 'mehsul.duzelt',
     'stok.oxu', 'stok.duzelis', 'stok.transfer', 'stok.bron',
     'satinalma.oxu', 'satinalma.yarat',
     'sayim.oxu', 'sayim.yarat',
     'qiymet.oxu', 'qiymet.duzelt',
     'kateqoriya.idare', 'konsiqnasiya.oxu', 'anbar.hesabat'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Anbardar → əsas əməliyyatlar (məhsul, stok, sayım, transfer, bron)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'anbardar'
   AND i.kod IN (
     'anbar.oxu', 'mehsul.oxu', 'mehsul.yarat', 'mehsul.duzelt', 'mehsul.yukle',
     'stok.oxu', 'stok.duzelis', 'stok.transfer', 'stok.bron',
     'satinalma.oxu', 'sayim.oxu', 'sayim.yarat',
     'qiymet.oxu', 'kateqoriya.idare'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Kassir / satıcı → yalnız oxu (məhsul axtarışı POS-da işləsin deyə)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('kassir', 'satici')
   AND i.kod IN ('anbar.oxu', 'mehsul.oxu', 'stok.oxu', 'qiymet.oxu')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib → hesabat + qiymət + satınalma (gör)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'muhasib'
   AND i.kod IN (
     'anbar.oxu', 'mehsul.oxu', 'stok.oxu', 'satinalma.oxu',
     'qiymet.oxu', 'anbar.hesabat'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── menbe: 2026-06-01-dashboard-permissions.sql ───
-- ============================================================================
-- M: Dashboard icazələri — bölmə-bölmə görünmə nəzarəti
-- ============================================================================
-- Dashboard indi rol əsaslı təşkil olunur. `dashboard.oxu` master keçiddir
-- (yoxdursa səhifə özü açılmır). Hər bölmənin öz icazəsi var; sahibkar rol
-- detalı səhifəsində hansı rolun nəyi görəcəyini bütöv-incə seçə bilir.
--
-- Bütün dashboard.* icazələri "Dashboard" qrupundadır — rol matrisi onları
-- avtomatik tək bölmədə göstərir.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('dashboard.oxu',       'Dashboard-u aç',          'Dashboard', 'Master icazə — /dashboard səhifəsinə girişə icazə'),
  ('dashboard.kpi',       'KPI kartları',            'Dashboard', 'Aylıq gəlir/xərc/mənfəət big-card və 3 KPI sətri'),
  ('dashboard.cashflow',  'Bu gün pul axını',        'Dashboard', 'Mədaxil/məxaric/net kartı və proporsional barlar'),
  ('dashboard.tapshiriq', 'Mənim işim kartı',        'Dashboard', 'Açıq tapşırıqlar, xatırlatma, gecikmiş + effektivlik ringi'),
  ('dashboard.aktivlik',  'Son satış və hadisələr',  'Dashboard', 'Son 5 satış cədvəli + canlı audit feed'),
  ('dashboard.stok',      'Aşağı stok paneli',       'Dashboard', 'Kritik səviyyəyə yaxınlaşan məhsullar siyahısı'),
  ('dashboard.top5',      'Top 5 reytinqlər',        'Dashboard', 'Top məhsul/satıcı/alıcı/platforma kartları'),
  ('dashboard.alerts',    'Diqqət lazımdır',         'Dashboard', 'Kritik xəbərdarlıqlar banneri'),
  ('dashboard.sync',      'Marketplace sync',         'Dashboard', 'Inbound/Outbound/Webhook/Retry sağlamlıq kartı'),
  ('dashboard.feed',      'Biznes fəaliyyət feedi',  'Dashboard', 'Aşağıdakı geniş aktivlik widget-i'),
  ('dashboard.charts',    'Qrafiklər',               'Dashboard', '30 günlük satış qrafiki + satış vs xərc müqayisəsi'),
  ('dashboard.insight',   'Günün analitikası',       'Dashboard', 'Ən üstdəki rəngli analitik mesaj')
ON CONFLICT (kod) DO NOTHING;

-- Avtomatik təyinatlar — sahibkar (9), admin (1), direktor (11) hamısını görsün
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
FROM roles r
CROSS JOIN icazeler i
WHERE r.id IN (1, 9, 11)
  AND i.kod LIKE 'dashboard.%'
ON CONFLICT DO NOTHING;

-- Müşahidəçi/menecer/muhasib — yumşaq paket (analitika+öz iş)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
FROM roles r
CROSS JOIN icazeler i
WHERE r.id IN (2, 10, 12)
  AND i.kod IN (
    'dashboard.oxu',
    'dashboard.kpi',
    'dashboard.cashflow',
    'dashboard.tapshiriq',
    'dashboard.aktivlik',
    'dashboard.alerts',
    'dashboard.charts',
    'dashboard.insight'
  )
ON CONFLICT DO NOTHING;

-- Satıcı/kassir — minimum paket (öz işi + günün xülasəsi)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
FROM roles r
CROSS JOIN icazeler i
WHERE r.id IN (3, 13)
  AND i.kod IN (
    'dashboard.oxu',
    'dashboard.tapshiriq',
    'dashboard.aktivlik',
    'dashboard.insight'
  )
ON CONFLICT DO NOTHING;

-- Anbardar — anbar fokuslu
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
FROM roles r
CROSS JOIN icazeler i
WHERE r.id IN (4)
  AND i.kod IN (
    'dashboard.oxu',
    'dashboard.tapshiriq',
    'dashboard.stok',
    'dashboard.alerts',
    'dashboard.insight'
  )
ON CONFLICT DO NOTHING;

-- Servisçi/SMM/kuryer — yalnız master + öz işi
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
FROM roles r
CROSS JOIN icazeler i
WHERE r.id IN (14, 15, 16)
  AND i.kod IN (
    'dashboard.oxu',
    'dashboard.tapshiriq',
    'dashboard.insight'
  )
ON CONFLICT DO NOTHING;

-- ─── menbe: 2026-06-01-elaqe-permissions.sql ───
-- ============================================================================
-- M: Elaqə (CRM) modulu icazələri — müştəri, təchizatçı, borc, followup
-- ============================================================================
-- Rol əsaslı paylaşma:
--   Sahibkar/admin → hamısı
--   Mühasib       → bütün oxu + borc
--   Menecer       → müştəri/təchizatçı CRUD + borc + followup
--   Satıcı        → müştəri oxu/yarat/duzelt + followup
--   Kassir        → müştəri oxu/yarat (POS-da müştəri əlavə)
--   Anbardar      → təchizatçı oxu/yarat
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('elaqe.oxu',          'Elaqə səhifəsi',       'Elaqə', 'Master icazə — /elaqe səhifəsinə giriş'),
  ('musteri.oxu',        'Müştərilər',           'Elaqə', '/elaqe/musteriler — müştəri kataloqu'),
  ('musteri.yarat',      'Müştəri yarat',        'Elaqə', 'Yeni müştəri əlavə et'),
  ('musteri.duzelt',     'Müştəri redaktə',      'Elaqə', 'Müştəri kartı dəyişmək (telefon, borc limiti)'),
  ('musteri.sil',        'Müştəri sil/arxivlə',  'Elaqə', 'Müştərini sil və ya arxivlə'),
  ('musteri.gizli',      'Müştəri həssas info',  'Elaqə', 'Telefon/email/ünvan görmək (gizli mod ləğv)'),
  ('techizatci.oxu',     'Təchizatçılar',        'Elaqə', '/elaqe/techizatcilar — təchizatçı kataloqu'),
  ('techizatci.yarat',   'Təchizatçı yarat',     'Elaqə', 'Yeni təchizatçı əlavə et'),
  ('techizatci.duzelt',  'Təchizatçı redaktə',   'Elaqə', 'Təchizatçı kartı dəyişmək'),
  ('elaqe.borc',         'Borc analizi',         'Elaqə', '/elaqe/borclar — borclu müştəri/təchizatçı + bulk xatırlatma'),
  ('elaqe.followup',     'CRM follow-up',        'Elaqə', '/elaqe/followup — müştəri ilə əlaqə izi'),
  ('elaqe.inaktiv',      'İnaktiv analiz',       'Elaqə', '/elaqe/inaktiv — uzun müddət alış etməyən'),
  ('elaqe.dublikat',     'Dublikat aşkarı',      'Elaqə', '/elaqe/dublikat — eyni müştəri/təchizatçı təkrar'),
  ('elaqe.hesabat',      'CRM hesabatları',      'Elaqə', '/elaqe/hesabat — RFM, tier paylanışı'),
  ('elaqe.bulk_mesaj',   'Bulk SMS/Telegram',    'Elaqə', 'Müştərilərə kütləvi mesaj göndərmək')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND (i.kod = 'elaqe.oxu' OR i.kod LIKE 'musteri.%' OR i.kod LIKE 'techizatci.%' OR i.kod LIKE 'elaqe.%')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib → oxu + borc
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'muhasib'
   AND i.kod IN (
     'elaqe.oxu', 'musteri.oxu', 'techizatci.oxu',
     'elaqe.borc', 'elaqe.inaktiv', 'elaqe.hesabat'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer → tam CRUD + analiz + bulk mesaj
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'manecer'
   AND i.kod IN (
     'elaqe.oxu',
     'musteri.oxu', 'musteri.yarat', 'musteri.duzelt', 'musteri.gizli',
     'techizatci.oxu', 'techizatci.yarat', 'techizatci.duzelt',
     'elaqe.borc', 'elaqe.followup', 'elaqe.inaktiv', 'elaqe.dublikat',
     'elaqe.hesabat', 'elaqe.bulk_mesaj'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Satıcı → müştəri tam + followup (öz müştəriləri)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'satici'
   AND i.kod IN (
     'elaqe.oxu', 'musteri.oxu', 'musteri.yarat', 'musteri.duzelt',
     'elaqe.followup'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Kassir → müştəri oxu/yarat (POS-da müştəri əlavə)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'kassir'
   AND i.kod IN ('elaqe.oxu', 'musteri.oxu', 'musteri.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Anbardar → təchizatçı oxu/yarat (alış zamanı təchizatçı əlavə)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'anbardar'
   AND i.kod IN ('elaqe.oxu', 'techizatci.oxu', 'techizatci.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── menbe: 2026-06-01-maliyye-permissions.sql ───
-- ============================================================================
-- M: Maliyyə modulu icazələri — kassa, bank, xərc, ödəniş, gün sonu, hesabat
-- ============================================================================
-- Maliyyə ən həssas moduldur. Pul axını və hesabat görmək rol əsaslı:
--   Sahibkar/admin → hamısı
--   Mühasib       → hamısı oxu + xərc / ödəniş yarat / gün sonu
--   Menecer       → kassa/bank oxu + xərc/ödəniş yarat + hesabat
--   Kassir        → kassa oxu (öz sessiyası) + ödəniş qəbul
--   Anbardar      → görmür
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('maliyye.oxu',         'Maliyyə səhifəsi',     'Maliyyə', 'Master icazə — /maliyye səhifəsinə giriş'),
  ('kassa.oxu',           'Kassalar',             'Maliyyə', '/maliyye/kassalar — kassa qalıqları'),
  ('kassa.emeliyyat',     'Kassa idarə',          'Maliyyə', 'Yeni kassa yarat / sil / qalıq düzəliş'),
  ('bank.oxu',            'Bank hesabları',       'Maliyyə', '/maliyye/bank — bank hesabları və əməliyyatları'),
  ('bank.emeliyyat',      'Bank idarə',           'Maliyyə', 'Bank hesabı əlavə / sil / sinxron'),
  ('xerc.oxu',            'Xərclər',              'Maliyyə', '/maliyye/xercler — xərc tarixçəsi'),
  ('xerc.yarat',          'Yeni xərc',            'Maliyyə', 'Xərc əlavə et'),
  ('xerc.idare',          'Xərc idarə',           'Maliyyə', 'Xərc redaktə / sil'),
  ('odenis.qebul',        'Ödəniş qəbul',         'Maliyyə', 'Müştəri borcuna qarşı ödəniş qəbul et'),
  ('odenis.yarat',        'Yeni ödəniş',          'Maliyyə', 'Manual ödəniş (təchizatçı/işçi)'),
  ('debitor.oxu',         'Debitor (alacaq)',     'Maliyyə', '/maliyye/debitor — müştəri borc analizi'),
  ('kreditor.oxu',        'Kreditor (borc)',      'Maliyyə', '/maliyye/kreditor — təchizatçı borc analizi'),
  ('maliyye.gun_sonu',    'Gün sonu',             'Maliyyə', '/maliyye/gun-sonu — yığma və kassa bağlanış'),
  ('maliyye.hesabat',     'Maliyyə hesabatları',  'Maliyyə', 'P/L, balans, pul axını, hesabat'),
  ('edv.idare',           'ƏDV / vergilər',       'Maliyyə', '/maliyye/edv + /yol-vergisi'),
  ('maliyye.recurring',   'Təkrarlanan ödəniş',   'Maliyyə', '/maliyye/recurring — kirayə, abunə')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND (i.kod = 'maliyye.oxu' OR i.kod LIKE 'kassa.%' OR i.kod LIKE 'bank.%'
        OR i.kod LIKE 'xerc.%' OR i.kod LIKE 'odenis.%' OR i.kod LIKE 'maliyye.%'
        OR i.kod IN ('debitor.oxu', 'kreditor.oxu', 'edv.idare'))
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib → hamısı (bank.emeliyyat və kassa.emeliyyat istisna - sahibkar tələb edir)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'muhasib'
   AND i.kod IN (
     'maliyye.oxu', 'kassa.oxu', 'bank.oxu',
     'xerc.oxu', 'xerc.yarat', 'xerc.idare',
     'odenis.qebul', 'odenis.yarat',
     'debitor.oxu', 'kreditor.oxu',
     'maliyye.gun_sonu', 'maliyye.hesabat', 'edv.idare',
     'maliyye.recurring'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer → kassa/bank oxu + xərc/ödəniş yarat + hesabat
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'manecer'
   AND i.kod IN (
     'maliyye.oxu', 'kassa.oxu', 'bank.oxu',
     'xerc.oxu', 'xerc.yarat',
     'odenis.qebul', 'odenis.yarat',
     'debitor.oxu', 'kreditor.oxu',
     'maliyye.hesabat'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Kassir → kassa oxu + ödəniş qəbul (POS-da işləsin deyə)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'kassir'
   AND i.kod IN ('maliyye.oxu', 'kassa.oxu', 'odenis.qebul')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── menbe: 2026-06-01-nezaret-permissions.sql ───
-- ============================================================================
-- M: Nəzarət Mərkəzi icazələri — risk dashboard, log, ayarlar nəzarəti
-- ============================================================================
-- Nəzarət Mərkəzi həssas modul — bütün biznesin risk/audit məlumatını göstərir.
-- Default-da yalnız sahibkar/admin/direktor görür.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('nezaret.oxu',       'Nəzarət mərkəzini aç',  'Nəzarət Mərkəzi', 'Master icazə — /nezaret-merkezi səhifəsinə girişə icazə'),
  ('nezaret.dashboard', 'Risk dashboard',        'Nəzarət Mərkəzi', 'Aktiv xəbərdarlıq, təsdiq, stok riski, borc, davamiyyət göstəriciləri'),
  ('nezaret.loglar',    'Audit log',             'Nəzarət Mərkəzi', 'Xəbərdarlıq + təsdiq + system event birləşdirilmiş tarixçə'),
  ('nezaret.ayarlar',   'Ayarları dəyiş',        'Nəzarət Mərkəzi', 'Avtomat qaydalar, eskalasiya, default davranış konfiqurasiyası')
ON CONFLICT (kod) DO NOTHING;

-- Default: sahibkar / admin / direktor rolesına bütün nezaret icazələri
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND i.kod LIKE 'nezaret.%'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib və menecer rolesına yalnız oxu (dashboard + log)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('muhasib', 'manecer')
   AND i.kod IN ('nezaret.oxu', 'nezaret.dashboard', 'nezaret.loglar')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── menbe: 2026-06-01-pos-permissions.sql ───
-- ============================================================================
-- M: POS / Kassa icazələri — kassir əməliyyatları üzərində nəzarət
-- ============================================================================
-- POS-da iki növ icazə var:
--   1. Aktiv icazə (pos.satis, pos.access, pos.session_*) — əməliyyat icazəsi
--   2. Görünüş/qiymət icazələri (pos.view_*, pos.change_price, pos.discount)
--
-- Bütün pos.* icazələri "POS / Kassa" qrupundadır — rol matrisi onları
-- avtomatik tək bölmədə göstərir.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('pos.access',              'POS-u aç',                    'POS / Kassa', 'Master icazə — /pos səhifəsinə girişə icazə verir'),
  ('pos.satis',               'Satış et',                    'POS / Kassa', 'Satışı təsdiqləyə bilir — createSale server action-a giriş'),
  ('pos.session_open',        'Kassa sessiya aç',            'POS / Kassa', 'Yeni kassa sessiyası başlada bilər'),
  ('pos.session_close',       'Kassa sessiya bağla',         'POS / Kassa', 'Sessiya bağlayıb gün sonu hesablaya bilər'),
  ('pos.change_price',        'Qiymət dəyişdir',             'POS / Kassa', 'POS-da məhsul qiymətini əl ilə dəyişə bilər'),
  ('pos.sell_below_min_price','Min qiymətdən aşağı sat',     'POS / Kassa', 'Minimum satış qiymətindən aşağı sata bilər'),
  ('pos.discount',            'Endirim et',                  'POS / Kassa', 'Səbət / sətir endirim sahələrini istifadə edə bilər'),
  ('pos.view_cost',           'Maya qiyməti gör',            'POS / Kassa', 'POS-da məhsul kartında alış qiymətini görə bilər'),
  ('pos.view_margin',         'Marja gör',                   'POS / Kassa', 'POS-da real-time mənfəət marjasını görə bilər'),
  ('pos.view_min_price',      'Min qiymət gör',              'POS / Kassa', 'POS-da məhsul kartında min satış qiymətini görə bilər'),
  ('pos.print_receipt',       'Çek çap et',                  'POS / Kassa', 'Satışdan sonra POS çek çapı edə bilər'),
  ('pos.print_warranty',      'Zəmanət çap et',              'POS / Kassa', 'Zəmanət sənədi çapı edə bilər'),
  ('pos.credit_sell',         'Nisyə satış',                 'POS / Kassa', 'Müştəri borca / nisyəyə sata bilər')
ON CONFLICT (kod) DO NOTHING;

-- Avtomatik təyinatlar — sahibkar (9), admin (1), direktor (11) hamısını görsün
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND i.kod LIKE 'pos.%'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Kassir rolu üçün əsas POS icazələri (görünüş icazələri istisna olmaqla)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('kassir', 'satici')
   AND i.kod IN (
     'pos.access', 'pos.satis', 'pos.session_open',
     'pos.discount', 'pos.print_receipt', 'pos.credit_sell'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── menbe: 2026-06-01-tapshiriq-permissions.sql ───
-- ============================================================================
-- M: Tapşırıqlar modulu icazələri — rol-əsaslı tapşırıq idarəsi
-- ============================================================================
-- Default: hər kəs öz tapşırıqlarını görür (tapshiriq.oxu), amma yaratmaq /
-- başqasına atamak / silmək kimi əməliyyatlar rol əsaslıdır.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('tapshiriq.oxu',        'Tapşırıqlar səhifəsi',     'Tapşırıqlar', 'Master icazə — /tapshiriqlar səhifəsinə girişə icazə'),
  ('tapshiriq.yarat',      'Tapşırıq yarat',           'Tapşırıqlar', 'Yeni tapşırıq yarada bilmək (özünə də olar)'),
  ('tapshiriq.atayir',     'Başqasına atayar',         'Tapşırıqlar', 'Tapşırıq başqa əməkdaşa təyin edə bilmək'),
  ('tapshiriq.layihe',     'Layihə görünüşü',          'Tapşırıqlar', '/tapshiriqlar/layihe — tapşırıqları layihə üzrə qruplama'),
  ('tapshiriq.statistika', 'Komanda statistikası',     'Tapşırıqlar', '/tapshiriqlar/statistika — bütün komandanın performansı'),
  ('tapshiriq.ai_analiz',  'AI analiz',                'Tapşırıqlar', '/tapshiriqlar/ai-analiz — süni intellekt analitikası'),
  ('tapshiriq.sablon',     'Şablon idarəsi',           'Tapşırıqlar', '/tapshiriqlar/sablonlar — şablon yaratmaq / dəyişmək / silmək'),
  ('tapshiriq.silsin',     'Tapşırıq sil',             'Tapşırıqlar', 'Tapşırığı tam DB-dən silmək (ləğv etmək deyil)')
ON CONFLICT (kod) DO NOTHING;

-- Default: sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND i.kod LIKE 'tapshiriq.%'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer: yarat, atayar, layihə, statistika
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'manecer'
   AND i.kod IN ('tapshiriq.oxu', 'tapshiriq.yarat', 'tapshiriq.atayir', 'tapshiriq.layihe', 'tapshiriq.statistika')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Adi əməkdaş / kassir / satıcı: yalnız oxu + öz tapşırığı üçün yarat
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('kassir', 'satici', 'emekdas', 'anbardar')
   AND i.kod IN ('tapshiriq.oxu', 'tapshiriq.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── menbe: 2026-06-01-ticaret-permissions.sql ───
-- ============================================================================
-- M: Ticarət modulu icazələri — satış, alış, qaytarma, təklif, taksit
-- ============================================================================
-- 11 alt-bölmə + servis əməliyyatları. Rol əsaslı paylaşma:
--   Sahibkar/admin → hamısı
--   Menecer       → satış/alış/qaytarma/təklif/pipeline + market
--   Satıcı        → satış yarat/oxu + təklif + pipeline (öz lead-ləri)
--   Kassir        → satış oxu (POS-da yaradır, formal sənəd yox)
--   Mühasib       → oxu hər şeyə
--   Anbardar      → alış/qaytarma yarat (gələn mal qəbulu)
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('ticaret.oxu',     'Ticarət səhifəsi',     'Ticarət', 'Master icazə — /ticaret səhifəsinə giriş'),
  ('satis.oxu',       'Satışlar',             'Ticarət', '/ticaret/satislar — satış sənədləri'),
  ('satis.yarat',     'Yeni satış',           'Ticarət', '/ticaret/satis-yeni — formal satış'),
  ('satis.duzelt',    'Satış redaktə',        'Ticarət', 'Qaralama / mövcud satışı dəyişmək'),
  ('satis.legv',      'Satış ləğv',           'Ticarət', 'Satış sənədini ləğv etmək'),
  ('alis.oxu',        'Alışlar',              'Ticarət', '/ticaret/alislar — alış sənədləri'),
  ('alis.yarat',      'Yeni alış',            'Ticarət', 'Təchizatçıdan formal alış'),
  ('qaytarma.oxu',    'Qaytarmalar',          'Ticarət', '/ticaret/qaytarma — qaytarma sənədləri'),
  ('qaytarma.yarat',  'Yeni qaytarma',        'Ticarət', 'Müştəri qaytarması yarat'),
  ('teklif.oxu',      'Kommersial təklif',    'Ticarət', '/ticaret/teklif — kommersial təkliflər'),
  ('teklif.yarat',    'Yeni təklif',          'Ticarət', 'Müştəriyə qiymət təklifi'),
  ('pipeline.oxu',    'Satış pipeline',       'Ticarət', '/ticaret/pipeline — lead izi'),
  ('kredit.oxu',      'Taksit / kredit',      'Ticarət', '/ticaret/kredit — taksit izi'),
  ('kredit.yarat',    'Yeni taksit',          'Ticarət', 'Müştəri üçün taksit aç'),
  ('market.oxu',      'Marketplace',          'Ticarət', '/ticaret/market-satis — 3-cü tərəf platforma sifarişləri')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND (i.kod = 'ticaret.oxu' OR i.kod LIKE 'satis.%' OR i.kod LIKE 'alis.%'
        OR i.kod LIKE 'qaytarma.%' OR i.kod LIKE 'teklif.%' OR i.kod LIKE 'kredit.%'
        OR i.kod IN ('pipeline.oxu', 'market.oxu'))
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer → hamısı (sil/legv istisna)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'manecer'
   AND i.kod IN (
     'ticaret.oxu',
     'satis.oxu', 'satis.yarat', 'satis.duzelt',
     'alis.oxu', 'alis.yarat',
     'qaytarma.oxu', 'qaytarma.yarat',
     'teklif.oxu', 'teklif.yarat',
     'pipeline.oxu',
     'kredit.oxu', 'kredit.yarat',
     'market.oxu'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Satıcı → satış + təklif + pipeline
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'satici'
   AND i.kod IN (
     'ticaret.oxu', 'satis.oxu', 'satis.yarat',
     'teklif.oxu', 'teklif.yarat', 'pipeline.oxu', 'qaytarma.oxu'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Kassir → satış oxu (POS əməliyyatları)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'kassir'
   AND i.kod IN ('ticaret.oxu', 'satis.oxu', 'qaytarma.oxu', 'qaytarma.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Anbardar → alış / qaytarma (mal qəbulu)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'anbardar'
   AND i.kod IN ('ticaret.oxu', 'alis.oxu', 'alis.yarat', 'qaytarma.oxu', 'qaytarma.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib → bütün oxu
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'muhasib'
   AND i.kod IN (
     'ticaret.oxu', 'satis.oxu', 'alis.oxu', 'qaytarma.oxu',
     'teklif.oxu', 'pipeline.oxu', 'kredit.oxu', 'market.oxu'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── menbe: 2026-06-02-crm-permissions.sql ───
-- ============================================================================
-- CRM / Mesaj Mərkəzi modulu icazələri
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('crm.oxu',         'CRM oxu',            'CRM',       'Dashboard, inbox, lead siyahısı oxu'),
  ('crm.idare',       'CRM idarə',          'CRM',       'Ümumi CRM idarəetmə (hamı görür)'),
  ('mesaj.cevab',     'Söhbətə cavab',      'CRM',       'İnbox söhbətə cavab göndər'),
  ('mesaj.idare',     'Söhbət idarə',       'CRM',       'Başqasının söhbətini görüntülə/redaktə (admin)'),
  ('lead.yarat',      'Lead yarat',         'CRM',       'Yeni lead əlavə et'),
  ('lead.idare',      'Lead idarə',         'CRM',       'Lead status dəyiş, mərhələ keçidi'),
  ('lead.sil',        'Lead arxiv',         'CRM',       'Lead arxivlə (soft delete)'),
  ('broadcast.idare', 'Broadcast kampaniya','CRM',       'Toplu mesaj kampaniyası yarat/göndər (pul ekvivalentli)'),
  ('sablon.idare',    'Mesaj şablonu',      'CRM',       'Mesaj şablonu yarat/redaktə/sil'),
  ('segment.idare',   'Seqment idarə',      'CRM',       'Müştəri seqmenti yarat/redaktə'),
  ('ai.istifade',     'AI istifadə',        'AI',        'AI cavab təklifi, AI seqment təklifi')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar/admin/direktor — bütün CRM icazələri
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND (i.kod LIKE 'crm.%' OR i.kod LIKE 'mesaj.%' OR i.kod LIKE 'lead.%'
        OR i.kod LIKE 'broadcast.%' OR i.kod LIKE 'sablon.%'
        OR i.kod LIKE 'segment.%' OR i.kod = 'ai.istifade')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Marketing menecer — broadcast/sablon/seqment xaric hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('marketing_menecer', 'marketing')
   AND i.kod IN (
     'crm.oxu', 'crm.idare', 'mesaj.cevab',
     'lead.yarat', 'lead.idare',
     'broadcast.idare', 'sablon.idare', 'segment.idare',
     'ai.istifade'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Satış meneceri — lead/inbox idarə, broadcast yox
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('satis_meneceri', 'manecer', 'team_lead')
   AND i.kod IN (
     'crm.oxu', 'mesaj.cevab',
     'lead.yarat', 'lead.idare',
     'sablon.idare', 'ai.istifade'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Adi satıcı / kassir — yalnız öz lead/söhbəti
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('satici', 'kassir')
   AND i.kod IN ('crm.oxu', 'mesaj.cevab', 'lead.yarat', 'ai.istifade')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── menbe: 2026-06-02-hr-permissions.sql ───
-- ============================================================================
-- HR (Əməkdaşlar) modulu icazələri — payroll, attendance, vacation, discipline
-- ============================================================================
-- HR modulu həssas məlumatları idarə edir: maaş, bank, FİN, davamiyyət, cərimə.
-- Default-da yalnız sahibkar/admin/direktor görür/idarə edir.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('isci.view',         'İşçi siyahısı oxu',  'Əməkdaşlar', 'İşçi siyahısını və əsas məlumatlarını görür (maaş/bank xaric)'),
  ('isci.idare',        'İşçi idarə',         'Əməkdaşlar', 'İşçi yarat, redaktə, deaktivləşdir'),
  ('isci.discipline',   'İntizam əməliyyatı', 'Əməkdaşlar', 'Cərimə, xəbərdarlıq, işdən çıxarma'),
  ('maas.view',         'Maaş oxu',           'Maaş & ödəniş', 'Başqasının maaş, bank, FİN məlumatlarını görür'),
  ('maas.idare',        'Maaş idarə',         'Maaş & ödəniş', 'Payroll hesabla, ödə, bonus/cərimə tətbiq et'),
  ('maas.skala',        'Maaş skalası',       'Maaş & ödəniş', 'Maaş bandlarını/skalasını redaktə'),
  ('davamiyyet.view',   'Davamiyyət oxu',     'Davamiyyət',    'Davamiyyət hesabatını görür'),
  ('davamiyyet.idare',  'Davamiyyət idarə',   'Davamiyyət',    'Başqasının davamiyyətini yaz/redaktə'),
  ('mezuniyyet.istek',  'Məzuniyyət istəyi',  'Məzuniyyət',    'Özü üçün məzuniyyət sorğusu yarat'),
  ('mezuniyyet.tesdiq', 'Məzuniyyət təsdiqi', 'Məzuniyyət',    'Başqasının məzuniyyət sorğusunu təsdiq/rədd'),
  ('vakansiya.idare',   'Vakansiya idarə',    'İşə qəbul',     'Vakansiya yarat/sil, namizədlər'),
  ('treninq.idare',     'Treninq idarə',      'Treninq',       'Treninq şablonları və təyinatı'),
  ('hr.documents',      'Sənəd idarə',        'Sənədlər',      'İşçi sənədləri əlavə/sil'),
  ('hr.budce',          'HR büdcəsi',         'Büdcə',         'HR şöbə büdcə planı'),
  ('hr.bonus_idare',    'KPI/bonus profili',  'KPI',           'Bonus formulu və KPI profilini redaktə (yalnız sahibkar/HR direktor)')
ON CONFLICT (kod) DO NOTHING;

-- Default: sahibkar/admin/direktor bütün HR icazələrinə malikdir
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director', 'hr_direktor')
   AND (i.kod LIKE 'isci.%' OR i.kod LIKE 'maas.%' OR i.kod LIKE 'davamiyyet.%'
        OR i.kod LIKE 'mezuniyyet.%' OR i.kod LIKE 'vakansiya.%' OR i.kod LIKE 'treninq.%'
        OR i.kod LIKE 'hr.%')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- HR menecer / kadrlar rolu — bonus idarə xaric hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('hr_menecer', 'kadrlar', 'hr_uzmani')
   AND i.kod IN (
     'isci.view', 'isci.idare', 'isci.discipline',
     'maas.view', 'maas.idare', 'maas.skala',
     'davamiyyet.view', 'davamiyyet.idare',
     'mezuniyyet.tesdiq',
     'vakansiya.idare', 'treninq.idare', 'hr.documents', 'hr.budce'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer (komanda rəhbəri) — öz komandasını idarə edir, davamiyyət+məzuniyyət təsdiqi
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('manecer', 'team_lead')
   AND i.kod IN (
     'isci.view',
     'davamiyyet.view', 'davamiyyet.idare',
     'mezuniyyet.tesdiq',
     'treninq.idare'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Adi əməkdaş — yalnız öz məzuniyyət sorğusu
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('isci', 'kassir', 'satici', 'manecer')
   AND i.kod IN ('mezuniyyet.istek')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── menbe: 2026-06-02-kampaniya-permissions.sql ───
-- ============================================================================
-- Kampaniyalar modulu icazələri — kupon, loyalty, hədiyyə kartı, broadcast
-- ============================================================================
-- Kampaniya modulu pul ekvivalentini (bonus balans, gift card, endirim)
-- idarə edir. Yanlış icazə = real maliyyə zərəri.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('kampaniya.oxu',       'Kampaniya oxu',         'Kampaniyalar', 'Kampaniya/kupon/loyalty/gift siyahısı oxu'),
  ('kampaniya.idare',     'Kampaniya idarə',       'Kampaniyalar', 'Kampaniya yarat, redaktə, status dəyiş'),
  ('kampaniya.sil',       'Kampaniya arxiv',       'Kampaniyalar', 'Kampaniyanı arxivlə (soft delete)'),
  ('kampaniya.kupon',     'Kupon idarə',           'Kampaniyalar', 'Kupon yarat və bulk generasiya'),
  ('marketing.broadcast', 'Marketing broadcast',   'Marketing',    'Telegram/SMS toplu mesaj göndər'),
  ('loyalty.idare',       'Loyalty kart idarə',    'Loyalty',      'Loyalty kart yarat, tier yenilə'),
  ('loyalty.balans',      'Bonus balans idarə',    'Loyalty',      'Bonus balansı manual artır/azalt (💰 maliyyə təsiri var)'),
  ('gift.yarat',          'Hədiyyə kartı yarat',   'Hədiyyə',      'Yeni gift card yarat (pul ekvivalenti)'),
  ('gift.idare',          'Hədiyyə kartı idarə',   'Hədiyyə',      'Gift card təyin et / söndür')
ON CONFLICT (kod) DO NOTHING;

-- Default: sahibkar/admin/direktor bütün kampaniya icazələrinə malikdir
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND (i.kod LIKE 'kampaniya.%' OR i.kod LIKE 'marketing.%'
        OR i.kod LIKE 'loyalty.%' OR i.kod LIKE 'gift.%')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Marketing menecer — balans və silmə xaric hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('marketing_menecer', 'marketing')
   AND i.kod IN (
     'kampaniya.oxu', 'kampaniya.idare', 'kampaniya.kupon',
     'marketing.broadcast',
     'loyalty.idare',
     'gift.yarat', 'gift.idare'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib / maliyyə — balans və gift kartı görə bilər (audit üçün)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('muhasib')
   AND i.kod IN ('kampaniya.oxu', 'loyalty.idare', 'loyalty.balans', 'gift.idare')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer — yalnız oxu
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('manecer', 'team_lead')
   AND i.kod IN ('kampaniya.oxu')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- POS kassiri — yalnız oxu (kart axtarış üçün)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('kassir', 'satici')
   AND i.kod IN ('kampaniya.oxu')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── menbe: 2026-06-02-lab-permissions.sql ───
-- ============================================================================
-- 360 LAB modulu icazələri
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('lab.view',  'Lab oxu',        '360 LAB', 'Lab kataloqu oxu + feature aktivləşdirmə (öz hesabında)'),
  ('lab.idare', 'Lab whitelist',  '360 LAB', 'Tenant səviyyəsində whitelist (hansı feature-lar açıq)'),
  ('lab.rate',  'Lab rating',     '360 LAB', 'Feature-ə rating/comment vermə')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar/admin/direktor — hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND i.kod LIKE 'lab.%'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Bütün adi əməkdaşlar — Lab view + rate
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('manecer', 'team_lead', 'satici', 'kassir', 'marketing_menecer', 'hr_menecer', 'muhasib')
   AND i.kod IN ('lab.view', 'lab.rate')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── menbe: 2026-06-02-marketplace-permissions.sql ───
-- ============================================================================
-- Marketplace & Webhook modulu icazələri
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('marketplace.oxu',    'Marketplace oxu',     'Marketplace', 'Marketplace siyahısı, sosial post, sync sağlamlığı'),
  ('marketplace.idare',  'Marketplace idarə',   'Marketplace', 'Hesab qoş, sil, redaktə (API key dəyişikliyi daxil)'),
  ('marketplace.sync',   'Marketplace sync',    'Marketplace', 'Sinxronlaşdırma tetiklə (rate limit ilə)'),
  ('webhook.idare',      'Webhook idarə',       'Webhook',     'Webhook endpoint yarat/redaktə/sil'),
  ('webhook.test',       'Webhook test',        'Webhook',     'Webhook test sorğu göndər (SSRF-safe)'),
  ('social.publish',     'Sosial dərc',         'Marketplace', 'Sosial media post avtomatik dərc')
ON CONFLICT (kod) DO NOTHING;

INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND (i.kod LIKE 'marketplace.%' OR i.kod LIKE 'webhook.%' OR i.kod = 'social.publish')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('marketing_menecer', 'marketing')
   AND i.kod IN ('marketplace.oxu', 'marketplace.idare', 'marketplace.sync', 'social.publish')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('manecer', 'team_lead')
   AND i.kod IN ('marketplace.oxu')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── menbe: 2026-06-02-team-permissions.sql ───
-- ============================================================================
-- Team / Söhbət modulu icazələri
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('team.kanal_yarat', 'Kanal yarat',       'Team', 'Yeni söhbət kanalı yarat'),
  ('team.idare',       'Team ayarları',     'Team', 'Təşkilat səviyyəli team ayarları (retention, auto-channels)'),
  ('team.broadcast',   'Team broadcast',    'Team', 'Bütün kanal üzvlərinə toplu bildiriş')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar/admin/direktor — bütün team icazələri
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND i.kod LIKE 'team.%'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Adi əməkdaş — yalnız kanal yarat (lider olmaq üçün)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('manecer', 'team_lead', 'hr_menecer', 'marketing_menecer')
   AND i.kod IN ('team.kanal_yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── menbe: 2026-06-03-quick-create-permissions.sql ───
-- ============================================================================
-- M: Sürətli yaratma icazələri — brend, anbar, qiymət növü
-- ============================================================================
-- "Sürətli yarat" inline dialoq pattern üzrə:
--   /ticaret/satis-yeni, /ticaret/alis-yeni, məhsul forması, müştəri forması və s.
--   müvafiq referansı (brend, anbar, qiymət növü) inline yaratmaq imkanı.
-- Aşağıdakı icazələr `requireAnbarActionPerm` / `requireAyarActionPerm` tərəfindən
-- yoxlanılır. Sahibkar/admin/owner avtomatik keçir, digər roles üçün burada
-- granular paylaşma.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('brend.yarat',   'Brend yarat',        'Anbar',  'Sürətli brend (marka) yarat — məhsul formunda inline'),
  ('marka.yarat',   'Marka yarat (alias)','Anbar',  'brend.yarat-ın aliası — tam formada açmaq'),
  ('anbar.yarat',   'Anbar yarat',        'Anbar',  'Sürətli anbar yarat — satış/alış/transferdə inline'),
  ('ayar.qiymet',   'Qiymət növü idarə',  'Ayarlar','Qiymət növləri (topdan, perakende, VIP) yarat/redaktə')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND i.kod IN ('brend.yarat', 'marka.yarat', 'anbar.yarat', 'ayar.qiymet')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer → hamısı (idarəetmə üçün)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'manecer'
   AND i.kod IN ('brend.yarat', 'marka.yarat', 'anbar.yarat', 'ayar.qiymet')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Anbardar → brend + anbar (məhsul/anbar əməliyyatları)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'anbardar'
   AND i.kod IN ('brend.yarat', 'marka.yarat', 'anbar.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── menbe: 2026-06-11-icmal-permissions.sql ───
-- ============================================================================
-- Modul icmal (modulun öz dashboardu) icazələri
-- ============================================================================
-- İcmal səhifəsi 2 qatla idarə olunur:
--   1) Ayarlar → Görünüş → "Modulun öz dashboardu" (sahibkar, biznes üzrə)
--   2) Rol icazəsi: icmal.<modul> (sahibkar/admin/direktor bypass)
-- Bu kodlar rol icazələri UI-da görünür və adi rollara verilə bilər.
--
-- İcra (prod): psql "$DATABASE_URL" -f scripts/migrations/2026-06-11-icmal-permissions.sql
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('icmal.ticaret', 'Ticarət icmalı',  'İcmal', 'Ticarət modulunun KPI/icmal səhifəsini görür'),
  ('icmal.anbar',   'Anbar icmalı',    'İcmal', 'Anbar modulunun KPI/icmal səhifəsini görür'),
  ('icmal.maliyye', 'Maliyyə icmalı',  'İcmal', 'Maliyyə modulunun KPI/icmal səhifəsini görür'),
  ('icmal.elaqe',   'Əlaqə icmalı',    'İcmal', 'Müştərilər modulunun KPI/icmal səhifəsini görür')
ON CONFLICT (kod) DO NOTHING;

-- ─── menbe: 2026-06-16-permissions-rebuild.sql ───
-- ============================================================================
-- 2026-06-16: İCAZƏ SXEM KÖÇÜRMƏSİNİ TAMAMLAYAN REBUILD (auto-generated)
-- Sınıq migrasiyalar (roles/r.ad + fantom roles) atomik fail olmuşdu.
-- Bu fayl bütün yeni kodları kataloqa əlavə edir + grant-ları real rollara
-- tətbiq edir (sistem + tenant-klon = avto-backfill). İdempotent.
-- ============================================================================

-- ─── mənbə: 2026-06-01-anbar-permissions.sql ───
-- ============================================================================
-- M: Anbar modulu icazələri — məhsul, stok, satınalma, sayım, qiymət
-- ============================================================================
-- Anbar modulunun 16 alt-bölməsi var. Hər biri üçün ayrı icazə.
-- Anbardar adi əməliyyatlar edə bilir, menecer + alış / sayım, sahibkar hər şey.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('anbar.oxu',           'Anbar səhifəsi',           'Anbar', 'Master icazə — /anbar səhifəsinə giriş'),
  ('mehsul.oxu',          'Məhsul siyahısı',          'Anbar', 'Məhsul kataloqu görmək'),
  ('mehsul.yarat',        'Məhsul yarat',             'Anbar', 'Yeni məhsul əlavə (ProductWizard)'),
  ('mehsul.duzelt',       'Məhsul redaktə',           'Anbar', 'Mövcud məhsulu dəyişmək'),
  ('mehsul.sil',          'Məhsul sil/arxivlə',       'Anbar', 'Məhsulu silmək və ya arxivləmək'),
  ('mehsul.yukle',        'Excel ilə yüklə',          'Anbar', '/anbar/mehsul-yukle — toplu import'),
  ('stok.oxu',            'Stok cədvəli',             'Anbar', '/anbar/stok — hansı anbarda nə qədər var'),
  ('stok.duzelis',        'Stok düzəliş',             'Anbar', 'Manual stok artırmaq/azaltmaq'),
  ('stok.transfer',       'Anbarlar arası transfer',  'Anbar', '/anbar/transfer — mal hərəkəti'),
  ('stok.bron',           'Stok bron',                'Anbar', '/anbar/bron — müştəri rezervi'),
  ('satinalma.oxu',       'Satınalma',                'Anbar', '/anbar/satinalma — alış sənədləri'),
  ('satinalma.yarat',     'Alış sənədi yarat',        'Anbar', 'Təchizatçıdan yeni alış'),
  ('sayim.oxu',           'Sayım',                    'Anbar', '/anbar/inventar — sayım sənədləri'),
  ('sayim.yarat',         'Yeni sayım',               'Anbar', 'Sayım başlatmaq'),
  ('qiymet.oxu',          'Qiymət siyahısı',          'Anbar', '/anbar/qiymet — qiymət siyahıları'),
  ('qiymet.duzelt',       'Qiymət dəyiş',             'Anbar', 'Bulk qiymət yeniləməsi'),
  ('kateqoriya.idare',    'Kateqoriya/marka',         'Anbar', '/anbar/kateqoriyalar + /anbar/markalar redaktə'),
  ('konsiqnasiya.oxu',    'Konsiqnasiya',             'Anbar', '/anbar/konsiqnasiya — komissiya satışı'),
  ('anbar.hesabat',       'Hesabatlar',               'Anbar', '/anbar/hesabat + /anbar/hereketler analitika'),
  ('anbar.anomali',       'Anomaliya aşkarı',         'Anbar', '/anbar/anomali — AI əsaslı anomaliya')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND (i.kod = 'anbar.oxu' OR i.kod LIKE 'mehsul.%' OR i.kod LIKE 'stok.%'
        OR i.kod LIKE 'satinalma.%' OR i.kod LIKE 'sayim.%' OR i.kod LIKE 'qiymet.%'
        OR i.kod IN ('kateqoriya.idare', 'konsiqnasiya.oxu', 'anbar.hesabat', 'anbar.anomali'))
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer → satinalma və qiymət daxil, hesabat
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'manecer'
   AND i.kod IN (
     'anbar.oxu', 'mehsul.oxu', 'mehsul.yarat', 'mehsul.duzelt',
     'stok.oxu', 'stok.duzelis', 'stok.transfer', 'stok.bron',
     'satinalma.oxu', 'satinalma.yarat',
     'sayim.oxu', 'sayim.yarat',
     'qiymet.oxu', 'qiymet.duzelt',
     'kateqoriya.idare', 'konsiqnasiya.oxu', 'anbar.hesabat'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Anbardar → əsas əməliyyatlar (məhsul, stok, sayım, transfer, bron)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'anbardar'
   AND i.kod IN (
     'anbar.oxu', 'mehsul.oxu', 'mehsul.yarat', 'mehsul.duzelt', 'mehsul.yukle',
     'stok.oxu', 'stok.duzelis', 'stok.transfer', 'stok.bron',
     'satinalma.oxu', 'sayim.oxu', 'sayim.yarat',
     'qiymet.oxu', 'kateqoriya.idare'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Kassir / satıcı → yalnız oxu (məhsul axtarışı POS-da işləsin deyə)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('kassir', 'satici')
   AND i.kod IN ('anbar.oxu', 'mehsul.oxu', 'stok.oxu', 'qiymet.oxu')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib → hesabat + qiymət + satınalma (gör)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'muhasib'
   AND i.kod IN (
     'anbar.oxu', 'mehsul.oxu', 'stok.oxu', 'satinalma.oxu',
     'qiymet.oxu', 'anbar.hesabat'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── mənbə: 2026-06-01-dashboard-permissions.sql ───
-- ============================================================================
-- M: Dashboard icazələri — bölmə-bölmə görünmə nəzarəti
-- ============================================================================
-- Dashboard indi rol əsaslı təşkil olunur. `dashboard.oxu` master keçiddir
-- (yoxdursa səhifə özü açılmır). Hər bölmənin öz icazəsi var; sahibkar rol
-- detalı səhifəsində hansı rolun nəyi görəcəyini bütöv-incə seçə bilir.
--
-- Bütün dashboard.* icazələri "Dashboard" qrupundadır — rol matrisi onları
-- avtomatik tək bölmədə göstərir.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('dashboard.oxu',       'Dashboard-u aç',          'Dashboard', 'Master icazə — /dashboard səhifəsinə girişə icazə'),
  ('dashboard.kpi',       'KPI kartları',            'Dashboard', 'Aylıq gəlir/xərc/mənfəət big-card və 3 KPI sətri'),
  ('dashboard.cashflow',  'Bu gün pul axını',        'Dashboard', 'Mədaxil/məxaric/net kartı və proporsional barlar'),
  ('dashboard.tapshiriq', 'Mənim işim kartı',        'Dashboard', 'Açıq tapşırıqlar, xatırlatma, gecikmiş + effektivlik ringi'),
  ('dashboard.aktivlik',  'Son satış və hadisələr',  'Dashboard', 'Son 5 satış cədvəli + canlı audit feed'),
  ('dashboard.stok',      'Aşağı stok paneli',       'Dashboard', 'Kritik səviyyəyə yaxınlaşan məhsullar siyahısı'),
  ('dashboard.top5',      'Top 5 reytinqlər',        'Dashboard', 'Top məhsul/satıcı/alıcı/platforma kartları'),
  ('dashboard.alerts',    'Diqqət lazımdır',         'Dashboard', 'Kritik xəbərdarlıqlar banneri'),
  ('dashboard.sync',      'Marketplace sync',         'Dashboard', 'Inbound/Outbound/Webhook/Retry sağlamlıq kartı'),
  ('dashboard.feed',      'Biznes fəaliyyət feedi',  'Dashboard', 'Aşağıdakı geniş aktivlik widget-i'),
  ('dashboard.charts',    'Qrafiklər',               'Dashboard', '30 günlük satış qrafiki + satış vs xərc müqayisəsi'),
  ('dashboard.insight',   'Günün analitikası',       'Dashboard', 'Ən üstdəki rəngli analitik mesaj')
ON CONFLICT (kod) DO NOTHING;

-- Avtomatik təyinatlar — sahibkar (9), admin (1), direktor (11) hamısını görsün
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
FROM roles r
CROSS JOIN icazeler i
WHERE r.id IN (1, 9, 11)
  AND i.kod LIKE 'dashboard.%'
ON CONFLICT DO NOTHING;

-- Müşahidəçi/menecer/muhasib — yumşaq paket (analitika+öz iş)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
FROM roles r
CROSS JOIN icazeler i
WHERE r.id IN (2, 10, 12)
  AND i.kod IN (
    'dashboard.oxu',
    'dashboard.kpi',
    'dashboard.cashflow',
    'dashboard.tapshiriq',
    'dashboard.aktivlik',
    'dashboard.alerts',
    'dashboard.charts',
    'dashboard.insight'
  )
ON CONFLICT DO NOTHING;

-- Satıcı/kassir — minimum paket (öz işi + günün xülasəsi)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
FROM roles r
CROSS JOIN icazeler i
WHERE r.id IN (3, 13)
  AND i.kod IN (
    'dashboard.oxu',
    'dashboard.tapshiriq',
    'dashboard.aktivlik',
    'dashboard.insight'
  )
ON CONFLICT DO NOTHING;

-- Anbardar — anbar fokuslu
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
FROM roles r
CROSS JOIN icazeler i
WHERE r.id IN (4)
  AND i.kod IN (
    'dashboard.oxu',
    'dashboard.tapshiriq',
    'dashboard.stok',
    'dashboard.alerts',
    'dashboard.insight'
  )
ON CONFLICT DO NOTHING;

-- Servisçi/SMM/kuryer — yalnız master + öz işi
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
FROM roles r
CROSS JOIN icazeler i
WHERE r.id IN (14, 15, 16)
  AND i.kod IN (
    'dashboard.oxu',
    'dashboard.tapshiriq',
    'dashboard.insight'
  )
ON CONFLICT DO NOTHING;

-- ─── mənbə: 2026-06-01-elaqe-permissions.sql ───
-- ============================================================================
-- M: Elaqə (CRM) modulu icazələri — müştəri, təchizatçı, borc, followup
-- ============================================================================
-- Rol əsaslı paylaşma:
--   Sahibkar/admin → hamısı
--   Mühasib       → bütün oxu + borc
--   Menecer       → müştəri/təchizatçı CRUD + borc + followup
--   Satıcı        → müştəri oxu/yarat/duzelt + followup
--   Kassir        → müştəri oxu/yarat (POS-da müştəri əlavə)
--   Anbardar      → təchizatçı oxu/yarat
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('elaqe.oxu',          'Elaqə səhifəsi',       'Elaqə', 'Master icazə — /elaqe səhifəsinə giriş'),
  ('musteri.oxu',        'Müştərilər',           'Elaqə', '/elaqe/musteriler — müştəri kataloqu'),
  ('musteri.yarat',      'Müştəri yarat',        'Elaqə', 'Yeni müştəri əlavə et'),
  ('musteri.duzelt',     'Müştəri redaktə',      'Elaqə', 'Müştəri kartı dəyişmək (telefon, borc limiti)'),
  ('musteri.sil',        'Müştəri sil/arxivlə',  'Elaqə', 'Müştərini sil və ya arxivlə'),
  ('musteri.gizli',      'Müştəri həssas info',  'Elaqə', 'Telefon/email/ünvan görmək (gizli mod ləğv)'),
  ('techizatci.oxu',     'Təchizatçılar',        'Elaqə', '/elaqe/techizatcilar — təchizatçı kataloqu'),
  ('techizatci.yarat',   'Təchizatçı yarat',     'Elaqə', 'Yeni təchizatçı əlavə et'),
  ('techizatci.duzelt',  'Təchizatçı redaktə',   'Elaqə', 'Təchizatçı kartı dəyişmək'),
  ('elaqe.borc',         'Borc analizi',         'Elaqə', '/elaqe/borclar — borclu müştəri/təchizatçı + bulk xatırlatma'),
  ('elaqe.followup',     'CRM follow-up',        'Elaqə', '/elaqe/followup — müştəri ilə əlaqə izi'),
  ('elaqe.inaktiv',      'İnaktiv analiz',       'Elaqə', '/elaqe/inaktiv — uzun müddət alış etməyən'),
  ('elaqe.dublikat',     'Dublikat aşkarı',      'Elaqə', '/elaqe/dublikat — eyni müştəri/təchizatçı təkrar'),
  ('elaqe.hesabat',      'CRM hesabatları',      'Elaqə', '/elaqe/hesabat — RFM, tier paylanışı'),
  ('elaqe.bulk_mesaj',   'Bulk SMS/Telegram',    'Elaqə', 'Müştərilərə kütləvi mesaj göndərmək')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND (i.kod = 'elaqe.oxu' OR i.kod LIKE 'musteri.%' OR i.kod LIKE 'techizatci.%' OR i.kod LIKE 'elaqe.%')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib → oxu + borc
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'muhasib'
   AND i.kod IN (
     'elaqe.oxu', 'musteri.oxu', 'techizatci.oxu',
     'elaqe.borc', 'elaqe.inaktiv', 'elaqe.hesabat'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer → tam CRUD + analiz + bulk mesaj
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'manecer'
   AND i.kod IN (
     'elaqe.oxu',
     'musteri.oxu', 'musteri.yarat', 'musteri.duzelt', 'musteri.gizli',
     'techizatci.oxu', 'techizatci.yarat', 'techizatci.duzelt',
     'elaqe.borc', 'elaqe.followup', 'elaqe.inaktiv', 'elaqe.dublikat',
     'elaqe.hesabat', 'elaqe.bulk_mesaj'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Satıcı → müştəri tam + followup (öz müştəriləri)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'satici'
   AND i.kod IN (
     'elaqe.oxu', 'musteri.oxu', 'musteri.yarat', 'musteri.duzelt',
     'elaqe.followup'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Kassir → müştəri oxu/yarat (POS-da müştəri əlavə)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'kassir'
   AND i.kod IN ('elaqe.oxu', 'musteri.oxu', 'musteri.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Anbardar → təchizatçı oxu/yarat (alış zamanı təchizatçı əlavə)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'anbardar'
   AND i.kod IN ('elaqe.oxu', 'techizatci.oxu', 'techizatci.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── mənbə: 2026-06-01-maliyye-permissions.sql ───
-- ============================================================================
-- M: Maliyyə modulu icazələri — kassa, bank, xərc, ödəniş, gün sonu, hesabat
-- ============================================================================
-- Maliyyə ən həssas moduldur. Pul axını və hesabat görmək rol əsaslı:
--   Sahibkar/admin → hamısı
--   Mühasib       → hamısı oxu + xərc / ödəniş yarat / gün sonu
--   Menecer       → kassa/bank oxu + xərc/ödəniş yarat + hesabat
--   Kassir        → kassa oxu (öz sessiyası) + ödəniş qəbul
--   Anbardar      → görmür
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('maliyye.oxu',         'Maliyyə səhifəsi',     'Maliyyə', 'Master icazə — /maliyye səhifəsinə giriş'),
  ('kassa.oxu',           'Kassalar',             'Maliyyə', '/maliyye/kassalar — kassa qalıqları'),
  ('kassa.emeliyyat',     'Kassa idarə',          'Maliyyə', 'Yeni kassa yarat / sil / qalıq düzəliş'),
  ('bank.oxu',            'Bank hesabları',       'Maliyyə', '/maliyye/bank — bank hesabları və əməliyyatları'),
  ('bank.emeliyyat',      'Bank idarə',           'Maliyyə', 'Bank hesabı əlavə / sil / sinxron'),
  ('xerc.oxu',            'Xərclər',              'Maliyyə', '/maliyye/xercler — xərc tarixçəsi'),
  ('xerc.yarat',          'Yeni xərc',            'Maliyyə', 'Xərc əlavə et'),
  ('xerc.idare',          'Xərc idarə',           'Maliyyə', 'Xərc redaktə / sil'),
  ('odenis.qebul',        'Ödəniş qəbul',         'Maliyyə', 'Müştəri borcuna qarşı ödəniş qəbul et'),
  ('odenis.yarat',        'Yeni ödəniş',          'Maliyyə', 'Manual ödəniş (təchizatçı/işçi)'),
  ('debitor.oxu',         'Debitor (alacaq)',     'Maliyyə', '/maliyye/debitor — müştəri borc analizi'),
  ('kreditor.oxu',        'Kreditor (borc)',      'Maliyyə', '/maliyye/kreditor — təchizatçı borc analizi'),
  ('maliyye.gun_sonu',    'Gün sonu',             'Maliyyə', '/maliyye/gun-sonu — yığma və kassa bağlanış'),
  ('maliyye.hesabat',     'Maliyyə hesabatları',  'Maliyyə', 'P/L, balans, pul axını, hesabat'),
  ('edv.idare',           'ƏDV / vergilər',       'Maliyyə', '/maliyye/edv + /yol-vergisi'),
  ('maliyye.recurring',   'Təkrarlanan ödəniş',   'Maliyyə', '/maliyye/recurring — kirayə, abunə')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND (i.kod = 'maliyye.oxu' OR i.kod LIKE 'kassa.%' OR i.kod LIKE 'bank.%'
        OR i.kod LIKE 'xerc.%' OR i.kod LIKE 'odenis.%' OR i.kod LIKE 'maliyye.%'
        OR i.kod IN ('debitor.oxu', 'kreditor.oxu', 'edv.idare'))
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib → hamısı (bank.emeliyyat və kassa.emeliyyat istisna - sahibkar tələb edir)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'muhasib'
   AND i.kod IN (
     'maliyye.oxu', 'kassa.oxu', 'bank.oxu',
     'xerc.oxu', 'xerc.yarat', 'xerc.idare',
     'odenis.qebul', 'odenis.yarat',
     'debitor.oxu', 'kreditor.oxu',
     'maliyye.gun_sonu', 'maliyye.hesabat', 'edv.idare',
     'maliyye.recurring'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer → kassa/bank oxu + xərc/ödəniş yarat + hesabat
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'manecer'
   AND i.kod IN (
     'maliyye.oxu', 'kassa.oxu', 'bank.oxu',
     'xerc.oxu', 'xerc.yarat',
     'odenis.qebul', 'odenis.yarat',
     'debitor.oxu', 'kreditor.oxu',
     'maliyye.hesabat'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Kassir → kassa oxu + ödəniş qəbul (POS-da işləsin deyə)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'kassir'
   AND i.kod IN ('maliyye.oxu', 'kassa.oxu', 'odenis.qebul')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── mənbə: 2026-06-01-nezaret-permissions.sql ───
-- ============================================================================
-- M: Nəzarət Mərkəzi icazələri — risk dashboard, log, ayarlar nəzarəti
-- ============================================================================
-- Nəzarət Mərkəzi həssas modul — bütün biznesin risk/audit məlumatını göstərir.
-- Default-da yalnız sahibkar/admin/direktor görür.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('nezaret.oxu',       'Nəzarət mərkəzini aç',  'Nəzarət Mərkəzi', 'Master icazə — /nezaret-merkezi səhifəsinə girişə icazə'),
  ('nezaret.dashboard', 'Risk dashboard',        'Nəzarət Mərkəzi', 'Aktiv xəbərdarlıq, təsdiq, stok riski, borc, davamiyyət göstəriciləri'),
  ('nezaret.loglar',    'Audit log',             'Nəzarət Mərkəzi', 'Xəbərdarlıq + təsdiq + system event birləşdirilmiş tarixçə'),
  ('nezaret.ayarlar',   'Ayarları dəyiş',        'Nəzarət Mərkəzi', 'Avtomat qaydalar, eskalasiya, default davranış konfiqurasiyası')
ON CONFLICT (kod) DO NOTHING;

-- Default: sahibkar / admin / direktor rolesına bütün nezaret icazələri
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND i.kod LIKE 'nezaret.%'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib və menecer rolesına yalnız oxu (dashboard + log)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('muhasib', 'manecer')
   AND i.kod IN ('nezaret.oxu', 'nezaret.dashboard', 'nezaret.loglar')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── mənbə: 2026-06-01-pos-permissions.sql ───
-- ============================================================================
-- M: POS / Kassa icazələri — kassir əməliyyatları üzərində nəzarət
-- ============================================================================
-- POS-da iki növ icazə var:
--   1. Aktiv icazə (pos.satis, pos.access, pos.session_*) — əməliyyat icazəsi
--   2. Görünüş/qiymət icazələri (pos.view_*, pos.change_price, pos.discount)
--
-- Bütün pos.* icazələri "POS / Kassa" qrupundadır — rol matrisi onları
-- avtomatik tək bölmədə göstərir.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('pos.access',              'POS-u aç',                    'POS / Kassa', 'Master icazə — /pos səhifəsinə girişə icazə verir'),
  ('pos.satis',               'Satış et',                    'POS / Kassa', 'Satışı təsdiqləyə bilir — createSale server action-a giriş'),
  ('pos.session_open',        'Kassa sessiya aç',            'POS / Kassa', 'Yeni kassa sessiyası başlada bilər'),
  ('pos.session_close',       'Kassa sessiya bağla',         'POS / Kassa', 'Sessiya bağlayıb gün sonu hesablaya bilər'),
  ('pos.change_price',        'Qiymət dəyişdir',             'POS / Kassa', 'POS-da məhsul qiymətini əl ilə dəyişə bilər'),
  ('pos.sell_below_min_price','Min qiymətdən aşağı sat',     'POS / Kassa', 'Minimum satış qiymətindən aşağı sata bilər'),
  ('pos.discount',            'Endirim et',                  'POS / Kassa', 'Səbət / sətir endirim sahələrini istifadə edə bilər'),
  ('pos.view_cost',           'Maya qiyməti gör',            'POS / Kassa', 'POS-da məhsul kartında alış qiymətini görə bilər'),
  ('pos.view_margin',         'Marja gör',                   'POS / Kassa', 'POS-da real-time mənfəət marjasını görə bilər'),
  ('pos.view_min_price',      'Min qiymət gör',              'POS / Kassa', 'POS-da məhsul kartında min satış qiymətini görə bilər'),
  ('pos.print_receipt',       'Çek çap et',                  'POS / Kassa', 'Satışdan sonra POS çek çapı edə bilər'),
  ('pos.print_warranty',      'Zəmanət çap et',              'POS / Kassa', 'Zəmanət sənədi çapı edə bilər'),
  ('pos.credit_sell',         'Nisyə satış',                 'POS / Kassa', 'Müştəri borca / nisyəyə sata bilər')
ON CONFLICT (kod) DO NOTHING;

-- Avtomatik təyinatlar — sahibkar (9), admin (1), direktor (11) hamısını görsün
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND i.kod LIKE 'pos.%'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Kassir rolu üçün əsas POS icazələri (görünüş icazələri istisna olmaqla)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('kassir', 'satici')
   AND i.kod IN (
     'pos.access', 'pos.satis', 'pos.session_open',
     'pos.discount', 'pos.print_receipt', 'pos.credit_sell'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── mənbə: 2026-06-01-tapshiriq-permissions.sql ───
-- ============================================================================
-- M: Tapşırıqlar modulu icazələri — rol-əsaslı tapşırıq idarəsi
-- ============================================================================
-- Default: hər kəs öz tapşırıqlarını görür (tapshiriq.oxu), amma yaratmaq /
-- başqasına atamak / silmək kimi əməliyyatlar rol əsaslıdır.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('tapshiriq.oxu',        'Tapşırıqlar səhifəsi',     'Tapşırıqlar', 'Master icazə — /tapshiriqlar səhifəsinə girişə icazə'),
  ('tapshiriq.yarat',      'Tapşırıq yarat',           'Tapşırıqlar', 'Yeni tapşırıq yarada bilmək (özünə də olar)'),
  ('tapshiriq.atayir',     'Başqasına atayar',         'Tapşırıqlar', 'Tapşırıq başqa əməkdaşa təyin edə bilmək'),
  ('tapshiriq.layihe',     'Layihə görünüşü',          'Tapşırıqlar', '/tapshiriqlar/layihe — tapşırıqları layihə üzrə qruplama'),
  ('tapshiriq.statistika', 'Komanda statistikası',     'Tapşırıqlar', '/tapshiriqlar/statistika — bütün komandanın performansı'),
  ('tapshiriq.ai_analiz',  'AI analiz',                'Tapşırıqlar', '/tapshiriqlar/ai-analiz — süni intellekt analitikası'),
  ('tapshiriq.sablon',     'Şablon idarəsi',           'Tapşırıqlar', '/tapshiriqlar/sablonlar — şablon yaratmaq / dəyişmək / silmək'),
  ('tapshiriq.silsin',     'Tapşırıq sil',             'Tapşırıqlar', 'Tapşırığı tam DB-dən silmək (ləğv etmək deyil)')
ON CONFLICT (kod) DO NOTHING;

-- Default: sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND i.kod LIKE 'tapshiriq.%'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer: yarat, atayar, layihə, statistika
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'manecer'
   AND i.kod IN ('tapshiriq.oxu', 'tapshiriq.yarat', 'tapshiriq.atayir', 'tapshiriq.layihe', 'tapshiriq.statistika')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Adi əməkdaş / kassir / satıcı: yalnız oxu + öz tapşırığı üçün yarat
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('kassir', 'satici', 'emekdas', 'anbardar')
   AND i.kod IN ('tapshiriq.oxu', 'tapshiriq.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── mənbə: 2026-06-01-ticaret-permissions.sql ───
-- ============================================================================
-- M: Ticarət modulu icazələri — satış, alış, qaytarma, təklif, taksit
-- ============================================================================
-- 11 alt-bölmə + servis əməliyyatları. Rol əsaslı paylaşma:
--   Sahibkar/admin → hamısı
--   Menecer       → satış/alış/qaytarma/təklif/pipeline + market
--   Satıcı        → satış yarat/oxu + təklif + pipeline (öz lead-ləri)
--   Kassir        → satış oxu (POS-da yaradır, formal sənəd yox)
--   Mühasib       → oxu hər şeyə
--   Anbardar      → alış/qaytarma yarat (gələn mal qəbulu)
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('ticaret.oxu',     'Ticarət səhifəsi',     'Ticarət', 'Master icazə — /ticaret səhifəsinə giriş'),
  ('satis.oxu',       'Satışlar',             'Ticarət', '/ticaret/satislar — satış sənədləri'),
  ('satis.yarat',     'Yeni satış',           'Ticarət', '/ticaret/satis-yeni — formal satış'),
  ('satis.duzelt',    'Satış redaktə',        'Ticarət', 'Qaralama / mövcud satışı dəyişmək'),
  ('satis.legv',      'Satış ləğv',           'Ticarət', 'Satış sənədini ləğv etmək'),
  ('alis.oxu',        'Alışlar',              'Ticarət', '/ticaret/alislar — alış sənədləri'),
  ('alis.yarat',      'Yeni alış',            'Ticarət', 'Təchizatçıdan formal alış'),
  ('qaytarma.oxu',    'Qaytarmalar',          'Ticarət', '/ticaret/qaytarma — qaytarma sənədləri'),
  ('qaytarma.yarat',  'Yeni qaytarma',        'Ticarət', 'Müştəri qaytarması yarat'),
  ('teklif.oxu',      'Kommersial təklif',    'Ticarət', '/ticaret/teklif — kommersial təkliflər'),
  ('teklif.yarat',    'Yeni təklif',          'Ticarət', 'Müştəriyə qiymət təklifi'),
  ('pipeline.oxu',    'Satış pipeline',       'Ticarət', '/ticaret/pipeline — lead izi'),
  ('kredit.oxu',      'Taksit / kredit',      'Ticarət', '/ticaret/kredit — taksit izi'),
  ('kredit.yarat',    'Yeni taksit',          'Ticarət', 'Müştəri üçün taksit aç'),
  ('market.oxu',      'Marketplace',          'Ticarət', '/ticaret/market-satis — 3-cü tərəf platforma sifarişləri')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND (i.kod = 'ticaret.oxu' OR i.kod LIKE 'satis.%' OR i.kod LIKE 'alis.%'
        OR i.kod LIKE 'qaytarma.%' OR i.kod LIKE 'teklif.%' OR i.kod LIKE 'kredit.%'
        OR i.kod IN ('pipeline.oxu', 'market.oxu'))
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer → hamısı (sil/legv istisna)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'manecer'
   AND i.kod IN (
     'ticaret.oxu',
     'satis.oxu', 'satis.yarat', 'satis.duzelt',
     'alis.oxu', 'alis.yarat',
     'qaytarma.oxu', 'qaytarma.yarat',
     'teklif.oxu', 'teklif.yarat',
     'pipeline.oxu',
     'kredit.oxu', 'kredit.yarat',
     'market.oxu'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Satıcı → satış + təklif + pipeline
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'satici'
   AND i.kod IN (
     'ticaret.oxu', 'satis.oxu', 'satis.yarat',
     'teklif.oxu', 'teklif.yarat', 'pipeline.oxu', 'qaytarma.oxu'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Kassir → satış oxu (POS əməliyyatları)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'kassir'
   AND i.kod IN ('ticaret.oxu', 'satis.oxu', 'qaytarma.oxu', 'qaytarma.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Anbardar → alış / qaytarma (mal qəbulu)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'anbardar'
   AND i.kod IN ('ticaret.oxu', 'alis.oxu', 'alis.yarat', 'qaytarma.oxu', 'qaytarma.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib → bütün oxu
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'muhasib'
   AND i.kod IN (
     'ticaret.oxu', 'satis.oxu', 'alis.oxu', 'qaytarma.oxu',
     'teklif.oxu', 'pipeline.oxu', 'kredit.oxu', 'market.oxu'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── mənbə: 2026-06-02-crm-permissions.sql ───
-- ============================================================================
-- CRM / Mesaj Mərkəzi modulu icazələri
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('crm.oxu',         'CRM oxu',            'CRM',       'Dashboard, inbox, lead siyahısı oxu'),
  ('crm.idare',       'CRM idarə',          'CRM',       'Ümumi CRM idarəetmə (hamı görür)'),
  ('mesaj.cevab',     'Söhbətə cavab',      'CRM',       'İnbox söhbətə cavab göndər'),
  ('mesaj.idare',     'Söhbət idarə',       'CRM',       'Başqasının söhbətini görüntülə/redaktə (admin)'),
  ('lead.yarat',      'Lead yarat',         'CRM',       'Yeni lead əlavə et'),
  ('lead.idare',      'Lead idarə',         'CRM',       'Lead status dəyiş, mərhələ keçidi'),
  ('lead.sil',        'Lead arxiv',         'CRM',       'Lead arxivlə (soft delete)'),
  ('broadcast.idare', 'Broadcast kampaniya','CRM',       'Toplu mesaj kampaniyası yarat/göndər (pul ekvivalentli)'),
  ('sablon.idare',    'Mesaj şablonu',      'CRM',       'Mesaj şablonu yarat/redaktə/sil'),
  ('segment.idare',   'Seqment idarə',      'CRM',       'Müştəri seqmenti yarat/redaktə'),
  ('ai.istifade',     'AI istifadə',        'AI',        'AI cavab təklifi, AI seqment təklifi')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar/admin/direktor — bütün CRM icazələri
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND (i.kod LIKE 'crm.%' OR i.kod LIKE 'mesaj.%' OR i.kod LIKE 'lead.%'
        OR i.kod LIKE 'broadcast.%' OR i.kod LIKE 'sablon.%'
        OR i.kod LIKE 'segment.%' OR i.kod = 'ai.istifade')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Marketing menecer — broadcast/sablon/seqment xaric hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('marketing_menecer', 'marketing')
   AND i.kod IN (
     'crm.oxu', 'crm.idare', 'mesaj.cevab',
     'lead.yarat', 'lead.idare',
     'broadcast.idare', 'sablon.idare', 'segment.idare',
     'ai.istifade'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Satış meneceri — lead/inbox idarə, broadcast yox
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('satis_meneceri', 'manecer', 'team_lead')
   AND i.kod IN (
     'crm.oxu', 'mesaj.cevab',
     'lead.yarat', 'lead.idare',
     'sablon.idare', 'ai.istifade'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Adi satıcı / kassir — yalnız öz lead/söhbəti
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('satici', 'kassir')
   AND i.kod IN ('crm.oxu', 'mesaj.cevab', 'lead.yarat', 'ai.istifade')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── mənbə: 2026-06-02-hr-permissions.sql ───
-- ============================================================================
-- HR (Əməkdaşlar) modulu icazələri — payroll, attendance, vacation, discipline
-- ============================================================================
-- HR modulu həssas məlumatları idarə edir: maaş, bank, FİN, davamiyyət, cərimə.
-- Default-da yalnız sahibkar/admin/direktor görür/idarə edir.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('isci.view',         'İşçi siyahısı oxu',  'Əməkdaşlar', 'İşçi siyahısını və əsas məlumatlarını görür (maaş/bank xaric)'),
  ('isci.idare',        'İşçi idarə',         'Əməkdaşlar', 'İşçi yarat, redaktə, deaktivləşdir'),
  ('isci.discipline',   'İntizam əməliyyatı', 'Əməkdaşlar', 'Cərimə, xəbərdarlıq, işdən çıxarma'),
  ('maas.view',         'Maaş oxu',           'Maaş & ödəniş', 'Başqasının maaş, bank, FİN məlumatlarını görür'),
  ('maas.idare',        'Maaş idarə',         'Maaş & ödəniş', 'Payroll hesabla, ödə, bonus/cərimə tətbiq et'),
  ('maas.skala',        'Maaş skalası',       'Maaş & ödəniş', 'Maaş bandlarını/skalasını redaktə'),
  ('davamiyyet.view',   'Davamiyyət oxu',     'Davamiyyət',    'Davamiyyət hesabatını görür'),
  ('davamiyyet.idare',  'Davamiyyət idarə',   'Davamiyyət',    'Başqasının davamiyyətini yaz/redaktə'),
  ('mezuniyyet.istek',  'Məzuniyyət istəyi',  'Məzuniyyət',    'Özü üçün məzuniyyət sorğusu yarat'),
  ('mezuniyyet.tesdiq', 'Məzuniyyət təsdiqi', 'Məzuniyyət',    'Başqasının məzuniyyət sorğusunu təsdiq/rədd'),
  ('vakansiya.idare',   'Vakansiya idarə',    'İşə qəbul',     'Vakansiya yarat/sil, namizədlər'),
  ('treninq.idare',     'Treninq idarə',      'Treninq',       'Treninq şablonları və təyinatı'),
  ('hr.documents',      'Sənəd idarə',        'Sənədlər',      'İşçi sənədləri əlavə/sil'),
  ('hr.budce',          'HR büdcəsi',         'Büdcə',         'HR şöbə büdcə planı'),
  ('hr.bonus_idare',    'KPI/bonus profili',  'KPI',           'Bonus formulu və KPI profilini redaktə (yalnız sahibkar/HR direktor)')
ON CONFLICT (kod) DO NOTHING;

-- Default: sahibkar/admin/direktor bütün HR icazələrinə malikdir
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director', 'hr_direktor')
   AND (i.kod LIKE 'isci.%' OR i.kod LIKE 'maas.%' OR i.kod LIKE 'davamiyyet.%'
        OR i.kod LIKE 'mezuniyyet.%' OR i.kod LIKE 'vakansiya.%' OR i.kod LIKE 'treninq.%'
        OR i.kod LIKE 'hr.%')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- HR menecer / kadrlar rolu — bonus idarə xaric hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('hr_menecer', 'kadrlar', 'hr_uzmani')
   AND i.kod IN (
     'isci.view', 'isci.idare', 'isci.discipline',
     'maas.view', 'maas.idare', 'maas.skala',
     'davamiyyet.view', 'davamiyyet.idare',
     'mezuniyyet.tesdiq',
     'vakansiya.idare', 'treninq.idare', 'hr.documents', 'hr.budce'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer (komanda rəhbəri) — öz komandasını idarə edir, davamiyyət+məzuniyyət təsdiqi
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('manecer', 'team_lead')
   AND i.kod IN (
     'isci.view',
     'davamiyyet.view', 'davamiyyet.idare',
     'mezuniyyet.tesdiq',
     'treninq.idare'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Adi əməkdaş — yalnız öz məzuniyyət sorğusu
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('isci', 'kassir', 'satici', 'manecer')
   AND i.kod IN ('mezuniyyet.istek')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── mənbə: 2026-06-02-kampaniya-permissions.sql ───
-- ============================================================================
-- Kampaniyalar modulu icazələri — kupon, loyalty, hədiyyə kartı, broadcast
-- ============================================================================
-- Kampaniya modulu pul ekvivalentini (bonus balans, gift card, endirim)
-- idarə edir. Yanlış icazə = real maliyyə zərəri.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('kampaniya.oxu',       'Kampaniya oxu',         'Kampaniyalar', 'Kampaniya/kupon/loyalty/gift siyahısı oxu'),
  ('kampaniya.idare',     'Kampaniya idarə',       'Kampaniyalar', 'Kampaniya yarat, redaktə, status dəyiş'),
  ('kampaniya.sil',       'Kampaniya arxiv',       'Kampaniyalar', 'Kampaniyanı arxivlə (soft delete)'),
  ('kampaniya.kupon',     'Kupon idarə',           'Kampaniyalar', 'Kupon yarat və bulk generasiya'),
  ('marketing.broadcast', 'Marketing broadcast',   'Marketing',    'Telegram/SMS toplu mesaj göndər'),
  ('loyalty.idare',       'Loyalty kart idarə',    'Loyalty',      'Loyalty kart yarat, tier yenilə'),
  ('loyalty.balans',      'Bonus balans idarə',    'Loyalty',      'Bonus balansı manual artır/azalt (💰 maliyyə təsiri var)'),
  ('gift.yarat',          'Hədiyyə kartı yarat',   'Hədiyyə',      'Yeni gift card yarat (pul ekvivalenti)'),
  ('gift.idare',          'Hədiyyə kartı idarə',   'Hədiyyə',      'Gift card təyin et / söndür')
ON CONFLICT (kod) DO NOTHING;

-- Default: sahibkar/admin/direktor bütün kampaniya icazələrinə malikdir
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND (i.kod LIKE 'kampaniya.%' OR i.kod LIKE 'marketing.%'
        OR i.kod LIKE 'loyalty.%' OR i.kod LIKE 'gift.%')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Marketing menecer — balans və silmə xaric hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('marketing_menecer', 'marketing')
   AND i.kod IN (
     'kampaniya.oxu', 'kampaniya.idare', 'kampaniya.kupon',
     'marketing.broadcast',
     'loyalty.idare',
     'gift.yarat', 'gift.idare'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib / maliyyə — balans və gift kartı görə bilər (audit üçün)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('muhasib')
   AND i.kod IN ('kampaniya.oxu', 'loyalty.idare', 'loyalty.balans', 'gift.idare')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer — yalnız oxu
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('manecer', 'team_lead')
   AND i.kod IN ('kampaniya.oxu')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- POS kassiri — yalnız oxu (kart axtarış üçün)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('kassir', 'satici')
   AND i.kod IN ('kampaniya.oxu')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── mənbə: 2026-06-02-lab-permissions.sql ───
-- ============================================================================
-- 360 LAB modulu icazələri
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('lab.view',  'Lab oxu',        '360 LAB', 'Lab kataloqu oxu + feature aktivləşdirmə (öz hesabında)'),
  ('lab.idare', 'Lab whitelist',  '360 LAB', 'Tenant səviyyəsində whitelist (hansı feature-lar açıq)'),
  ('lab.rate',  'Lab rating',     '360 LAB', 'Feature-ə rating/comment vermə')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar/admin/direktor — hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND i.kod LIKE 'lab.%'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Bütün adi əməkdaşlar — Lab view + rate
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('manecer', 'team_lead', 'satici', 'kassir', 'marketing_menecer', 'hr_menecer', 'muhasib')
   AND i.kod IN ('lab.view', 'lab.rate')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── mənbə: 2026-06-02-marketplace-permissions.sql ───
-- ============================================================================
-- Marketplace & Webhook modulu icazələri
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('marketplace.oxu',    'Marketplace oxu',     'Marketplace', 'Marketplace siyahısı, sosial post, sync sağlamlığı'),
  ('marketplace.idare',  'Marketplace idarə',   'Marketplace', 'Hesab qoş, sil, redaktə (API key dəyişikliyi daxil)'),
  ('marketplace.sync',   'Marketplace sync',    'Marketplace', 'Sinxronlaşdırma tetiklə (rate limit ilə)'),
  ('webhook.idare',      'Webhook idarə',       'Webhook',     'Webhook endpoint yarat/redaktə/sil'),
  ('webhook.test',       'Webhook test',        'Webhook',     'Webhook test sorğu göndər (SSRF-safe)'),
  ('social.publish',     'Sosial dərc',         'Marketplace', 'Sosial media post avtomatik dərc')
ON CONFLICT (kod) DO NOTHING;

INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND (i.kod LIKE 'marketplace.%' OR i.kod LIKE 'webhook.%' OR i.kod = 'social.publish')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('marketing_menecer', 'marketing')
   AND i.kod IN ('marketplace.oxu', 'marketplace.idare', 'marketplace.sync', 'social.publish')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('manecer', 'team_lead')
   AND i.kod IN ('marketplace.oxu')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── mənbə: 2026-06-02-team-permissions.sql ───
-- ============================================================================
-- Team / Söhbət modulu icazələri
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('team.kanal_yarat', 'Kanal yarat',       'Team', 'Yeni söhbət kanalı yarat'),
  ('team.idare',       'Team ayarları',     'Team', 'Təşkilat səviyyəli team ayarları (retention, auto-channels)'),
  ('team.broadcast',   'Team broadcast',    'Team', 'Bütün kanal üzvlərinə toplu bildiriş')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar/admin/direktor — bütün team icazələri
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND i.kod LIKE 'team.%'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Adi əməkdaş — yalnız kanal yarat (lider olmaq üçün)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('manecer', 'team_lead', 'hr_menecer', 'marketing_menecer')
   AND i.kod IN ('team.kanal_yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── mənbə: 2026-06-03-quick-create-permissions.sql ───
-- ============================================================================
-- M: Sürətli yaratma icazələri — brend, anbar, qiymət növü
-- ============================================================================
-- "Sürətli yarat" inline dialoq pattern üzrə:
--   /ticaret/satis-yeni, /ticaret/alis-yeni, məhsul forması, müştəri forması və s.
--   müvafiq referansı (brend, anbar, qiymət növü) inline yaratmaq imkanı.
-- Aşağıdakı icazələr `requireAnbarActionPerm` / `requireAyarActionPerm` tərəfindən
-- yoxlanılır. Sahibkar/admin/owner avtomatik keçir, digər roles üçün burada
-- granular paylaşma.
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('brend.yarat',   'Brend yarat',        'Anbar',  'Sürətli brend (marka) yarat — məhsul formunda inline'),
  ('marka.yarat',   'Marka yarat (alias)','Anbar',  'brend.yarat-ın aliası — tam formada açmaq'),
  ('anbar.yarat',   'Anbar yarat',        'Anbar',  'Sürətli anbar yarat — satış/alış/transferdə inline'),
  ('ayar.qiymet',   'Qiymət növü idarə',  'Ayarlar','Qiymət növləri (topdan, perakende, VIP) yarat/redaktə')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad IN ('sahibkar', 'admin', 'director')
   AND i.kod IN ('brend.yarat', 'marka.yarat', 'anbar.yarat', 'ayar.qiymet')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer → hamısı (idarəetmə üçün)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'manecer'
   AND i.kod IN ('brend.yarat', 'marka.yarat', 'anbar.yarat', 'ayar.qiymet')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Anbardar → brend + anbar (məhsul/anbar əməliyyatları)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM roles r
  CROSS JOIN icazeler i
 WHERE r.ad = 'anbardar'
   AND i.kod IN ('brend.yarat', 'marka.yarat', 'anbar.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── mənbə: 2026-06-11-icmal-permissions.sql ───
-- ============================================================================
-- Modul icmal (modulun öz dashboardu) icazələri
-- ============================================================================
-- İcmal səhifəsi 2 qatla idarə olunur:
--   1) Ayarlar → Görünüş → "Modulun öz dashboardu" (sahibkar, biznes üzrə)
--   2) Rol icazəsi: icmal.<modul> (sahibkar/admin/direktor bypass)
-- Bu kodlar rol icazələri UI-da görünür və adi rollara verilə bilər.
--
-- İcra (prod): psql "$DATABASE_URL" -f scripts/migrations/2026-06-11-icmal-permissions.sql
-- ============================================================================

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('icmal.ticaret', 'Ticarət icmalı',  'İcmal', 'Ticarət modulunun KPI/icmal səhifəsini görür'),
  ('icmal.anbar',   'Anbar icmalı',    'İcmal', 'Anbar modulunun KPI/icmal səhifəsini görür'),
  ('icmal.maliyye', 'Maliyyə icmalı',  'İcmal', 'Maliyyə modulunun KPI/icmal səhifəsini görür'),
  ('icmal.elaqe',   'Əlaqə icmalı',    'İcmal', 'Müştərilər modulunun KPI/icmal səhifəsini görür')
ON CONFLICT (kod) DO NOTHING;

-- ─── Tam-giriş rolesı: bütün kodlar (platform.admin xaric) ───
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
 WHERE lower(r.ad) IN ('sahibkar', 'admin', 'director')
   AND i.kod <> 'platform.admin'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── HISSE 2: qalan app kodları (alias + migrasiyasız modullar) ───
INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('alis.idare', 'alis.idare', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('alis.legv', 'alis.legv', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('alis.qebul', 'alis.qebul', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('anbar.gor', 'anbar.gor', 'Anbar', 'Auto: sxem köçürmə tamamlanması'),
  ('anbar.idare', 'anbar.idare', 'Anbar', 'Auto: sxem köçürmə tamamlanması'),
  ('anbar.kateqoriya_idare', 'anbar.kateqoriya_idare', 'Anbar', 'Auto: sxem köçürmə tamamlanması'),
  ('anbar.view', 'anbar.view', 'Anbar', 'Auto: sxem köçürmə tamamlanması'),
  ('audit.view', 'audit.view', 'Digər', 'Auto: sxem köçürmə tamamlanması'),
  ('audit_log.sil', 'audit_log.sil', 'Digər', 'Auto: sxem köçürmə tamamlanması'),
  ('avto.view', 'avto.view', 'Digər', 'Auto: sxem köçürmə tamamlanması'),
  ('ayar.abune', 'ayar.abune', 'Digər', 'Auto: sxem köçürmə tamamlanması'),
  ('ayar.api_key', 'ayar.api_key', 'Digər', 'Auto: sxem köçürmə tamamlanması'),
  ('ayar.backup', 'ayar.backup', 'Digər', 'Auto: sxem köçürmə tamamlanması'),
  ('ayar.kanal', 'ayar.kanal', 'Digər', 'Auto: sxem köçürmə tamamlanması'),
  ('ayar.rol_idare', 'ayar.rol_idare', 'Digər', 'Auto: sxem köçürmə tamamlanması'),
  ('ayar.view', 'ayar.view', 'Digər', 'Auto: sxem köçürmə tamamlanması'),
  ('bank.import', 'bank.import', 'Maliyyə', 'Auto: sxem köçürmə tamamlanması'),
  ('bron.idare', 'bron.idare', 'Anbar', 'Auto: sxem köçürmə tamamlanması'),
  ('elaqe.yarat', 'elaqe.yarat', 'Müştərilər', 'Auto: sxem köçürmə tamamlanması'),
  ('fin_op.idare', 'fin_op.idare', 'Maliyyə', 'Auto: sxem köçürmə tamamlanması'),
  ('fin_op.legv', 'fin_op.legv', 'Maliyyə', 'Auto: sxem köçürmə tamamlanması'),
  ('fin_op.tesdiq', 'fin_op.tesdiq', 'Maliyyə', 'Auto: sxem köçürmə tamamlanması'),
  ('hesab.oxu', 'hesab.oxu', 'Maliyyə', 'Auto: sxem köçürmə tamamlanması'),
  ('hesabat.gor', 'hesabat.gor', 'Hesabatlar', 'Auto: sxem köçürmə tamamlanması'),
  ('hesabat.idare', 'hesabat.idare', 'Hesabatlar', 'Auto: sxem köçürmə tamamlanması'),
  ('hesabat.view', 'hesabat.view', 'Hesabatlar', 'Auto: sxem köçürmə tamamlanması'),
  ('hr.view', 'hr.view', 'Əməkdaşlar', 'Auto: sxem köçürmə tamamlanması'),
  ('inventar.idare', 'inventar.idare', 'Anbar', 'Auto: sxem köçürmə tamamlanması'),
  ('kampaniya.view', 'kampaniya.view', 'CRM', 'Auto: sxem köçürmə tamamlanması'),
  ('komissiya.idare', 'komissiya.idare', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('konsiqnasiya.idare', 'konsiqnasiya.idare', 'Anbar', 'Auto: sxem köçürmə tamamlanması'),
  ('kredit.odenis', 'kredit.odenis', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('maliye.gor', 'maliye.gor', 'Maliyyə', 'Auto: sxem köçürmə tamamlanması'),
  ('maliye.idare', 'maliye.idare', 'Maliyyə', 'Auto: sxem köçürmə tamamlanması'),
  ('maliye.view', 'maliye.view', 'Maliyyə', 'Auto: sxem köçürmə tamamlanması'),
  ('maliyye.export', 'maliyye.export', 'Maliyyə', 'Auto: sxem köçürmə tamamlanması'),
  ('maliyye.freeze', 'maliyye.freeze', 'Maliyyə', 'Auto: sxem köçürmə tamamlanması'),
  ('maliyye.idare', 'maliyye.idare', 'Maliyyə', 'Auto: sxem köçürmə tamamlanması'),
  ('marketing.view', 'marketing.view', 'CRM', 'Auto: sxem köçürmə tamamlanması'),
  ('marketplace.view', 'marketplace.view', 'Marketplace', 'Auto: sxem köçürmə tamamlanması'),
  ('maya.gor', 'maya.gor', 'Anbar', 'Auto: sxem köçürmə tamamlanması'),
  ('mehsul.idare', 'mehsul.idare', 'Anbar', 'Auto: sxem köçürmə tamamlanması'),
  ('menfeet.gor', 'menfeet.gor', 'Maliyyə', 'Auto: sxem köçürmə tamamlanması'),
  ('musteri.create', 'musteri.create', 'Müştərilər', 'Auto: sxem köçürmə tamamlanması'),
  ('musteri.idare', 'musteri.idare', 'Müştərilər', 'Auto: sxem köçürmə tamamlanması'),
  ('pos.istifade', 'pos.istifade', 'POS', 'Auto: sxem köçürmə tamamlanması'),
  ('pos.sell_no_stock', 'pos.sell_no_stock', 'POS', 'Auto: sxem köçürmə tamamlanması'),
  ('pos.view', 'pos.view', 'POS', 'Auto: sxem köçürmə tamamlanması'),
  ('qiymet.idare', 'qiymet.idare', 'Anbar', 'Auto: sxem köçürmə tamamlanması'),
  ('recurring.icra', 'recurring.icra', 'Maliyyə', 'Auto: sxem köçürmə tamamlanması'),
  ('recurring.idare', 'recurring.idare', 'Maliyyə', 'Auto: sxem köçürmə tamamlanması'),
  ('sahibkar.access', 'sahibkar.access', 'Digər', 'Auto: sxem köçürmə tamamlanması'),
  ('sales.over_credit', 'sales.over_credit', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('satinalma.view', 'satinalma.view', 'Anbar', 'Auto: sxem köçürmə tamamlanması'),
  ('satis.export', 'satis.export', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('satis.formal', 'satis.formal', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('satis.freeze', 'satis.freeze', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('satis.gor', 'satis.gor', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('satis.idare', 'satis.idare', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('satis.odenis', 'satis.odenis', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('servis.bildiris', 'servis.bildiris', 'Servis', 'Auto: sxem köçürmə tamamlanması'),
  ('servis.diaqnostika', 'servis.diaqnostika', 'Servis', 'Auto: sxem köçürmə tamamlanması'),
  ('servis.ehtiyat', 'servis.ehtiyat', 'Servis', 'Auto: sxem köçürmə tamamlanması'),
  ('servis.export', 'servis.export', 'Servis', 'Auto: sxem köçürmə tamamlanması'),
  ('servis.fayl', 'servis.fayl', 'Servis', 'Auto: sxem köçürmə tamamlanması'),
  ('servis.freeze', 'servis.freeze', 'Servis', 'Auto: sxem köçürmə tamamlanması'),
  ('servis.idare', 'servis.idare', 'Servis', 'Auto: sxem köçürmə tamamlanması'),
  ('servis.kilid', 'servis.kilid', 'Servis', 'Auto: sxem köçürmə tamamlanması'),
  ('servis.odenis', 'servis.odenis', 'Servis', 'Auto: sxem köçürmə tamamlanması'),
  ('servis.status', 'servis.status', 'Servis', 'Auto: sxem köçürmə tamamlanması'),
  ('servis.teklif', 'servis.teklif', 'Servis', 'Auto: sxem köçürmə tamamlanması'),
  ('servis.view', 'servis.view', 'Servis', 'Auto: sxem köçürmə tamamlanması'),
  ('servis.yarat', 'servis.yarat', 'Servis', 'Auto: sxem köçürmə tamamlanması'),
  ('stok.duzelt', 'stok.duzelt', 'Anbar', 'Auto: sxem köçürmə tamamlanması'),
  ('teklif.bron', 'teklif.bron', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('teklif.cevir', 'teklif.cevir', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('teklif.idare', 'teklif.idare', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('teklif.sil', 'teklif.sil', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('teklif.yenile', 'teklif.yenile', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('tesdiq.oxu', 'tesdiq.oxu', 'Servis', 'Auto: sxem köçürmə tamamlanması'),
  ('tesdiq.view', 'tesdiq.view', 'Servis', 'Auto: sxem köçürmə tamamlanması'),
  ('ticaret.view', 'ticaret.view', 'Ticarət', 'Auto: sxem köçürmə tamamlanması'),
  ('webhook.view', 'webhook.view', 'Marketplace', 'Auto: sxem köçürmə tamamlanması'),
  ('xerc.kateqoriya', 'xerc.kateqoriya', 'Maliyyə', 'Auto: sxem köçürmə tamamlanması'),
  ('zemanet.idare', 'zemanet.idare', 'Servis', 'Auto: sxem köçürmə tamamlanması')
ON CONFLICT (kod) DO NOTHING;

INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
 WHERE lower(r.ad) = 'anbardar' AND i.kod IN ('alis.idare', 'alis.legv', 'alis.qebul', 'anbar.gor', 'anbar.idare', 'anbar.kateqoriya_idare', 'anbar.view', 'bron.idare', 'inventar.idare', 'konsiqnasiya.idare', 'mehsul.idare', 'qiymet.idare', 'satinalma.view', 'stok.duzelt', 'ticaret.view')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
 WHERE lower(r.ad) = 'manecer' AND i.kod IN ('alis.idare', 'alis.legv', 'alis.qebul', 'anbar.gor', 'anbar.idare', 'anbar.kateqoriya_idare', 'anbar.view', 'bron.idare', 'elaqe.yarat', 'fin_op.idare', 'fin_op.legv', 'fin_op.tesdiq', 'hesab.oxu', 'hesabat.gor', 'hesabat.idare', 'hesabat.view', 'hr.view', 'inventar.idare', 'kampaniya.view', 'komissiya.idare', 'konsiqnasiya.idare', 'kredit.odenis', 'maliye.gor', 'maliye.idare', 'maliye.view', 'maliyye.export', 'maliyye.freeze', 'maliyye.idare', 'marketing.view', 'marketplace.view', 'maya.gor', 'mehsul.idare', 'menfeet.gor', 'musteri.create', 'musteri.idare', 'pos.istifade', 'pos.sell_no_stock', 'pos.view', 'qiymet.idare', 'recurring.icra', 'recurring.idare', 'sales.over_credit', 'satinalma.view', 'satis.export', 'satis.formal', 'satis.freeze', 'satis.gor', 'satis.idare', 'satis.odenis', 'servis.bildiris', 'servis.diaqnostika', 'servis.ehtiyat', 'servis.export', 'servis.fayl', 'servis.freeze', 'servis.idare', 'servis.kilid', 'servis.odenis', 'servis.status', 'servis.teklif', 'servis.view', 'servis.yarat', 'stok.duzelt', 'teklif.bron', 'teklif.cevir', 'teklif.idare', 'teklif.sil', 'teklif.yenile', 'tesdiq.oxu', 'tesdiq.view', 'ticaret.view', 'webhook.view', 'xerc.kateqoriya', 'zemanet.idare')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
 WHERE lower(r.ad) = 'muhasib' AND i.kod IN ('alis.idare', 'alis.legv', 'alis.qebul', 'anbar.gor', 'anbar.idare', 'anbar.kateqoriya_idare', 'anbar.view', 'bank.import', 'fin_op.idare', 'fin_op.legv', 'fin_op.tesdiq', 'hesab.oxu', 'hesabat.gor', 'hesabat.idare', 'hesabat.view', 'komissiya.idare', 'kredit.odenis', 'maliye.gor', 'maliye.idare', 'maliye.view', 'maliyye.export', 'maliyye.freeze', 'maliyye.idare', 'maya.gor', 'menfeet.gor', 'recurring.icra', 'recurring.idare', 'satinalma.view', 'ticaret.view', 'xerc.kateqoriya')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
 WHERE lower(r.ad) = 'satici' AND i.kod IN ('bron.idare', 'elaqe.yarat', 'musteri.create', 'musteri.idare', 'pos.istifade', 'pos.sell_no_stock', 'pos.view', 'sales.over_credit', 'satis.export', 'satis.formal', 'satis.freeze', 'satis.gor', 'satis.idare', 'satis.odenis', 'teklif.bron', 'teklif.cevir', 'teklif.idare', 'teklif.sil', 'teklif.yenile', 'ticaret.view')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
 WHERE lower(r.ad) = 'smm' AND i.kod IN ('kampaniya.view', 'marketing.view')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
 WHERE lower(r.ad) = 'kassir' AND i.kod IN ('pos.istifade', 'pos.sell_no_stock', 'pos.view', 'satis.export', 'satis.formal', 'satis.freeze', 'satis.gor', 'satis.idare', 'satis.odenis', 'ticaret.view')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
 WHERE lower(r.ad) = 'servisci' AND i.kod IN ('servis.bildiris', 'servis.diaqnostika', 'servis.ehtiyat', 'servis.export', 'servis.fayl', 'servis.freeze', 'servis.idare', 'servis.kilid', 'servis.odenis', 'servis.status', 'servis.teklif', 'servis.view', 'servis.yarat', 'zemanet.idare')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- ─── HISSE 3: tam-giriş rolları (sahibkar/admin/director) — hamısı ───
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id FROM roles r CROSS JOIN icazeler i
 WHERE lower(r.ad) IN ('sahibkar', 'admin', 'director')
   AND i.kod <> 'platform.admin'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

COMMIT;