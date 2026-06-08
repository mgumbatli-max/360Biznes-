-- ============================================================================
-- Marketplace & Webhook modulu icazələri
-- ============================================================================
BEGIN;

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
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('sahibkar', 'admin', 'direktor')
   AND (i.kod LIKE 'marketplace.%' OR i.kod LIKE 'webhook.%' OR i.kod = 'social.publish')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('marketing_menecer', 'marketing')
   AND i.kod IN ('marketplace.oxu', 'marketplace.idare', 'marketplace.sync', 'social.publish')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('menecer', 'team_lead')
   AND i.kod IN ('marketplace.oxu')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

COMMIT;
