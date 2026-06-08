-- ============================================================================
-- Team / Söhbət modulu icazələri
-- ============================================================================
BEGIN;

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('team.kanal_yarat', 'Kanal yarat',       'Team', 'Yeni söhbət kanalı yarat'),
  ('team.idare',       'Team ayarları',     'Team', 'Təşkilat səviyyəli team ayarları (retention, auto-channels)'),
  ('team.broadcast',   'Team broadcast',    'Team', 'Bütün kanal üzvlərinə toplu bildiriş')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar/admin/direktor — bütün team icazələri
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('sahibkar', 'admin', 'direktor')
   AND i.kod LIKE 'team.%'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Adi əməkdaş — yalnız kanal yarat (lider olmaq üçün)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('menecer', 'team_lead', 'hr_menecer', 'marketing_menecer')
   AND i.kod IN ('team.kanal_yarat')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

COMMIT;
