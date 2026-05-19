import type { LucideIcon } from "lucide-react";
import {
  Package, PackageOpen, ShoppingCart, Truck, RotateCcw, CreditCard, Wallet, Clock,
  UserX, UserMinus, Wrench, Tag, AlertTriangle, Percent, Banknote, Globe, Boxes,
  Bell, MessageSquare, Mail, Phone, ShieldCheck, Ban, Award, Trophy, ListTodo,
  StickyNote, UserCheck,
  Building2, Warehouse, Layers, Users, Briefcase, Store,
  Activity, Repeat, CalendarClock, CalendarDays,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
 * TRIGGERS — 18 event types from all modules
 * ────────────────────────────────────────────────────────────────────────── */

export type TriggerKod =
  | "stok_az" | "stok_bit"
  | "satish_yarandi" | "alish_yarandi" | "qaytarma_yarandi"
  | "borc_gecikdi" | "odenis_gecikdi"
  | "tap_gecikdi"
  | "isci_gec_geldi" | "isci_gelmedi"
  | "servis_status_deyismedi"
  | "qiymet_deyisdi"
  | "satish_mayadan_ashagi"
  | "boyuk_endirim"
  | "bank_uygunsuz"
  | "mp_sifaris_gecikdi"
  | "mehsul_uzun_satilmadi"
  | "kassa_baglanmadi";

export type Trigger = {
  kod: TriggerKod;
  ad: string;
  modul: ModulKod;
  icon: LucideIcon;
  /** Default condition keys this trigger supports */
  shertler: ShertField[];
  /** Default scope types compatible */
  scopes: ScopeKod[];
  tesvir: string;
};

/* ──────────────────────────────────────────────────────────────────────────
 * MODULES
 * ────────────────────────────────────────────────────────────────────────── */

export type ModulKod = "anbar" | "ticaret" | "alish" | "maliyye" | "crm" | "elaqe" | "tapshiriqlar" | "iscilier" | "servis" | "marketplace" | "kassa" | "sistem";

export const MODULLAR: Record<ModulKod, { ad: string; reng: string }> = {
  anbar:        { ad: "Anbar",         reng: "border-cyan-500/40 bg-cyan-500/10 text-cyan-500" },
  ticaret:      { ad: "Ticarət",       reng: "border-indigo-500/40 bg-indigo-500/10 text-indigo-500" },
  alish:        { ad: "Alış",          reng: "border-amber-500/40 bg-amber-500/10 text-amber-500" },
  maliyye:      { ad: "Maliyyə",       reng: "border-violet-500/40 bg-violet-500/10 text-violet-500" },
  crm:          { ad: "CRM",           reng: "border-pink-500/40 bg-pink-500/10 text-pink-500" },
  elaqe:        { ad: "Əlaqələr",      reng: "border-orange-500/40 bg-orange-500/10 text-orange-500" },
  tapshiriqlar: { ad: "Tapşırıqlar",   reng: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" },
  iscilier:     { ad: "Əməkdaşlar",    reng: "border-blue-500/40 bg-blue-500/10 text-blue-500" },
  servis:       { ad: "Servis",        reng: "border-rose-500/40 bg-rose-500/10 text-rose-500" },
  marketplace:  { ad: "Marketplace",   reng: "border-lime-500/40 bg-lime-500/10 text-lime-500" },
  kassa:        { ad: "Kassa",         reng: "border-teal-500/40 bg-teal-500/10 text-teal-500" },
  sistem:       { ad: "Sistem",        reng: "border-slate-500/40 bg-slate-500/10 text-slate-500" },
};

/* ──────────────────────────────────────────────────────────────────────────
 * CONDITION FIELDS — typed condition operands
 * ────────────────────────────────────────────────────────────────────────── */

export type ShertField =
  | "stok_miqdar"
  | "borc_gun"
  | "mebleg"
  | "endirim_pct"
  | "isci_gec_say"
  | "son_satish_gun"
  | "servis_no_change_gun"
  | "qiymet_ferq_pct"
  | "satis_qiymeti_vs_maya"
  | "tap_gecikme_gun"
  | "mp_gecikme_saat"
  | "kassa_gecikme_saat";

export type ShertOperator = "=" | ">" | ">=" | "<" | "<=" | "!=";

export type ShertItem = {
  field: ShertField;
  operator: ShertOperator;
  value: number;
};

export type ShertGroup = {
  /** AND-of: bütün şərtlər ödənməlidir. OR-of: hər hansı biri ödənsə kifayət. */
  logic: "and" | "or";
  conditions: ShertItem[];
};

export const SHERT_META: Record<ShertField, { label: string; suffix: string; defaultOp: ShertOperator; defaultValue: number }> = {
  stok_miqdar:           { label: "Stok miqdarı",           suffix: "ədəd", defaultOp: "<",  defaultValue: 5 },
  borc_gun:              { label: "Borc gecikməsi",         suffix: "gün",  defaultOp: ">",  defaultValue: 7 },
  mebleg:                { label: "Məbləğ",                 suffix: "₼",    defaultOp: ">",  defaultValue: 500 },
  endirim_pct:           { label: "Endirim %",              suffix: "%",    defaultOp: ">",  defaultValue: 20 },
  isci_gec_say:          { label: "İşçi gecikmə sayı",      suffix: "dəfə", defaultOp: ">=", defaultValue: 3 },
  son_satish_gun:        { label: "Son satışdan keçən gün", suffix: "gün",  defaultOp: ">",  defaultValue: 60 },
  servis_no_change_gun:  { label: "Servis statusu dəyişməyib", suffix: "gün", defaultOp: ">", defaultValue: 3 },
  qiymet_ferq_pct:       { label: "Qiymət fərqi %",         suffix: "%",    defaultOp: ">",  defaultValue: 5 },
  satis_qiymeti_vs_maya: { label: "Satış qiyməti vs maya",  suffix: "",     defaultOp: "<",  defaultValue: 0 },
  tap_gecikme_gun:       { label: "Tapşırıq gecikmə",       suffix: "gün",  defaultOp: ">",  defaultValue: 1 },
  mp_gecikme_saat:       { label: "Marketplace gecikmə",    suffix: "saat", defaultOp: ">",  defaultValue: 24 },
  kassa_gecikme_saat:    { label: "Kassa bağlanmaması",     suffix: "saat", defaultOp: ">",  defaultValue: 12 },
};

/* ──────────────────────────────────────────────────────────────────────────
 * TRIGGERS — full catalog
 * ────────────────────────────────────────────────────────────────────────── */

export const TRIGGERS: Trigger[] = [
  // Anbar
  { kod: "stok_az", ad: "Stok azaldı", modul: "anbar", icon: Package, shertler: ["stok_miqdar"], scopes: ["all", "anbar", "mehsul", "kateqoriya", "marka", "filial"], tesvir: "Məhsul stoku müəyyən səviyyəyə düşəndə" },
  { kod: "stok_bit", ad: "Stok bitdi", modul: "anbar", icon: PackageOpen, shertler: [], scopes: ["all", "anbar", "mehsul", "kateqoriya"], tesvir: "Məhsul stoku tamamilə bitəndə" },
  { kod: "mehsul_uzun_satilmadi", ad: "Məhsul uzun müddət satılmır", modul: "anbar", icon: Boxes, shertler: ["son_satish_gun"], scopes: ["all", "anbar", "mehsul", "kateqoriya", "marka"], tesvir: "Bir məhsul uzun müddətdir hərəkət etmir" },

  // Ticarət
  { kod: "satish_yarandi", ad: "Satış yaradıldı", modul: "ticaret", icon: ShoppingCart, shertler: ["mebleg"], scopes: ["all", "filial", "kanal", "musteri"], tesvir: "Yeni satış sifarişi yarandı" },
  { kod: "satish_mayadan_ashagi", ad: "Maya altı satış oldu", modul: "ticaret", icon: AlertTriangle, shertler: ["satis_qiymeti_vs_maya"], scopes: ["all", "filial", "mehsul"], tesvir: "Satış qiyməti maya dəyərindən aşağıdır" },
  { kod: "boyuk_endirim", ad: "Böyük endirim edildi", modul: "ticaret", icon: Percent, shertler: ["endirim_pct"], scopes: ["all", "filial", "musteri"], tesvir: "Sifarişdə müəyyən faizdən böyük endirim tətbiq olundu" },
  { kod: "qaytarma_yarandi", ad: "Qaytarma yaradıldı", modul: "ticaret", icon: RotateCcw, shertler: ["mebleg"], scopes: ["all", "filial", "musteri", "mehsul"], tesvir: "Müştəri məhsulu qaytardı" },

  // Alış
  { kod: "alish_yarandi", ad: "Alış yaradıldı", modul: "alish", icon: Truck, shertler: ["mebleg"], scopes: ["all", "tedarukcu", "anbar"], tesvir: "Yeni alış sifarişi yarandı" },

  // Maliyyə
  { kod: "qiymet_deyisdi", ad: "Qiymət dəyişdi", modul: "ticaret", icon: Tag, shertler: ["qiymet_ferq_pct"], scopes: ["all", "mehsul", "kateqoriya", "marka"], tesvir: "Məhsulun satış qiyməti dəyişdirildi" },
  { kod: "borc_gecikdi", ad: "Borc gecikdi", modul: "maliyye", icon: CreditCard, shertler: ["borc_gun", "mebleg"], scopes: ["all", "musteri", "filial"], tesvir: "Müştəri borcu müəyyən gün gecikib" },
  { kod: "odenis_gecikdi", ad: "Ödəniş gecikdi", modul: "maliyye", icon: Wallet, shertler: ["borc_gun", "mebleg"], scopes: ["all", "tedarukcu"], tesvir: "Tədarükçüyə ödəniş gecikib" },
  { kod: "bank_uygunsuz", ad: "Bank ödənişi uyğunlaşmadı", modul: "maliyye", icon: Banknote, shertler: ["mebleg"], scopes: ["all", "filial"], tesvir: "Bank hesabına gözlənən pul gəlməyib" },

  // Tapşırıq
  { kod: "tap_gecikdi", ad: "Tapşırıq gecikdi", modul: "tapshiriqlar", icon: Clock, shertler: ["tap_gecikme_gun"], scopes: ["all", "isci"], tesvir: "Deadline-i keçmiş tapşırıq aşkar olundu" },

  // İşçi
  { kod: "isci_gec_geldi", ad: "İşçi gec gəldi", modul: "iscilier", icon: UserX, shertler: ["isci_gec_say"], scopes: ["all", "isci", "filial"], tesvir: "İşçi N dəfə işə gec gəlib" },
  { kod: "isci_gelmedi", ad: "İşçi işə gəlmədi", modul: "iscilier", icon: UserMinus, shertler: [], scopes: ["all", "isci", "filial"], tesvir: "İşçi planlaşdırılan iş gününə gəlməyib" },

  // Servis
  { kod: "servis_status_deyismedi", ad: "Servis statusu dəyişmir", modul: "servis", icon: Wrench, shertler: ["servis_no_change_gun"], scopes: ["all", "isci"], tesvir: "Servis tapşırığının statusu uzun müddət dəyişməyib" },

  // Marketplace
  { kod: "mp_sifaris_gecikdi", ad: "Marketplace sifarişi gecikdi", modul: "marketplace", icon: Globe, shertler: ["mp_gecikme_saat"], scopes: ["all", "marketplace_kanal"], tesvir: "Marketplace-dən gələn sifariş emal edilmir" },

  // Kassa
  { kod: "kassa_baglanmadi", ad: "Kassa bağlanışı edilməyib", modul: "kassa", icon: AlertTriangle, shertler: ["kassa_gecikme_saat"], scopes: ["all", "filial"], tesvir: "Gün sonu kassa bağlanışı vaxtında edilməyib" },
];

/* ──────────────────────────────────────────────────────────────────────────
 * ACTIONS — 16 action types
 * ────────────────────────────────────────────────────────────────────────── */

export type ActionKod =
  | "xeberdarliq" | "tapshiriq" | "bildiris" | "whatsapp" | "telegram" | "email" | "sms"
  | "tesdiq" | "block"
  | "kpi_artir" | "kpi_azalt" | "cerime" | "bonus"
  | "qeyd" | "yonlendir";

export type ActionSpec = {
  kod: ActionKod;
  ad: string;
  icon: LucideIcon;
  group: "bildiris" | "kanal" | "is" | "kpi" | "diger";
  tesvir: string;
};

export const ACTIONS: ActionSpec[] = [
  { kod: "xeberdarliq", ad: "Xəbərdarlıq yarat",        icon: AlertTriangle, group: "is",      tesvir: "Risk paneldə xəbərdarlıq yaranır" },
  { kod: "tapshiriq",   ad: "Tapşırıq yarat",           icon: ListTodo,      group: "is",      tesvir: "Cavabdeh şəxsə tapşırıq yaradır" },
  { kod: "tesdiq",      ad: "Təsdiq Mərkəzinə göndər",  icon: ShieldCheck,   group: "is",      tesvir: "Əməliyyat sahibkar təsdiqinə düşür" },
  { kod: "block",       ad: "Əməliyyatı blokla",        icon: Ban,           group: "is",      tesvir: "Real əməliyyatın icrasını saxlayır" },

  { kod: "bildiris", ad: "ERP daxili bildiriş",  icon: Bell,          group: "kanal", tesvir: "ERP-də pop-up bildiriş" },
  { kod: "whatsapp", ad: "WhatsApp göndər",      icon: MessageSquare, group: "kanal", tesvir: "WhatsApp Business API" },
  { kod: "telegram", ad: "Telegram göndər",      icon: MessageSquare, group: "kanal", tesvir: "Telegram bot mesajı" },
  { kod: "email",    ad: "Email göndər",         icon: Mail,          group: "kanal", tesvir: "SMTP vasitəsilə email" },
  { kod: "sms",      ad: "SMS göndər",           icon: Phone,         group: "kanal", tesvir: "Mobil operator SMS" },

  { kod: "kpi_artir", ad: "KPI balı əlavə et",  icon: Award,         group: "kpi", tesvir: "İşçi KPI-na bal əlavə edir" },
  { kod: "kpi_azalt", ad: "KPI balı çıx",       icon: Award,         group: "kpi", tesvir: "İşçi KPI-ndan bal çıxarır" },
  { kod: "cerime",    ad: "Cərimə yarat",       icon: AlertTriangle, group: "kpi", tesvir: "İşçiyə cərimə tətbiq edir" },
  { kod: "bonus",     ad: "Bonus yarat",        icon: Trophy,        group: "kpi", tesvir: "İşçiyə bonus qeyd edir" },

  { kod: "qeyd",       ad: "Qeyd əlavə et",            icon: StickyNote, group: "diger", tesvir: "Sistem qeydi yazır" },
  { kod: "yonlendir",  ad: "Cavabdehə yönləndir",      icon: UserCheck,  group: "diger", tesvir: "Cavabdeh işçiyə yönləndirir" },
];

/* ──────────────────────────────────────────────────────────────────────────
 * SCOPE — application targets
 * ────────────────────────────────────────────────────────────────────────── */

export type ScopeKod =
  | "all" | "filial" | "anbar" | "mehsul" | "marka" | "kateqoriya"
  | "musteri" | "tedarukcu" | "isci" | "marketplace_kanal" | "kanal";

export const SCOPES: Record<ScopeKod, { ad: string; icon: LucideIcon }> = {
  all:               { ad: "Bütün sistem",          icon: Globe },
  filial:            { ad: "Filial",                icon: Building2 },
  anbar:             { ad: "Anbar",                 icon: Warehouse },
  mehsul:            { ad: "Konkret məhsul",        icon: Package },
  marka:             { ad: "Marka",                 icon: Tag },
  kateqoriya:        { ad: "Kateqoriya",            icon: Layers },
  musteri:           { ad: "Müştəri",               icon: Users },
  tedarukcu:         { ad: "Təchizatçı",            icon: Truck },
  isci:              { ad: "Konkret işçi",          icon: Briefcase },
  marketplace_kanal: { ad: "Marketplace kanalı",    icon: Store },
  kanal:             { ad: "Satış kanalı",          icon: ShoppingCart },
};

export type ScopeSpec = {
  type: ScopeKod;
  /** Optional resource ids — if empty, applies to ALL of that type */
  ids?: (string | number)[];
};

/* ──────────────────────────────────────────────────────────────────────────
 * SCHEDULE — when the engine evaluates rules
 * ────────────────────────────────────────────────────────────────────────── */

export type ScheduleKod = "realtime" | "5m" | "1h" | "daily" | "weekly" | "month_end" | "work_hours" | "weekdays";

export const SCHEDULES: Record<ScheduleKod, { ad: string; tesvir: string; icon: LucideIcon }> = {
  realtime:    { ad: "Real-time",       tesvir: "Hadisə baş verən kimi", icon: Activity },
  "5m":        { ad: "Hər 5 dəqiqə",    tesvir: "Cron polling 5 dəq",    icon: Repeat },
  "1h":        { ad: "Hər saat",        tesvir: "Saat başı yoxlama",     icon: Clock },
  daily:       { ad: "Gündə 1 dəfə",    tesvir: "Gecə yarısı işləyir",   icon: CalendarDays },
  weekly:      { ad: "Həftəlik",        tesvir: "Hər bazar ertəsi",      icon: CalendarClock },
  month_end:   { ad: "Ay sonu",         tesvir: "Ayın son günü",         icon: CalendarClock },
  work_hours:  { ad: "Yalnız iş saatlarında", tesvir: "09:00 — 18:00",  icon: Clock },
  weekdays:    { ad: "Yalnız iş günü",  tesvir: "B.E. — Şə.",            icon: CalendarDays },
};

/* ──────────────────────────────────────────────────────────────────────────
 * NOTIFICATION RECIPIENTS
 * ────────────────────────────────────────────────────────────────────────── */

export type RecipientKod = "sahibkar" | "admin" | "menecer" | "mesul" | "selected";

export const RECIPIENTS: Record<RecipientKod, string> = {
  sahibkar: "Sahibkar",
  admin:    "Administratorlar",
  menecer:  "Menecerlər",
  mesul:    "Məsul işçi (avtomatik təyin)",
  selected: "Seçilmiş işçilər",
};

export type KanalKod = "erp" | "telegram" | "whatsapp" | "email" | "sms";

export const KANALLAR: Record<KanalKod, { ad: string; icon: LucideIcon }> = {
  erp:      { ad: "ERP daxili",  icon: Bell },
  telegram: { ad: "Telegram",    icon: MessageSquare },
  whatsapp: { ad: "WhatsApp",    icon: MessageSquare },
  email:    { ad: "Email",       icon: Mail },
  sms:      { ad: "SMS",         icon: Phone },
};

/* ──────────────────────────────────────────────────────────────────────────
 * TEMPLATE VARIABLES — what placeholders can be used in templates
 * ────────────────────────────────────────────────────────────────────────── */

export const TEMPLATE_VARIABLES = [
  { key: "{{mehsul_ad}}",   desc: "Məhsulun adı" },
  { key: "{{mehsul_kod}}",  desc: "Məhsul kodu" },
  { key: "{{musteri_ad}}",  desc: "Müştərinin adı" },
  { key: "{{musteri_tel}}", desc: "Müştəri telefonu" },
  { key: "{{borc_mebleg}}", desc: "Borc məbləği" },
  { key: "{{borc_gun}}",    desc: "Borc neçə gündür gecikib" },
  { key: "{{isci_ad}}",     desc: "İşçi adı" },
  { key: "{{sifaris_no}}",  desc: "Sifariş nömrəsi" },
  { key: "{{stok_qaliq}}",  desc: "Cari stok qalığı" },
  { key: "{{mebleg}}",      desc: "Əməliyyat məbləği" },
  { key: "{{endirim_pct}}", desc: "Endirim faizi" },
  { key: "{{tarix}}",       desc: "Cari tarix" },
  { key: "{{filial_ad}}",   desc: "Filial adı" },
  { key: "{{anbar_ad}}",    desc: "Anbar adı" },
  { key: "{{servis_no}}",   desc: "Servis tapşırığı nömrəsi" },
] as const;

/* ──────────────────────────────────────────────────────────────────────────
 * PRIORITY
 * ────────────────────────────────────────────────────────────────────────── */

export type Prioritet = "asagi" | "orta" | "yuxsek" | "kritik";

export const PRIORITY_META: Record<Prioritet, { ad: string; cls: string }> = {
  kritik: { ad: "Kritik", cls: "border-rose-500/40 bg-rose-500 text-white" },
  yuxsek: { ad: "Yüksək", cls: "border-rose-500/40 bg-rose-500/15 text-rose-500" },
  orta:   { ad: "Orta",   cls: "border-amber-500/40 bg-amber-500/15 text-amber-500" },
  asagi:  { ad: "Aşağı",  cls: "border-border bg-secondary text-muted-foreground" },
};

/* ──────────────────────────────────────────────────────────────────────────
 * FULL RULE DEFINITION — what's stored in avto_qayda
 * ────────────────────────────────────────────────────────────────────────── */

export type RuleDefinition = {
  trigger_kod: TriggerKod;
  shert: ShertGroup;                  // shert_json
  scope: ScopeSpec[];                 // first scope or list — stored in shert_json.scope
  actions: { kod: ActionKod; param?: Record<string, unknown> }[]; // action_json (multi)
  notification?: {
    recipients: RecipientKod[];
    selected_ids?: string[];          // user ids when recipients includes "selected"
    channels: KanalKod[];
    template?: string;
  };
  schedule: ScheduleKod;
};

/* ──────────────────────────────────────────────────────────────────────────
 * READY-MADE TEMPLATES — let user pick from a starter set
 * ────────────────────────────────────────────────────────────────────────── */

export type RuleTemplate = {
  id: string;
  ad: string;
  tesvir: string;
  trigger: TriggerKod;
  prioritet: Prioritet;
  defaults: Partial<RuleDefinition>;
};

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: "stok-5",
    ad: "Stok 5-dən aşağı düşdü → xəbərdarlıq + tapşırıq",
    tesvir: "Anbar məsuluna avtomatik tapşırıq, sahibkara bildiriş",
    trigger: "stok_az",
    prioritet: "yuxsek",
    defaults: {
      shert: { logic: "and", conditions: [{ field: "stok_miqdar", operator: "<", value: 5 }] },
      actions: [{ kod: "xeberdarliq" }, { kod: "tapshiriq" }, { kod: "bildiris" }],
      schedule: "5m",
    },
  },
  {
    id: "stok-0",
    ad: "Stok bitib → kritik xəbərdarlıq + satışda göstər",
    tesvir: "Satış POS-da məhsul üzərində 'Stokda yoxdur' işarəsi",
    trigger: "stok_bit",
    prioritet: "kritik",
    defaults: {
      shert: { logic: "and", conditions: [] },
      actions: [{ kod: "xeberdarliq" }, { kod: "bildiris" }],
      schedule: "realtime",
    },
  },
  {
    id: "borc-7",
    ad: "Borc 7 gün gecikdi → kassirə tapşırıq",
    tesvir: "Borc yığımı tapşırığı + WhatsApp xatırlatma",
    trigger: "borc_gecikdi",
    prioritet: "yuxsek",
    defaults: {
      shert: { logic: "and", conditions: [{ field: "borc_gun", operator: ">", value: 7 }] },
      actions: [{ kod: "tapshiriq" }, { kod: "whatsapp" }],
      schedule: "daily",
    },
  },
  {
    id: "maya-alti",
    ad: "Maya altı satış → blok + Təsdiq Mərkəzi",
    tesvir: "Satış sahibkar təsdiqi olmadan icra olunmaz",
    trigger: "satish_mayadan_ashagi",
    prioritet: "kritik",
    defaults: {
      shert: { logic: "and", conditions: [{ field: "satis_qiymeti_vs_maya", operator: "<", value: 0 }] },
      actions: [{ kod: "block" }, { kod: "tesdiq" }],
      schedule: "realtime",
    },
  },
  {
    id: "isci-3gec",
    ad: "İşçi 3 dəfə gecikib → KPI cərimə + xəbərdarlıq",
    tesvir: "Sahibkara xəbərdarlıq, KPI cərimə tətbiq",
    trigger: "isci_gec_geldi",
    prioritet: "orta",
    defaults: {
      shert: { logic: "and", conditions: [{ field: "isci_gec_say", operator: ">=", value: 3 }] },
      actions: [{ kod: "cerime" }, { kod: "xeberdarliq" }],
      schedule: "daily",
    },
  },
  {
    id: "mehsul-60gun",
    ad: "Məhsul 60 gündür satılmır → xəbərdarlıq",
    tesvir: "Ölü stok aşkarlaması, endirim təklifi",
    trigger: "mehsul_uzun_satilmadi",
    prioritet: "orta",
    defaults: {
      shert: { logic: "and", conditions: [{ field: "son_satish_gun", operator: ">", value: 60 }] },
      actions: [{ kod: "xeberdarliq" }, { kod: "qeyd" }],
      schedule: "weekly",
    },
  },
  {
    id: "servis-3gun",
    ad: "Servis 3 gündür dayanıb → texnikə tapşırıq",
    tesvir: "Servis məsuluna xatırlatma",
    trigger: "servis_status_deyismedi",
    prioritet: "yuxsek",
    defaults: {
      shert: { logic: "and", conditions: [{ field: "servis_no_change_gun", operator: ">", value: 3 }] },
      actions: [{ kod: "tapshiriq" }, { kod: "bildiris" }],
      schedule: "daily",
    },
  },
  {
    id: "kassa-baglanmadi",
    ad: "Kassa bağlanışı edilmədi → sahibkara və kassirə",
    tesvir: "Gün sonu bağlanış 12 saat keçib",
    trigger: "kassa_baglanmadi",
    prioritet: "yuxsek",
    defaults: {
      shert: { logic: "and", conditions: [{ field: "kassa_gecikme_saat", operator: ">", value: 12 }] },
      actions: [{ kod: "bildiris" }, { kod: "telegram" }],
      schedule: "1h",
    },
  },
];

/* ──────────────────────────────────────────────────────────────────────────
 * HELPER
 * ────────────────────────────────────────────────────────────────────────── */

export function getTrigger(kod: TriggerKod | string): Trigger | undefined {
  return TRIGGERS.find((t) => t.kod === kod);
}

export function getAction(kod: ActionKod | string): ActionSpec | undefined {
  return ACTIONS.find((a) => a.kod === kod);
}
