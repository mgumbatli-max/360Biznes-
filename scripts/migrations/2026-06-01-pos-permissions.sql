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

BEGIN;

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
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('sahibkar', 'admin', 'direktor')
   AND i.kod LIKE 'pos.%'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Kassir rolu üçün əsas POS icazələri (görünüş icazələri istisna olmaqla)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('kassir', 'satici')
   AND i.kod IN (
     'pos.access', 'pos.satis', 'pos.session_open',
     'pos.discount', 'pos.print_receipt', 'pos.credit_sell'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

COMMIT;
