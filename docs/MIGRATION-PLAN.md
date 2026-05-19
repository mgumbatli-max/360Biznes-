# 360Biznes — Next.js Migration Planı

**Tarix:** 2026-05-11
**Mənbə layihə:** `~/projects/360biznes/` (vanilla Node+Express+PostgreSQL)
**Hədəf layihə:** `~/projects/360biznes-next/` (Next.js + TypeScript + Prisma)
**Əsas prinsip:** Heç bir funksiya itməsin. Köhnə layihə paralel davam edir, ona TOXUNULMUR.

---

## 1. EXECUTIVE SUMMARY (Analiz nəticəsi)

Köhnə layihə dərin analiz edildi (4 paralel agent). Tapıntılar:

| Sahə | Statistika |
|---|---|
| Backend modulları | **73 modul** (`src/modules/`) |
| API endpoint-lər | **~250+** |
| DB cədvəlləri | **100+** (95 multi-tenant + 25 global) |
| Migration faylları | **72** (001→072) |
| Frontend HTML | **129 səhifə** |
| İcazə (permission) kodları | **130+** |
| Rollar | **6** (admin, muhasib, satici, anbardar, sahibkar, baxan) |
| Background scheduler | **4** (avto-engine, tapşırıq xatırlatma, escalation, alerts) |
| AI inteqrasiya | Anthropic Claude SDK 4 modulda |
| Marketplace inteqrasiya | Birmarket, Umico, Wolt, Tap, Lalafo |

**Nəticə:** Bu layihə artıq production-grade SaaS ERP-dir. "Sıfırdan yaz" deyil — köhnə business logic-i diqqətlə Next.js-ə köçürmək lazımdır.

---

## 2. ƏSAS QƏRARLAR (Decisions)

### 2.1 Migration variantı: **Variant A — Tam Next.js Rewrite**
- Express backend tamamilə Next.js API Routes + Server Actions ilə əvəz olunur
- Vanilla HTML səhifələr → React Server/Client Components
- Tək codebase, tək deploy
- Köhnə layihə paralel `~/projects/360biznes/` qovluğunda işləkdir

### 2.2 Tech Stack
| Sahə | Seçim | Səbəb |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | RSC + Server Actions + edge-ready |
| Dil | **TypeScript** | Type safety mütləqdir (130+ permission, 100+ cədvəl) |
| UI | **Tailwind CSS + shadcn/ui** | Müasir SaaS dizayn, dark theme |
| Dizayn | Mövcud indigo-purple gradient + glassmorphism | Köhnə brendi qoruyuruq |
| ORM | **Prisma** | Type-safe, multi-tenant middleware dəstəyi |
| DB | **PostgreSQL 15+** | Köhnə ilə uyğunluq |
| Auth | **NextAuth (Auth.js)** + Credentials provider | JWT əvəzinə session/JWT iki rejim |
| State | **Zustand** (filter/UI), **TanStack Query** (server) | Lokal storage filter modeli qorunur |
| Form | **React Hook Form + Zod** | Validation backend ilə paylaşılır |
| Tablo | **TanStack Table** + virtualization | Böyük data setləri |
| Charts | **Recharts** | Lightweight |
| File upload | **UploadThing** və ya custom | Tenant izolyasiyalı |
| AI | **@anthropic-ai/sdk** | Mövcudla eyni |
| Email/SMS | **Resend** + **Twilio** (sonra) | Native SMTP yerinə |
| Background jobs | **BullMQ + Redis** | Avto-engine 5 dəqiqəlik cron |
| Cache | **Redis** | Permission, session, RateLimit |
| Logging | **pino** | Mövcudla eyni |
| Deploy | **VPS + PM2** və ya **Vercel** + ayrı worker | Background job-lar üçün VPS daha uyğundur |

### 2.3 DB Strategiyası: **Yeni DB + Schema migrate, sonra data köçür**
- Yeni DB adı: `biznes_360_next`
- `prisma db pull` (introspect) ilə köhnə `biznes_360` sxemasını çıxarırıq → `schema.prisma`-ya çevirir
- Sxemanı təmizləyirik (snake_case naming-i qoruyuruq, lakin Prisma model-ləri PascalCase olur)
- Yeni DB-yə `prisma migrate dev` ilə tətbiq edirik
- **Data köçürmə skripti** ayrı yazılır: köhnə DB-dən yeni DB-yə ETL (mərhələ 14-də)
- Köhnə DB ilə paralel rejim mümkün olmur — yeni Next.js yeni DB-yə yazır
- Production-a keçidə qədər köhnə vanilla aktiv qalır

### 2.4 Sahibkar_id Multi-Tenant Yanaşması (KRİTİK)
Köhnə layihədə hər query-də manual `WHERE sahibkar_id=$1` (~2500 yer). Bu səhv riskli pattern.

Yeni Next.js-də **Prisma extension/middleware** ilə avtomatik filter:
```ts
// lib/db/prisma.ts
prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query, model }) {
        const tenantModels = ['Mehsul', 'Satis', /* ... */]
        if (tenantModels.includes(model)) {
          args.where = { ...args.where, sahibkar_id: getCurrentTenant() }
        }
        return query(args)
      }
    }
  }
})
```
Hər query avtomatik `sahibkar_id` filter alır → leak riski sıfıra düşür.

### 2.5 Auth model
- **NextAuth Credentials provider** + JWT strategy
- JWT payload: `{ id, rol_id, sahibkar_id, icazeler[] }`
- Server-side session cache (Redis, 5 dəq TTL) — permission yenidən yüklənməsin
- Refresh token əlavə olunur (köhnədə yox idi)
- Sahibkar gizli bölmə üçün PIN re-auth (köhnədəki kimi)
- IP blocking + login time rules + brute-force limit (mövcudla eyni)

---

## 3. QOVLUQ STRUKTURU (Sizin şablon əsasında)

```
~/projects/360biznes-next/
├─ app/
│  ├─ (public)/                         # Marketing + auth
│  │  ├─ page.tsx                       # Landing (index.html əvəzi)
│  │  ├─ paketler/page.tsx              # Pricing
│  │  ├─ demo/page.tsx
│  │  ├─ faq/page.tsx
│  │  ├─ login/page.tsx
│  │  ├─ qeydiyyat/page.tsx             # signup.html
│  │  └─ onboarding/page.tsx            # 15 günlük demo wizard
│  ├─ (dashboard)/
│  │  ├─ layout.tsx                     # Sidebar + Topbar shell (panel.html)
│  │  ├─ dashboard/page.tsx
│  │  ├─ xeberdarliqlar/                # Alerts
│  │  ├─ pos/                           # POS / İsti satış
│  │  ├─ tapshiriqlar/
│  │  ├─ avtomatlasdirma/
│  │  ├─ tesdiq/
│  │  ├─ anbar/
│  │  │  ├─ page.tsx                    # Dashboard
│  │  │  ├─ mehsullar/
│  │  │  ├─ markalar/
│  │  │  ├─ transfer/
│  │  │  ├─ inventar/
│  │  │  ├─ anomali/
│  │  │  ├─ rezerv/
│  │  │  ├─ konsiqnasiya/
│  │  │  ├─ qiymet/
│  │  │  └─ import/                     # Excel upload
│  │  ├─ ticaret/
│  │  │  ├─ satislar/
│  │  │  ├─ alislar/
│  │  │  ├─ qaytarma/
│  │  │  ├─ kredit/
│  │  │  └─ teklif/
│  │  ├─ satinalma/                     # Procurement planning
│  │  ├─ servis/
│  │  │  ├─ page.tsx
│  │  │  └─ zemanet/
│  │  ├─ maliyye/
│  │  │  ├─ page.tsx
│  │  │  ├─ kassalar/
│  │  │  ├─ bank/
│  │  │  ├─ xercler/
│  │  │  ├─ debitor/
│  │  │  ├─ kreditor/
│  │  │  ├─ vergi/
│  │  │  └─ hesabatlar/
│  │  ├─ elaqe/
│  │  │  ├─ musteriler/
│  │  │  ├─ techizatcilar/
│  │  │  └─ borclar/
│  │  ├─ crm/
│  │  │  ├─ page.tsx                    # Dashboard
│  │  │  ├─ inbox/
│  │  │  ├─ ai-cavab/
│  │  │  ├─ broadcast/
│  │  │  ├─ leadler/
│  │  │  ├─ followup/
│  │  │  ├─ segmentler/
│  │  │  └─ sablonlar/
│  │  ├─ iscilier/
│  │  │  ├─ page.tsx                    # Employee list
│  │  │  ├─ [id]/                       # 360° detail
│  │  │  ├─ maas/
│  │  │  ├─ davamiyyet/
│  │  │  ├─ mezuniyyet/
│  │  │  └─ kpi/
│  │  ├─ hesabatlar/
│  │  │  ├─ page.tsx                    # Hub
│  │  │  ├─ satis/
│  │  │  ├─ mehsul/
│  │  │  ├─ musteri/
│  │  │  ├─ stok/
│  │  │  ├─ maliye/
│  │  │  ├─ marketplace/
│  │  │  └─ ai/
│  │  ├─ ai/
│  │  │  ├─ komekci/
│  │  │  └─ meslehetci/
│  │  ├─ marketplace/                   # Integration hub (alt sidebar deyil)
│  │  ├─ webhook/                       # Webhook log
│  │  ├─ audit-log/
│  │  └─ ayarlar/
│  │     ├─ page.tsx                    # Hub
│  │     ├─ kompaniya/
│  │     ├─ filiallar/
│  │     ├─ istifadeciler/
│  │     ├─ rollar/
│  │     ├─ qiymet-tipi/
│  │     ├─ qiymet-siyaseti/
│  │     ├─ pos/
│  │     ├─ anbar/
│  │     ├─ bank/
│  │     ├─ xerc-kateqoriya/
│  │     ├─ sened-sablon/
│  │     ├─ bildiris/
│  │     ├─ marketplace/
│  │     └─ hesab/                      # Şəxsi
│  ├─ (sahibkar)/                       # PIN-protected
│  │  ├─ layout.tsx                     # Re-auth gate
│  │  ├─ sahibkar/page.tsx              # Dashboard
│  │  ├─ sahibkar/maya/
│  │  ├─ sahibkar/magaza/
│  │  ├─ sahibkar/audit/
│  │  ├─ sahibkar/snapshot/
│  │  ├─ sahibkar/partiya/
│  │  ├─ sahibkar/notlar/
│  │  └─ sahibkar/tapshiriq/
│  ├─ platform-admin/                   # Super-admin (system-level)
│  │  ├─ layout.tsx
│  │  ├─ page.tsx                       # Tenant list
│  │  ├─ tenantlar/[id]/
│  │  ├─ gelirler/
│  │  ├─ modul-istifade/
│  │  └─ demo-bitir/
│  └─ api/
│     ├─ auth/[...nextauth]/route.ts
│     ├─ anbar/
│     ├─ satis/
│     ├─ alis/
│     ├─ ... (hər modul üçün)
│     ├─ webhook/v1/                    # Public incoming webhooks
│     └─ ai/                            # Claude proxy
├─ components/
│  ├─ layout/
│  │  ├─ Sidebar.tsx
│  │  ├─ Topbar.tsx
│  │  ├─ Breadcrumb.tsx
│  │  ├─ NotificationBell.tsx
│  │  └─ CommandPalette.tsx             # ⌘K search
│  ├─ ui/                               # shadcn primitives
│  ├─ tables/
│  │  ├─ DataTable.tsx                  # TanStack + virtualization
│  │  ├─ ColumnManager.tsx
│  │  ├─ Pagination.tsx
│  │  └─ SavedViews.tsx
│  ├─ forms/
│  │  ├─ fields/                        # Text, Select, DatePicker, Money...
│  │  └─ FormShell.tsx
│  ├─ modals/
│  ├─ drawers/                          # Right-side 480px (köhnədə var)
│  ├─ charts/
│  └─ pos/                              # POS xüsusi komponentlər
├─ features/                            # Domain logic (server-only)
│  ├─ anbar/{actions,queries,validators,types}.ts
│  ├─ satis/
│  ├─ alis/
│  ├─ maliyye/
│  ├─ crm/
│  ├─ iscilier/
│  ├─ ai/
│  ├─ hesabat/
│  ├─ sahibkar/
│  └─ platform-admin/
├─ lib/
│  ├─ auth/
│  │  ├─ session.ts                     # NextAuth config
│  │  ├─ permissions.ts                 # icaze() helper
│  │  └─ rate-limit.ts
│  ├─ db/
│  │  ├─ prisma.ts                      # Prisma client + tenant middleware
│  │  └─ tenant.ts                      # getCurrentTenant() (AsyncLocalStorage)
│  ├─ permissions/
│  │  ├─ catalog.ts                     # 130+ permission code-ları (typed)
│  │  └─ check.ts                       # canDo(user, code)
│  ├─ ai/
│  │  └─ anthropic.ts                   # Claude SDK wrapper
│  ├─ audit.ts                          # Audit log helper
│  ├─ notify.ts                         # Bildiriş + WhatsApp queue
│  ├─ utils/
│  ├─ validations/                      # Zod schemas (paylaşılır)
│  └─ services/                         # External APIs (marketplace, bank)
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
├─ types/
│  ├─ db.ts                             # DB tip ixracı
│  └─ api.ts
├─ hooks/
│  ├─ usePermission.ts
│  ├─ useFilters.ts
│  └─ useColumnVisibility.ts
├─ stores/                              # Zustand
│  ├─ sidebar.ts
│  ├─ filters/                          # Per-page filter state
│  └─ ui.ts                             # Modal/drawer state
├─ workers/                             # Background jobs
│  ├─ automation-engine.ts              # 5 dəq cron
│  ├─ task-reminders.ts
│  ├─ escalation.ts
│  └─ alerts.ts
├─ middleware.ts                        # Auth + tenant gate
├─ next.config.ts
├─ tailwind.config.ts
├─ tsconfig.json
├─ docker-compose.yml                   # Postgres + Redis (dev)
├─ .env.example
└─ docs/
   ├─ MIGRATION-PLAN.md                 # (bu fayl)
   ├─ FUNCTION-INVENTORY.md
   └─ ARCHITECTURE.md (sonra)
```

---

## 4. SIDEBAR FINAL STRUKTUR (Sizin spec → modullar)

| Bölmə | Item | Mövcud modul(lar) | Yeni route |
|---|---|---|---|
| **ƏSAS** | Dashboard | hesabat dashboard + mobil-dashboard | `/dashboard` |
| | Xəbərdarlıqlar | alerts | `/xeberdarliqlar` |
| | POS / İsti satış | satis (POS), pos, kassa | `/pos` |
| | Tapşırıqlar | tapshiriq, tapshiriq-tekrar | `/tapshiriqlar` |
| | Avtomatlaşdırma | avto | `/avtomatlasdirma` |
| | Təsdiq Mərkəzi | tesdiq, tesdiq-merkez | `/tesdiq` |
| **ƏMƏLİYYAT** | Anbar | anbar, mehsul-import, marka, transfer, inventar, anomali, rezerv | `/anbar/*` |
| | Ticarət | satis, alis, qaytarma, kredit-satis, ticaret, ticaret-teklif | `/ticaret/*` |
| | Satınalma Planlama | satinalma | `/satinalma` |
| | Servis | servis, zemanet | `/servis/*` |
| | Maliyyə | finance, maliye-hesab, odenis, bank, xerc, kassa | `/maliyye/*` |
| | Əlaqələr | musteri, kontragentler, elaqe-* | `/elaqe/*` |
| **KOMMUNİKASİYA** | CRM / Mesaj Mərkəzi | crm, inbox, broadcast, mesaj-sablon, musteri-cavab, sosial-hesab, ai-cavab-v2 | `/crm/*` |
| **KOMANDA** | Əməkdaşlar | iscilier (+ maas, davamiyyet, mezuniyyet, kpi sub-tab) | `/iscilier/*` |
| **ANALİTİKA** | Hesabatlar | hesabat (bütün sub-reports) | `/hesabatlar/*` |
| | AI Köməkçi | ai-komekci, ai-meslehetci | `/ai/*` |
| **GİZLİ** | Sahibkar bölməsi | sahibkar (PIN-protected) | `/sahibkar/*` |
| **SAAS** | Platform Admin | platform-admin, saas, backup | `/platform-admin/*` |
| **SİSTEM** | Ayarlar | ayar, kompaniya, filial, rollar, audit-log, və 15+ ayar səhifəsi | `/ayarlar/*` |

**Alt funksiyalar əsas sidebar-a çıxmır** (sizin tələbiniz). Hər modulun öz daxili tab/navigation sistemi olur.

---

## 5. MƏRHƏLƏLİ KÖÇÜRMƏ ARDICILLIĞI

### Mərhələ 0: Hazırlıq və backup (kod yox)
1. Köhnə layihədə git tag: `pre-nextjs-migration-2026-05-11`
2. DB dump: `pg_dump biznes_360 > backups/biznes_360_pre_migration_2026-05-11.sql`
3. `.env` + `uploads/` qovluğunun ehtiyat nüsxəsi
4. Yeni layihə qovluğu: `~/projects/360biznes-next/`

### Mərhələ 1: Foundation (Scaffold + Auth)
- `create-next-app` + TypeScript + Tailwind
- shadcn/ui setup + dark theme + indigo-purple gradient tokens
- Prisma init + `db pull` köhnə DB-dən → schema.prisma
- Schema təmizliyi, Prisma migrate edib yeni `biznes_360_next` DB-yə tətbiq
- NextAuth + Credentials provider + JWT strategy
- `lib/auth/permissions.ts` — 130+ permission code-larını TypeScript enum kimi
- `middleware.ts` — auth + tenant gate
- `lib/db/prisma.ts` — tenant auto-filter extension
- Login + Signup səhifələri (15 günlük demo + sahibkar/abune yaradılması)
- Test: tenant izolyasiyası, JWT, permission check

### Mərhələ 2: AppShell
- `(dashboard)/layout.tsx` — Sidebar + Topbar (responsive)
- Sidebar component (`Sidebar.tsx`) — sektion + item-ləri yuxarıdakı struktura uyğun
- Topbar: breadcrumb, ⌘K search, bell, clock, user menu
- Notification bell + dropdown
- Dark theme + glassmorphism + Inter font
- Mobile responsive (sidebar drawer)
- Test: hər səhifəyə naviqasiya işləyir, logout, theme tokens

### Mərhələ 3: Dashboard
- KPI cards (satış, stok dəyəri, borc, az stok)
- Son satışlar cədvəli
- Az stok xəbərdarlığı paneli
- Səhər brifinqi banner (seher.html)
- API: `/api/hesabat/dashboard` → server action

### Mərhələ 4: Xəbərdarlıqlar
- alerts modulu portu
- Risk qaydaları (xeberdarliqlar.html ayar səhifəsi)

### Mərhələ 5: POS (KRİTİK - ən mürəkkəb)
- Sol panel: barcode input, məhsul axtarış dropdown
- Sağ panel: müştəri, satıcı, ödəniş, endirim
- Klaviatura kısaylarları (F2/F3/F6/F9/F11)
- Margin risk rəngləməsi (sarı/qırmızı)
- Çek yazma (vergi cəkı)
- Optimistic UI cart
- Kassa session bağlantısı

### Mərhələ 6: Tapşırıqlar
- Kanban + list view
- Yaradan → mesul + icraçı + müşahidəçi
- Auto-escalation worker
- WhatsApp xatırlatma
- Təkrarlanan tapşırıq + checklist

### Mərhələ 7: Anbar (geniş)
- `/anbar` — KPI dashboard
- `/anbar/mehsullar` — 6-sütun filter, dynamic column manager
- `/anbar/markalar`
- `/anbar/transfer`
- `/anbar/inventar` — fiziki sayım wizard
- `/anbar/anomali`
- `/anbar/rezerv`
- `/anbar/qiymet`
- `/anbar/import` — Excel upload + mapping wizard

### Mərhələ 8: Ticarət
- Satışlar (sales list + detail)
- Alışlar
- Qaytarma (full + quick)
- Kredit satışı
- Təklif

### Mərhələ 9: Maliyyə
- Dashboard (KPI + chart-lar)
- Kassalar (shift open/close)
- Bank (statement import/match)
- Xərclər
- Debitor/Kreditor (aging)
- Vergi
- AI variance analysis

### Mərhələ 10: Əlaqələr
- Müştərilər (7-sütun filter, segment, debt)
- Texniqatçılar
- Borclar (debt center)

### Mərhələ 11: CRM / Mesaj Mərkəzi
- Inbox (multi-channel: WhatsApp/Telegram/Instagram/SMS)
- AI cavab (Claude SDK)
- Broadcast kampaniyaları
- Lead pipeline
- Follow-up scheduler
- Segmentlər (RFM)
- Şablonlar
- Duplikat aşkarlayan

### Mərhələ 12: Əməkdaşlar
- İşçi kartları + 360 drawer
- Maaş
- Davamiyyət
- Məzuniyyət
- KPI

### Mərhələ 13: Servis
- Service tickets
- Zəmanət (QR public view)

### Mərhələ 14: Hesabatlar
- Hub + 10+ sub-report
- AI-generated business summary
- Export to Excel (exceljs → next-export)

### Mərhələ 15: Sahibkar bölməsi (PIN)
- PIN re-auth gate (server-side session, 15 dəq sliding)
- Maya analysis, Mağaza performance, Audit, Snapshot, Partiya, Notlar, Tapşırıq

### Mərhələ 16: AI Köməkçi
- Chat interface
- Context-aware (sales/stock data)
- Anomali detection

### Mərhələ 17: Public landing + paketler
- `(public)/page.tsx` — SEO + hero + gradient
- Paketlər (3 tier)
- Demo / FAQ
- Theme toggle (dark + light)

### Mərhələ 18: Platform Admin
- Tenant list + filter
- MRR/ARR analytics
- Modul istifadə metrikləri
- Demo bitir (churn risk)
- Tenant impersonation (audit-logged)

### Mərhələ 19: Ayarlar (20+ alt-səhifə)
- Hub kart layout
- Kompaniya, filial, istifadəçi, rol, qiymət siyasəti, POS, anbar, bank, sənəd şablon, bildiriş, marketplace, audit log, hesab settings

### Mərhələ 20: Data köçürmə (production hazırlığı)
- ETL script: köhnə `biznes_360` → yeni `biznes_360_next`
- Cədvəl-cədvəl, FK ardıcıllığı ilə
- Cross-check counts (eyni sayıda istifadəçi, məhsul, satış...)
- Cutover planı (1 saat downtime, yenidən yönləndirmə)

---

## 6. RİSKLƏR VƏ MITIGATION

| Risk | Təsir | Mitigation |
|---|---|---|
| **Scope çox böyükdür** (73 modul × ortalama 5 endpoint) | Aylar sürər | Mərhələ-mərhələ deliver, hər mərhələdə test |
| **Multi-tenant leak** (sahibkar_id unutmaq) | Cross-tenant data leak | Prisma extension ilə avtomatik filter — manual yazmaq qadağa |
| **Business logic itməsi** (margin warning, stock locking, FIFO) | Pul/stok itki | Köhnə kodu reference oxu, hər modulun unit test-i |
| **AI integration ANTHROPIC_API_KEY asılılığı** | AI funksiyaları çalışmaz | `.env.example`-də göstər, fallback mock-mode |
| **Marketplace adapter dəyişikliyi** | Sync xətaları | Per-platform adapter pattern + integration test |
| **Köhnə HTML JS state (localStorage)** | Filter/column preferences itər | Migration helper: ilk login-də LS-dən oxu, server-ə yaz |
| **Background scheduler** (avto-engine) | Stok/borc xəbərdarlıq işləmir | BullMQ + Redis worker (Vercel-də deploy etsək, ayrı VPS-də işçi process) |
| **File upload tenant leak** | Şəkilləri başqa tenant görə bilər | Signed URL + tenant-id check |
| **Permission yenilənmə cache invalidate** | Köhnə icazə qalır | Redis cache + role/icaze dəyişdikdə tenant-wide invalidate |
| **DB migration sxema dəyişdikdə** | Production rollback | Hər migration up + down + test data |
| **Köhnə vanilla aktiv kalır** (sizin tələb) | İki kod parallel olur | Köhnə qovluğa toxunma qaydası + git tag + DB ayrı |

---

## 7. BACKUP STRATEGİYASI

### Mütləq addımlar (Mərhələ 0-da)
1. Git:
   ```bash
   cd ~/projects/360biznes
   git tag pre-nextjs-migration-2026-05-11
   git push --tags
   git checkout -b nextjs-baseline   # snapshot branch
   ```
2. DB:
   ```bash
   pg_dump -Fc biznes_360 > ~/backups/biznes_360_2026-05-11.dump
   ```
3. Yüklənmiş fayllar:
   ```bash
   tar -czf ~/backups/uploads_2026-05-11.tar.gz ~/projects/360biznes/uploads/
   ```
4. `.env` faylı: `~/backups/env_2026-05-11.txt`

### Davam edən backup
- Köhnə layihə hər gün avtomatik `pg_dump`
- Yeni layihə dev-də ayrı `biznes_360_next` DB
- Production keçidə qədər köhnə production data dəyişməz

---

## 8. TEST PLANI

### Per-modul testlər
| Test növü | Nə yoxlanır |
|---|---|
| Login & Permission | hər rol üçün giriş + permission gating |
| CRUD | yarat/oxu/yenile/sil + filtri |
| Multi-tenant izolyasiya | A sahibkar B sahibkar datasını görür?! |
| Filter | hər sütun + range + sıralama |
| Export | Excel + PDF çıxış doğru |
| Import | Excel import wizard + xəta sətirləri |
| Audit log | hər əməliyyat yazılır |
| Validation | Zod + server-side |
| Rate limit | brute-force yoxlama |
| Mobile | responsive layout |

### Acceptance test (per modul)
> "Vanilla layihədə X funksiyası işləyirdi. Next.js-də də işləyir?"

### Integration test
- Satis yaradıldıqda → stok azalır + kassa əməliyyatı + audit log yaranır
- Alış yaradıldıqda → stok artır + kreditor borc artır
- Avto-engine 5 dəq cron-da işləyir → stok az xəbərdarlıq yaradır

### Performance test
- 10k məhsul cədvəlində pagination + virtualized scroll
- POS-da barcode scan reaction time < 100ms
- Dashboard load < 2s

---

## 9. MULTİ-TENANT SAAS HAZIRLIĞI

Mövcud hazır olanlar (köhnədən):
- `sahibkarlar` tenant cədvəli, hər cədvəldə `sahibkar_id`
- `abuneler` + `abune_planlari` (3 tier: başlanğıc / peşəkar / korporativ)
- `sahibkar_modullar` (modul-level paywall infrastructure)
- 15 günlük demo + `demo_trials`
- Login-də subscription validation
- Platform admin (tenant idarəetməsi)

Yenidə əlavə ediləcəklər:
- Subscription paywall middleware (modulu kilidlə əgər paket icazə vermir)
- Stripe/Pay-pal/yerli ödəmə inteqrasiyası (mərhələ 18-də)
- Tenant onboarding wizard təkmilləşdirilməsi
- Custom domain per tenant (mərhələ 20+, opsional)
- Audit trail kommit etmək (köhnədəkindən genişlənmiş)

---

## 10. NÖVBƏTI ADDIM

Bu plan təsdiqlənərsə:
1. **Mərhələ 0** (backup) — sizdən təsdiq alıb edirəm
2. **Mərhələ 1** (foundation) — Next.js scaffold + Prisma + Auth — kod yazıram

Plandakı hər hansı bir hissəni dəyişmək istəyirsinizsə (stack, qovluq strukturu, sidebar mapping, migration ardıcıllığı, DB strategiyası), indi deyin.

---

**Mənbə sənədlər:**
- `FUNCTION-INVENTORY.md` — bütün 73 modulun detallı statusu
