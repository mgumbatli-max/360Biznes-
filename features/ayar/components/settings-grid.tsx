"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  X,
  ArrowRight,
  Sparkles,
  Building2,
  MapPin,
  Users,
  Shield,
  CreditCard,
  Tags,
  Eye,
  Bell,
  ShieldCheck,
  Database,
  Boxes,
  Landmark,
  Percent,
  FileText,
  Receipt,
  Target,
  Webhook,
  ShoppingBag,
  Activity,
  AlertTriangle,
  MessageSquare,
  HeartPulse,
  UserCheck,
  ClipboardList,
  Key,
  PlayCircle,
  FileSpreadsheet,
  Upload,
  Settings,
  Workflow,
  Briefcase,
  Network,
  Send as TelegramSend,
  Mail,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { LucideIcon } from "lucide-react";

type SettingTile = {
  href: string;
  icon: LucideIcon;
  title: string;
  desc?: string;
  synonyms?: string;
  isNew?: boolean;
  isAi?: boolean;
  badge?: string;
};

type SettingGroup = {
  key: string;
  title: string;
  icon: LucideIcon;
  tone: "primary" | "indigo" | "emerald" | "amber" | "rose";
  tiles: SettingTile[];
};

export type SettingsGridStats = {
  branchTotal: number;
  userCount: number;
};

const TONE_BG: Record<SettingGroup["tone"], string> = {
  primary: "bg-primary/10 text-primary",
  indigo: "bg-indigo-500/10 text-indigo-500",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("az")
    .replace(/ə/g, "e")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function buildGroups(stats: SettingsGridStats): SettingGroup[] {
  return [
    {
      key: "sirket",
      title: "Şirkət və komanda",
      icon: Briefcase,
      tone: "primary",
      tiles: [
        { href: "/ayarlar/kompaniya", icon: Building2, title: "Şirkət profili",
          desc: "Ad, VÖEN, ünvan, logo, brend rəngi",
          synonyms: "company logo brand voen" },
        { href: "/ayarlar/filiallar", icon: MapPin, title: "Filiallar",
          desc: "Filial idarəetmə və müqayisə",
          badge: `${stats.branchTotal} filial`,
          synonyms: "branch magaza obyekt" },
        { href: "/ayarlar/istifadeci", icon: Users, title: "İstifadəçilər",
          desc: "Login hesab, 2FA, sessiya",
          badge: `${stats.userCount} aktiv`,
          synonyms: "user emekdas login account" },
        { href: "/ayarlar/rollar", icon: Shield, title: "Rol və icazələr",
          desc: "Rol matrisi, modul-əməliyyat icazələri",
          synonyms: "role permission icaze access" },
        { href: "/ayarlar/team", icon: MessageSquare, title: "Komanda söhbəti",
          desc: "Daxili Teams üslubu mesajlaşma",
          synonyms: "team chat mesaj sohbet" },
        { href: "/audit-log", icon: ClipboardList, title: "Audit log",
          desc: "Bütün dəyişikliklərin tarixçəsi",
          synonyms: "log tarixce history degisiklik" },
        { href: "/ayarlar/hesab", icon: Key, title: "Hesab ayarları",
          desc: "Profil, şifrə, 2FA, dil, görünüş",
          synonyms: "account profile sifre 2fa dil" },
      ],
    },
    {
      key: "is-axini",
      title: "İş axını və qaydalar",
      icon: Workflow,
      tone: "indigo",
      tiles: [
        { href: "/ayarlar/pos", icon: CreditCard, title: "POS ayarları",
          desc: "Vergi kassası, çek, klaviatura qısayolları",
          synonyms: "pos checkout kassa cek" },
        { href: "/ayarlar/qiymet", icon: Percent, title: "Qiymət siyasəti",
          desc: "Marja, min qiymət, maya altı endirim",
          synonyms: "price pricing marja qiymet endirim" },
        { href: "/ayarlar/qiymet-tipi", icon: Tags, title: "Qiymət tipləri",
          desc: "Pərakəndə, topdan, VIP, kredit",
          synonyms: "price type perakende topdan vip kredit" },
        { href: "/ayarlar/qiymet-icaze", icon: Eye, title: "Qiymət icazələri",
          desc: "POS-da hansı qiymət növü kim üçün",
          synonyms: "price permission icaze pos" },
        { href: "/ayarlar/satis-hedef", icon: Target, title: "Satış hədəfi",
          desc: "Aylıq və kvartal hədəflər, KPI",
          synonyms: "target hedef kpi satis" },
        { href: "/ayarlar/satis-tesdiq", icon: ShieldCheck, title: "Endirim təsdiqi",
          desc: "Endirim threshold və approval",
          synonyms: "discount approval tesdiq endirim" },
        { href: "/ayarlar/komissiya-qaydalari", icon: Percent, title: "Komissiya qaydaları",
          desc: "Satıcı komissiyası — mərhələli faiz",
          synonyms: "commission komissiya satici" },
        { href: "/ayarlar/kanallar", icon: Network, title: "Satış kanalları",
          desc: "Wolt, Birmarket, Tap.az komissiyaları və avto-qiymət",
          synonyms: "channel kanal wolt birmarket tap marketplace platform" },
        { href: "/ayarlar/telegram", icon: TelegramSend, title: "Telegram bildirişləri",
          desc: "Marketplace sifariş, stok xəbərdarlığı və s. real-time",
          synonyms: "telegram bot bildiris notification mesaj real-time" },
        { href: "/ayarlar/email", icon: Mail, title: "Email bildirişləri",
          desc: "Resend/SendGrid ilə marketplace və günlük xülasə",
          synonyms: "email mail resend sendgrid bildiris notification" },
        { href: "/ayarlar/anbar-mehsul", icon: Boxes, title: "Anbar / Məhsul",
          desc: "Məhsul tipi, ölçü vahidi, custom field",
          synonyms: "warehouse product anbar mehsul olcu" },
        { href: "/ayarlar/bank", icon: Landmark, title: "Maliyyə hesabları",
          desc: "Kassa, bank, kart hesabları",
          synonyms: "finance bank account hesab kassa" },
        { href: "/ayarlar/xerc-kateqoriya", icon: Receipt, title: "Xərc kateqoriyaları",
          desc: "Xərc maddələri, rəng, ikon, qrup",
          synonyms: "expense category xerc" },
        { href: "/ayarlar/maliyye-threshold", icon: AlertTriangle, title: "Maliyyə eşikləri",
          desc: "Borc, mənfəət xəbərdarlıq limitləri",
          synonyms: "threshold limit alert maliyye" },
        { href: "/ayarlar/sened-sablon", icon: FileText, title: "Sənəd şablonları",
          desc: "Qaimə, akt, zəmanət, kassa orderi",
          synonyms: "document template sened qaime" },
        { href: "/ayarlar/maas-band", icon: Briefcase, title: "Maaş bandı",
          desc: "İşçi maaş səviyyələri",
          synonyms: "salary maas band emekdas" },
      ],
    },
    {
      key: "avtomat",
      title: "Avtomatlaşdırma və AI",
      icon: Sparkles,
      tone: "emerald",
      tiles: [
        { href: "/ayarlar/avtomatlasdirma", icon: Activity, title: "Avtomatlaşdırma",
          desc: "«Əgər → onda» qaydalar (trigger/action)",
          synonyms: "automation rule qayda trigger" },
        { href: "/ayarlar/ai-meslehetci", icon: Sparkles, title: "AI Məsləhətçi",
          desc: "Gündəlik analiz, sual-cavab",
          isAi: true,
          synonyms: "ai assistant meslehetci" },
        { href: "/ayarlar/data-saglamliq", icon: HeartPulse, title: "Data sağlamlığı",
          desc: "Dublikat, natamam datalar üzrə hesabat",
          synonyms: "data health saglamliq dublikat" },
        { href: "/ayarlar/musteri-segment", icon: UserCheck, title: "Müştəri seqmenti",
          desc: "VIP, topdan, borclu, passiv — avto",
          synonyms: "customer segment musteri vip" },
        { href: "/ayarlar/risk-qayda", icon: AlertTriangle, title: "Risk qaydaları",
          desc: "Avtomatik xəbərdarlıq şərtləri",
          synonyms: "risk rule qayda xeberdarliq" },
        { href: "/ayarlar/bildiris", icon: Bell, title: "Bildiriş kanalları",
          desc: "Push, Email, SMS, WA, Telegram",
          synonyms: "notification bildiris push email sms" },
        { href: "/ayarlar/mesaj-sablon", icon: MessageSquare, title: "Mesaj şablonları",
          desc: "Email/SMS/WA mətnləri",
          synonyms: "template sablon email sms wa" },
      ],
    },
    {
      key: "inteqrasiya",
      title: "İnteqrasiya və genişləndirmə",
      icon: Webhook,
      tone: "amber",
      tiles: [
        { href: "/ayarlar/inteqrasiya", icon: FileSpreadsheet, title: "Excel idxal mərkəzi",
          desc: "Məhsul, müştəri, satış idxalı",
          synonyms: "import excel inteqrasiya shablon" },
        { href: "/ayarlar/idxal-tarixce", icon: Upload, title: "İdxal tarixçəsi",
          desc: "Yükləmə nəticələri və geri qaytarma",
          synonyms: "import history tarixce undo" },
        { href: "/ayarlar/marketplace", icon: ShoppingBag, title: "Marketplace API",
          desc: "Umico, Birmarket, Wolt qoşulmaları",
          synonyms: "marketplace api umico wolt" },
        { href: "/ayarlar/mp-komisyon", icon: Percent, title: "MP komisyon",
          desc: "Marketplace komisyon faizləri",
          synonyms: "marketplace commission komisyon" },
        { href: "/ayarlar/bank-inteqrasiya", icon: Landmark, title: "Bank inteqrasiya",
          desc: "Çıxarış import, avto-uyğunlaşma",
          synonyms: "bank integration cixaris auto" },
        { href: "/ayarlar/pos-qiymet", icon: CreditCard, title: "POS qiymət sync",
          desc: "Filial üzrə fərqli qiymət göstərişi",
          synonyms: "pos price filial sync" },
        { href: "/ayarlar/webhook-api", icon: Webhook, title: "Webhook və API",
          desc: "API açarları, webhook hadisələri",
          synonyms: "webhook api token" },
      ],
    },
    {
      key: "sistem",
      title: "Sistem",
      icon: Settings,
      tone: "rose",
      tiles: [
        { href: "/ayarlar/ilkin-qaliqlar", icon: PlayCircle, title: "İlkin qalıqlar",
          desc: "Yeni sahibkar üçün başlanğıc setup",
          synonyms: "initial balance ilkin qaliq onboarding" },
        { href: "/ayarlar/abune", icon: ShieldCheck, title: "Abunəlik və plan",
          desc: "Cari plan, istifadə, planı dəyiş",
          synonyms: "subscription plan abune" },
        { href: "/ayarlar/backup", icon: Database, title: "Backup və bərpa",
          desc: "Manual + avto backup, JSON eksport",
          synonyms: "backup restore berpa" },
        { href: "/ayarlar/sahibkar", icon: Shield, title: "Sahibkar paneli",
          desc: "PIN ilə qorunan idarə",
          synonyms: "owner sahibkar pin admin" },
      ],
    },
  ];
}

export function SettingsGrid({ stats }: { stats: SettingsGridStats }) {
  const groups = useMemo(() => buildGroups(stats), [stats]);
  const [query, setQuery] = useState("");
  const normQuery = normalize(query);

  const filtered = useMemo(() => {
    if (!normQuery) return groups;
    return groups
      .map((g) => ({
        ...g,
        tiles: g.tiles.filter((t) => {
          const haystack = normalize(
            `${t.title} ${t.desc ?? ""} ${t.synonyms ?? ""}`,
          );
          return haystack.includes(normQuery);
        }),
      }))
      .filter((g) => g.tiles.length > 0);
  }, [groups, normQuery]);

  const totalFound = filtered.reduce((s, g) => s + g.tiles.length, 0);
  const totalAll = groups.reduce((s, g) => s + g.tiles.length, 0);

  return (
    <div className="space-y-5">
      <div className="sticky top-14 z-10 -mx-1 rounded-xl border border-border bg-card/80 px-2 py-2 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ayarlar arasında axtarış — məs. «vergi», «bank», «icazə», «marketplace»..."
            className="h-10 pl-9 pr-9 text-sm"
            aria-label="Ayarlar axtarışı"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Təmizlə"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {query && (
          <div className="mt-1.5 px-1 text-[10.5px] text-muted-foreground">
            <span className="font-semibold text-foreground">{totalFound}</span>{" "}
            nəticə tapıldı <span>({totalAll} ümumi)</span>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            «{query}» üçün heç bir ayar tapılmadı
          </p>
        </div>
      ) : (
        filtered.map((g) => (
          <section key={g.key} className="space-y-2.5">
            <div className="flex items-center gap-2 px-1">
              <div className={`grid h-7 w-7 place-items-center rounded-lg ${TONE_BG[g.tone]}`}>
                <g.icon className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-sm font-bold tracking-tight">{g.title}</h2>
              <span className="text-[10.5px] tabular-nums text-muted-foreground">
                {g.tiles.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {g.tiles.map((t) => (
                <Tile key={t.href} tile={t} groupTone={g.tone} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function Tile({ tile, groupTone }: { tile: SettingTile; groupTone: SettingGroup["tone"] }) {
  const Icon = tile.icon;
  return (
    <Link
      href={tile.href}
      title={tile.desc}
      className="group flex items-center gap-2.5 rounded-xl border border-border bg-card/60 px-3 py-2.5 transition hover:border-primary/30 hover:bg-card hover:shadow-sm"
    >
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TONE_BG[groupTone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-xs font-semibold">{tile.title}</span>
          {tile.isAi && (
            <span className="inline-flex h-3.5 items-center gap-0.5 rounded-sm bg-violet-500/15 px-1 text-[8.5px] font-bold uppercase text-violet-600 dark:text-violet-400">
              <Sparkles className="h-2 w-2" />
              AI
            </span>
          )}
          {tile.isNew && !tile.isAi && (
            <span className="rounded-sm bg-emerald-500/15 px-1 text-[8.5px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
              Yeni
            </span>
          )}
        </div>
        {tile.badge && (
          <div className="text-[10px] tabular-nums text-muted-foreground">{tile.badge}</div>
        )}
      </div>
      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}
