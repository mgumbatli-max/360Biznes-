-- ============================================================================
-- HR (Əməkdaşlar) modulu icazələri — payroll, attendance, vacation, discipline
-- ============================================================================
-- HR modulu həssas məlumatları idarə edir: maaş, bank, FİN, davamiyyət, cərimə.
-- Default-da yalnız sahibkar/admin/direktor görür/idarə edir.
-- ============================================================================

BEGIN;

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
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('sahibkar', 'admin', 'direktor', 'hr_direktor')
   AND (i.kod LIKE 'isci.%' OR i.kod LIKE 'maas.%' OR i.kod LIKE 'davamiyyet.%'
        OR i.kod LIKE 'mezuniyyet.%' OR i.kod LIKE 'vakansiya.%' OR i.kod LIKE 'treninq.%'
        OR i.kod LIKE 'hr.%')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- HR menecer / kadrlar rolu — bonus idarə xaric hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('hr_menecer', 'kadrlar', 'hr_uzmani')
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
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('menecer', 'team_lead')
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
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('isci', 'kassir', 'satici', 'menecher')
   AND i.kod IN ('mezuniyyet.istek')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

COMMIT;
