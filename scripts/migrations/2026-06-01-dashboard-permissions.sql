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

BEGIN;

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

COMMIT;
