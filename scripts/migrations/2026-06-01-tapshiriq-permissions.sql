-- ============================================================================
-- M: Tapşırıqlar modulu icazələri — rol-əsaslı tapşırıq idarəsi
-- ============================================================================
-- Default: hər kəs öz tapşırıqlarını görür (tapshiriq.oxu), amma yaratmaq /
-- başqasına atamak / silmək kimi əməliyyatlar rol əsaslıdır.
-- ============================================================================

BEGIN;

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
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('sahibkar', 'admin', 'direktor')
   AND i.kod LIKE 'tapshiriq.%'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer: yarat, atayar, layihə, statistika
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'menecer'
   AND i.kod IN ('tapshiriq.oxu', 'tapshiriq.yarat', 'tapshiriq.atayir', 'tapshiriq.layihe', 'tapshiriq.statistika')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Adi əməkdaş / kassir / satıcı: yalnız oxu + öz tapşırığı üçün yarat
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('kassir', 'satici', 'emekdas', 'anbardar')
   AND i.kod IN ('tapshiriq.oxu', 'tapshiriq.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

COMMIT;
