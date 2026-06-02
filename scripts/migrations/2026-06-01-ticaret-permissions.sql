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

BEGIN;

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
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('sahibkar', 'admin', 'direktor')
   AND (i.kod = 'ticaret.oxu' OR i.kod LIKE 'satis.%' OR i.kod LIKE 'alis.%'
        OR i.kod LIKE 'qaytarma.%' OR i.kod LIKE 'teklif.%' OR i.kod LIKE 'kredit.%'
        OR i.kod IN ('pipeline.oxu', 'market.oxu'))
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer → hamısı (sil/legv istisna)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'menecer'
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
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'satici'
   AND i.kod IN (
     'ticaret.oxu', 'satis.oxu', 'satis.yarat',
     'teklif.oxu', 'teklif.yarat', 'pipeline.oxu', 'qaytarma.oxu'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Kassir → satış oxu (POS əməliyyatları)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'kassir'
   AND i.kod IN ('ticaret.oxu', 'satis.oxu', 'qaytarma.oxu', 'qaytarma.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Anbardar → alış / qaytarma (mal qəbulu)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'anbardar'
   AND i.kod IN ('ticaret.oxu', 'alis.oxu', 'alis.yarat', 'qaytarma.oxu', 'qaytarma.yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib → bütün oxu
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'muhasib'
   AND i.kod IN (
     'ticaret.oxu', 'satis.oxu', 'alis.oxu', 'qaytarma.oxu',
     'teklif.oxu', 'pipeline.oxu', 'kredit.oxu', 'market.oxu'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

COMMIT;
