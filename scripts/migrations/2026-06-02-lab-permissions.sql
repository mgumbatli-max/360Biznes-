-- ============================================================================
-- 360 LAB modulu icazələri
-- ============================================================================
BEGIN;

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('lab.view',  'Lab oxu',        '360 LAB', 'Lab kataloqu oxu + feature aktivləşdirmə (öz hesabında)'),
  ('lab.idare', 'Lab whitelist',  '360 LAB', 'Tenant səviyyəsində whitelist (hansı feature-lar açıq)'),
  ('lab.rate',  'Lab rating',     '360 LAB', 'Feature-ə rating/comment vermə')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar/admin/direktor — hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('sahibkar', 'admin', 'direktor')
   AND i.kod LIKE 'lab.%'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Bütün adi əməkdaşlar — Lab view + rate
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('menecer', 'team_lead', 'satici', 'kassir', 'marketing_menecer', 'hr_menecer', 'muhasib')
   AND i.kod IN ('lab.view', 'lab.rate')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

COMMIT;
