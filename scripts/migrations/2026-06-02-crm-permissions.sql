-- ============================================================================
-- CRM / Mesaj Mərkəzi modulu icazələri
-- ============================================================================
BEGIN;

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('crm.oxu',         'CRM oxu',            'CRM',       'Dashboard, inbox, lead siyahısı oxu'),
  ('crm.idare',       'CRM idarə',          'CRM',       'Ümumi CRM idarəetmə (hamı görür)'),
  ('mesaj.cevab',     'Söhbətə cavab',      'CRM',       'İnbox söhbətə cavab göndər'),
  ('mesaj.idare',     'Söhbət idarə',       'CRM',       'Başqasının söhbətini görüntülə/redaktə (admin)'),
  ('lead.yarat',      'Lead yarat',         'CRM',       'Yeni lead əlavə et'),
  ('lead.idare',      'Lead idarə',         'CRM',       'Lead status dəyiş, mərhələ keçidi'),
  ('lead.sil',        'Lead arxiv',         'CRM',       'Lead arxivlə (soft delete)'),
  ('broadcast.idare', 'Broadcast kampaniya','CRM',       'Toplu mesaj kampaniyası yarat/göndər (pul ekvivalentli)'),
  ('sablon.idare',    'Mesaj şablonu',      'CRM',       'Mesaj şablonu yarat/redaktə/sil'),
  ('segment.idare',   'Seqment idarə',      'CRM',       'Müştəri seqmenti yarat/redaktə'),
  ('ai.istifade',     'AI istifadə',        'AI',        'AI cavab təklifi, AI seqment təklifi')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar/admin/direktor — bütün CRM icazələri
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('sahibkar', 'admin', 'direktor')
   AND (i.kod LIKE 'crm.%' OR i.kod LIKE 'mesaj.%' OR i.kod LIKE 'lead.%'
        OR i.kod LIKE 'broadcast.%' OR i.kod LIKE 'sablon.%'
        OR i.kod LIKE 'segment.%' OR i.kod = 'ai.istifade')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Marketing menecer — broadcast/sablon/seqment xaric hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('marketing_menecer', 'marketing')
   AND i.kod IN (
     'crm.oxu', 'crm.idare', 'mesaj.cevab',
     'lead.yarat', 'lead.idare',
     'broadcast.idare', 'sablon.idare', 'segment.idare',
     'ai.istifade'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Satış meneceri — lead/inbox idarə, broadcast yox
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('satis_meneceri', 'menecer', 'team_lead')
   AND i.kod IN (
     'crm.oxu', 'mesaj.cevab',
     'lead.yarat', 'lead.idare',
     'sablon.idare', 'ai.istifade'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Adi satıcı / kassir — yalnız öz lead/söhbəti
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('satici', 'kassir')
   AND i.kod IN ('crm.oxu', 'mesaj.cevab', 'lead.yarat', 'ai.istifade')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

COMMIT;
