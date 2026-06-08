-- ============================================================================
-- M: Sürətli yaratma icazələri — brend, anbar, qiymət növü
-- ============================================================================
-- "Sürətli yarat" inline dialoq pattern üzrə:
--   /ticaret/satis-yeni, /ticaret/alis-yeni, məhsul forması, müştəri forması və s.
--   müvafiq referansı (brend, anbar, qiymət növü) inline yaratmaq imkanı.
-- Aşağıdakı icazələr `requireAnbarActionPerm` / `requireAyarActionPerm` tərəfindən
-- yoxlanılır. Sahibkar/admin/owner avtomatik keçir, digər rollar üçün burada
-- granular paylaşma.
-- ============================================================================

BEGIN;

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('brend.yarat',   'Brend yarat',        'Anbar',  'Sürətli brend (marka) yarat — məhsul formunda inline'),
  ('marka.yarat',   'Marka yarat (alias)','Anbar',  'brend.yarat-ın aliası — tam formada açmaq'),
  ('anbar.yarat',   'Anbar yarat',        'Anbar',  'Sürətli anbar yarat — satış/alış/transferdə inline'),
  ('ayar.qiymet',   'Qiymət növü idarə',  'Ayarlar','Qiymət növləri (topdan, perakende, VIP) yarat/redaktə')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('sahibkar', 'admin', 'direktor')
   AND i.kod IN ('brend.yarat', 'marka.yarat', 'anbar.yarat', 'ayar.qiymet')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer → hamısı (idarəetmə üçün)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'menecer'
   AND i.kod IN ('brend.yarat', 'marka.yarat', 'anbar.yarat', 'ayar.qiymet')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Anbardar → brend + anbar (məhsul/anbar əməliyyatları)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'anbardar'
   AND i.kod IN ('brend.yarat', 'marka.yarat', 'anbar.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

COMMIT;
