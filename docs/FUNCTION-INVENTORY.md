# 360Biznes — Function Inventory (Modul-modul status)

**Tarix:** 2026-05-11
**Mənbə:** `~/projects/360biznes/src/modules/` — 73 modul × ~250 endpoint

**Status legend:**
- ✅ **READY** — production-ready, tam işlək
- 🟡 **PARTIAL** — əsas funksiyalar var, ikinci dərəcəli işlər qalır
- ⚠️ **STUB** — boş və ya minimal, yenidən yazılmalı
- 🔁 **REPLACE** — köhnədir / deprecated, yenisi var (məs. ai-cavab v1 → v2)
- 🆕 **NEW** — Next.js-də yeni əlavə olunacaq (köhnədə yox idi)

---

## 1. AUTH & ACCESS CONTROL

| Modul | Status | Endpoint | DB cədvəllər | Qeyd |
|---|---|---|---|---|
| auth | ✅ | 16 | istifadeciler, roles, icazeler, rol_icazeleri, sahibkarlar, abuneler, abune_planlari, demo_trials, giris_cehdleri, ip_bloklari, istifadeci_giris_qaydalari | JWT + bcrypt + rate limit + IP block + login hours |
| rol | ⚠️ | ~3 | roles | Əsasən auth modulunda idarə olunur, bu STUB-dur |
| istifadeci-ayar | 🟡 | ~5 | istifadeciler.preferences | Personal settings (theme, lang, 2FA placeholder) |
| filial-ayar | 🟡 | ~4 | filiallar, filial_ayar | Branch-specific settings |
| **Next.js**: NextAuth Credentials + JWT + Redis session cache. 2FA TOTP əlavə (yeni). Refresh token (yeni). |

---

## 2. CORE OPERATIONS — INVENTORY

| Modul | Status | Endpoint | DB cədvəllər | Qeyd |
|---|---|---|---|---|
| anbar | ✅ | ~20 | anbarlar, stok, anbar_hereketleri, anbar_qaliq | FIFO cost, FOR UPDATE locks, transfer/hereket logu |
| anbar-ayar | 🟡 | ~4 | anbar_ayarlari | Valuation method, transfer rules |
| mehsul-import | ✅ | ~6 | import_partiyalari, import_satirlari | Excel upload + mapping wizard + rollback |
| marka | ✅ | ~4 | markalar | Brand master |
| transfer | ✅ | ~6 | transferlari, transfer_satirlari, stok | Inter-warehouse |
| inventar | ✅ | ~7 | inventar_sayim, inventar_satirlari, stok, anomali_loqu | Physical count + variance |
| anomali | ✅ | ~5 | anomaliler, anomali_tarixi | Discrepancy log |
| rezerv | ✅ | ~5 | rezervleri, stok | Stock reservation |
| serial | ✅ | ~6 | serial_numaralari, serial_tarixesi | IMEI/serial tracking |
| **Next.js**: TanStack Table + virtualized rows üçün böyük məhsul siyahıları. Optimistic UI stok hərəkəti üçün. |

---

## 3. CORE OPERATIONS — TRADE

| Modul | Status | Endpoint | DB cədvəllər | Qeyd |
|---|---|---|---|---|
| satis | ✅ | ~25 | satis_sifarisleri, satis_sifaris_satirlari, stok, kassa_emeliyyatlari, vergi_cekleri, odenis_jurnali | Stock lock, margin warning, marketplace commission, tax receipt |
| alis | ✅ | ~20 | alis_sifarisleri, alis_sifaris_satirlari, stok, kontragentler, odenis_jurnali | Multi-currency, landed cost, tariff |
| qaytarma | ✅ | ~10 | qaytarmalar, qaytarma_satirlari, stok | Full + quick return |
| kredit-satis | 🟡 | ~12 | kredit_satis, kredit_odeme_plani, kredit_odemeleri | Installment plans (3/6/12 ay) |
| ticaret | 🟡 | ~5 | ticaret_kategorileri, hs_kodlari | HS code lookup, packing list |
| ticaret-teklif | ✅ | ~8 | quotations (təxminən) | Quote → order conversion |
| pos | 🟡 | ~10 | satis_sifarisleri, kassa | POS-specific endpoints (overlap satis ilə) |
| **Next.js**: POS Server Action + optimistic cart. Margin warning UI. Klaviatura shortcut-lar (useHotkeys). |

---

## 4. FINANCE & ACCOUNTING (24+ modul)

| Modul | Status | Endpoint | DB cədvəllər | Qeyd |
|---|---|---|---|---|
| finance | ✅ | ~50+ (sub-route-lı) | accounts, journal_entries, transactions, debtor_aging, creditor_aging, exchange_rates, bank_accounts, dividends, writeoffs | AI variance analysis, double-entry, multi-currency |
| maliye-hesab | 🟡 | ~10 | tax_returns, tax_payments | VAT/corporate tax |
| odenis | ✅ | ~8 | odenis_jurnali | Global payment journal (auto-populated) |
| kassa | ✅ | ~15 | kassalar, kassa_siftalari, kassa_emeliyyatlari | Shift open/close, multi-currency |
| bank | ✅ | ~12 | bank_accounts, bank_statements, reconciliations, bank_transactions | OFX/CSV import + match |
| xerc | ✅ | ~10 | xercler, xerc_kateqoriyalari | Operating expenses |
| qiymet-merkez | 🟡 | ~10 | qiymet_kurallari, qiymet_tarixesi | Dynamic pricing (yeni əlavə) |
| rentabellik | ✅ | ~6 | (calc views) | Profitability analysis |
| kpi | 🟡 | ~8 | kpi_tanlari, kpi_hedefleri, kpi_natijeleri | KPI tracking |
| seqment | 🟡 | ~5 | seqmentleri, seqment_musterleri | Customer segmentation |
| **Next.js**: Server Action ilə complex query, Recharts üçün light chart-lar. AI variance analysis Claude SDK-dan. |

---

## 5. CRM & CONTACTS

| Modul | Status | Endpoint | DB cədvəllər | Qeyd |
|---|---|---|---|---|
| crm | ✅ | ~15 | kontragentler, sohbetler, sohbet_mesajlari, call_logs, email_logs | Funnel, conversation log, lead scoring |
| musteri (kontragentler) | ✅ | ~12 | kontragentler, kontragent_adresleri, kontragent_rehberi, kontragent_segmentleri | Unified customer+supplier master |
| inbox | ✅ | ~10 | inbox_mesajlari, inbox_konusu, template_cevaplari | Multi-channel (WhatsApp/Telegram/Instagram/SMS) |
| broadcast | ✅ | ~8 | broadcast_kampanyalari, broadcast_hedefleri, broadcast_teslimat_loqu | Mass campaigns + delivery tracking |
| mesaj-sablon | ✅ | ~6 | mesaj_ablonlari, ablonlarin_kullanilish_loqu | Templates with vars |
| musteri-cavab | 🟡 | ~5 | musteri_cavaplari, survey_sorulari, survey_cavaplari | NPS/CSAT/complaints |
| sosial-hesab | 🟡 | ~4 | sosial_hesaplar | IG/FB/WA Business/TG config |
| **Next.js**: Real-time inbox üçün WebSocket (mərhələ sonrası). Multi-channel webhook handler. |

---

## 6. AI MODULES

| Modul | Status | Endpoint | DB cədvəllər | Qeyd |
|---|---|---|---|---|
| ai-cavab-v2 | ✅ | ~5 | ai_sohbet_loqu, ai_prompt_log | Claude SDK, 9 üslub, conversion tracking |
| ai-cavab (v1) | 🔁 | - | - | Köhnədir, v2-yə yenilənib |
| ai-komekci | 🟡 | ~6 | ai_komekci_loqu, ai_komet_secimleri | Chatbot Q&A over data |
| ai-meslehetci | 🟡 | ~5 | ai_maslehetler, ai_maslehetci_loqu | Business advisor |
| **Next.js**: Claude SDK-nı `lib/ai/anthropic.ts`-ə wrapped. Streaming response (yeni). |

---

## 7. SERVICE & OPERATIONS

| Modul | Status | Endpoint | DB cədvəllər | Qeyd |
|---|---|---|---|---|
| servis | ✅ | ~15 | servis_sorgumlari, servis_satirlari, servis_teslimatlari, servis_sureci_loqu | Repair tickets, parts+labor, warranty lookup |
| zemanet | ✅ | ~10 | zemanetler, zemanet_sablonlari, zemanet_iddialar, zemanet_servisleri | QR public view, claim workflow |
| catdirilma | 🟡 | ~8 | catdirilma_emirleri, catdirilma_satirlari, kargo_durumlari | Shipping tracking |
| satinalma | 🟡 | ~6 | satinalma_talepleri, satinalma_sifarisleri | Procurement (RFQ → PO) |
| operativ (gun-sonu) | ✅ | ~6 | gun_sonu_rapor, gun_sonu_kontrolleri | EOD reconciliation |
| tesdiq | ✅ | ~8 | tesdiq_talepleri, tesdiq_kuyrugu, tesdiq_tarixi | Approval workflow |
| tesdiq-merkez | ✅ | ~5 | (same as tesdiq + views) | Centralized approval dashboard |
| **Next.js**: Server Action + audit log + escalation worker. |

---

## 8. TASKS & HR

| Modul | Status | Endpoint | DB cədvəllər | Qeyd |
|---|---|---|---|---|
| tapshiriq | ✅ | ~20 | tapshirlari, tapshiriq_iscileri, tapshiriq_notlari, tapshiriq_escalations | Yaradan/mesul/icraçi/müşahidəçi, auto-escalation |
| tapshiriq-tekrar | ✅ | ~10 | tapshiriq_sekinleri, checklist_maddesi, checklist_tamamlama | Recurring + checklist |
| iscilier | 🟡 | ~15 | iscilier, isci_roller, isci_maas, isci_devam | 360° employee mgmt |
| (maas) | 🟡 | within iscilier | isci_maas | Payroll |
| (davamiyyet) | 🟡 | within iscilier | isci_devam | Attendance |
| (mezuniyyet) | 🟡 | within iscilier | leave_records | Vacation |
| **Next.js**: Drag-drop kanban (DnD Kit). WhatsApp reminder worker. |

---

## 9. REPORTS & ANALYTICS

| Modul | Status | Endpoint | DB cədvəllər | Qeyd |
|---|---|---|---|---|
| hesabat | ✅ | ~30 | (view-based, queries over operational tables) | 10+ sub-report, Excel export, AI summary |
| anomali | ✅ | already in inventory section | - | (inventar anomalisi ilə eyni) |
| data-saglamliq | 🟡 | ~6 | data_saglamliq_kontrolleri, data_saglamliq_ihlallari | Data quality checks |
| search | ✅ | ~3 | (indexed across tables) | Unified ILIKE search |
| print | ✅ | ~10 | (queries) | HTML invoices/receipts/labels for browser print |
| mobil-dashboard | ✅ | ~3 | (aggregations) | Mobile KPI dashboard (compact JSON) |
| alerts | ✅ | ~8 | alerts, alert_categories | Notification rules + delivery |
| **Next.js**: Excel export via `exceljs` (server-side). Print → React-PDF və ya printable route. |

---

## 10. SETTINGS

| Modul | Status | Endpoint | DB cədvəllər | Qeyd |
|---|---|---|---|---|
| ayar | ✅ | ~8 | ayarlar (key-value) | umumi, default, maliye, notification group |
| kompaniya | 🟡 | ~5 | kompaniyalar | Multi-company support |
| bildiris | ✅ | ~10 | bildiris_ablonlari, bildiris_hedefleri, bildiris_loqu | Templates + delivery |
| bildiris-ayar | ✅ | ~5 | bildiris_tercih, bildiris_silme_siyahisi | User notification prefs |
| qeyd | ✅ | ~6 | qeydleri (polymorphic) | Notes attached to any document |
| filial | ✅ | ~8 | filiallar | Multi-branch |
| **Next.js**: 20+ ayar səhifəsini hub layout + card grid ilə. |

---

## 11. INTEGRATIONS

| Modul | Status | Endpoint | DB cədvəllər | Qeyd |
|---|---|---|---|---|
| marketplace | ✅ | ~15 | marketplace_baglantilari, marketplace_katalog_xrefleri, marketplace_sifarisleri | Birmarket, Umico, Wolt, Tap, Lalafo adapter-ləri |
| marketplace-mag | ✅ | ~5 | marketplace_magazalar, marketplace_magaza_ayarlari | Shop profile |
| marketplace-satis | ✅ | ~6 | marketplace_sifarisleri | Order fulfillment |
| webhook | ✅ | ~6 | webhook_config, webhook_loqu | Outgoing webhooks |
| webhook-api (`/v1`) | ✅ | ~3 | (writes to operational) | Public incoming webhook endpoint |
| gizli-alish | 🟡 | ~5 | gizli_alish_atama, gizli_alish_rapor | Mystery shopper |
| **Next.js**: Adapter pattern in `lib/services/marketplace/`. Webhook signing + retry. |

---

## 12. PLATFORM & SAAS

| Modul | Status | Endpoint | DB cədvəllər | Qeyd |
|---|---|---|---|---|
| saas | ✅ | ~5 | (aggregations) | Passive reporting (tenant metrics) |
| sahibkar | ✅ | ~30 (sub-routes) | (per-tenant aggregations) | PIN-protected dashboard |
| platform-admin | ✅ | ~12 | (aggregations + tenant CRUD) | Super-admin: tenants, MRR/ARR, demo bitir |
| backup | ✅ | ~6 | backup_loqu | Tenant data export |
| **Next.js**: Sahibkar PIN re-auth ilə layout group. Platform admin yalnız role=admin. |

---

## 13. AUTOMATION

| Modul | Status | Endpoint | DB cədvəllər | Qeyd |
|---|---|---|---|---|
| avto | ✅ | ~10 (CRUD) + engine | avto_qaydalari, avto_triggerler, avto_emeliyyatlari, avto_icra_loqu | 5 dəq cron engine, 11 trigger × 7 action |
| lab | 🟡 | ~3 | feature_flags, feature_flag_usage | Feature flag infrastructure |
| **Next.js**: BullMQ worker (`workers/automation-engine.ts`) + Redis. 11 trigger handler. |

---

## YEKUN STATİSTİKA

| Status | Sayı | Faiz |
|---|---|---|
| ✅ READY | **45** modul | 62% |
| 🟡 PARTIAL | **20** modul | 27% |
| ⚠️ STUB | **6** modul | 8% |
| 🔁 REPLACE | **2** modul | 3% |

**Köçürmə qiymətləndirməsi (gün ilə təxmini):**
- Mərhələ 1-2 (Foundation + AppShell): 5-7 gün
- Mərhələ 3-6 (Dashboard, Alerts, POS, Tasks): 10-14 gün
- Mərhələ 7-11 (Anbar, Ticarət, Maliyyə, Əlaqələr, CRM): 25-35 gün
- Mərhələ 12-16 (İşçilər, Servis, Hesabat, Sahibkar, AI): 15-20 gün
- Mərhələ 17-19 (Landing, Platform, Ayarlar): 10-12 gün
- Mərhələ 20 (Data köçürmə + cutover): 3-5 gün

**Toplam:** ~70-95 iş günü (1 nəfər), paralel iş ilə 50-65 gün

---

## "ZƏIF" NÖQTƏLƏR (Next.js-də təkmilləşdiriləcək)

| Köhnə problem | Next.js həll |
|---|---|
| Manual `WHERE sahibkar_id` (~2500 yer) | Prisma extension avtomatik filter |
| In-memory session (sahibkar PIN) | Redis session store |
| Password reset email yox | Resend ilə email reset |
| 2FA yarımçıq | TOTP (Auth.js) |
| POS terminal hardware yox | Browser USB/serial API (yeni) |
| Permission per-request DB hit | Redis cache (5 dəq TTL) |
| File upload signed URL yox | Tenant-namespaced + signed URL |
| Page-level horizontal scroll | Sticky layout + content overflow-x-auto |
| Sidebar collapse yox | useState + lokal storage |
| Saved views yox | DB-də saved_filters (yeni cədvəl) |
| Optimistic UI yoxdur | React Query mutations + rollback |

---

## DEPRECATED / REMOVABLE

| Modul | Səbəb |
|---|---|
| ai-cavab (v1) | v2 əvəz edib |
| rol | auth daxilində birləşir |
| pos | satis daxilində birləşir (POS mode flag) |
| ticaret (köhnə) | satis + alis + ticaret-teklif daxilində |

---

**Növbəti sənəd:** `MIGRATION-PLAN.md` (əsas plan)
