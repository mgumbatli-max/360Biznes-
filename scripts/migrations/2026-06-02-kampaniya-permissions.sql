-- ============================================================================
-- Kampaniyalar modulu icazələri — kupon, loyalty, hədiyyə kartı, broadcast
-- ============================================================================
-- Kampaniya modulu pul ekvivalentini (bonus balans, gift card, endirim)
-- idarə edir. Yanlış icazə = real maliyyə zərəri.
-- ============================================================================

BEGIN;

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
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('sahibkar', 'admin', 'direktor')
   AND (i.kod LIKE 'kampaniya.%' OR i.kod LIKE 'marketing.%'
        OR i.kod LIKE 'loyalty.%' OR i.kod LIKE 'gift.%')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Marketing menecer — balans və silmə xaric hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('marketing_menecer', 'marketing')
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
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('muhasib')
   AND i.kod IN ('kampaniya.oxu', 'loyalty.idare', 'loyalty.balans', 'gift.idare')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer — yalnız oxu
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('menecer', 'team_lead')
   AND i.kod IN ('kampaniya.oxu')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- POS kassiri — yalnız oxu (kart axtarış üçün)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('kassir', 'satici')
   AND i.kod IN ('kampaniya.oxu')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

COMMIT;
