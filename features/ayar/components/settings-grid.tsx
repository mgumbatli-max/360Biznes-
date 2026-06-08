"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  X,
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
import { cn } from "@/lib/utils";

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

type GroupTone = "primary" | "indigo" | "emerald" | "amber" | "rose";

type SettingGroup = {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: GroupTone;
  tiles: SettingTile[];
};

export type SettingsGridStats = {
  branchTotal: number;
  userCount: number;
};

const TONE_ICON: Record<GroupTone, string> = {
  primary: "text-primary",
  indigo: "text-indigo-500 dark:text-indigo-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-500 dark:text-rose-400",
};

const TONE_BG: Record<GroupTone, string> = {
  primary: "bg-primary/10",
  indigo: "bg-indigo-500/10",
  emerald: "bg-emerald-500/10",
  amber: "bg-amber-500/10",
  rose: "bg-rose-500/10",
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
      subtitle: "Profil, filial, istifadəçi, vəzifə, rol və icazə",
      icon: Briefcase,
      tone: "primary",
      tiles: [
        { href: "/ayarlar/kompaniya", icon: Building2, title: "Şirkət profili",
          desc: "Ad, VÖEN, ünvan, brend rəngi",
          synonyms: "company logo brand voen" },
        { href: "/ayarlar/filiallar", icon: MapPin, title: "Filiallar",
          desc: "Mağaza idarəetmə və müqayisə",
          badge: `${stats.branchTotal}`,
          synonyms: "branch magaza obyekt" },
        { href: "/ayarlar/istifadeci", icon: Users, title: "İstifadəçilər",
          desc: "Login hesab, 2FA, sessiya",
          badge: `${stats.userCount}`,
          synonyms: "user emekdas login account" },
        { href: "/ayarlar/vezife", icon: Briefcase, title: "Vəzifələr",
          desc: "Əməkdaş vəzifə kataloqu",
          synonyms: "vezife position role title menecer satici muhasib" },
        { href: "/ayarlar/rollar", icon: Shield, title: "Rol və icazələr",
          desc: "Rol matrisi, modul icazələri",
          synonyms: "role permission icaze access" },
        { href: "/ayarlar/team", icon: MessageSquare, title: "Komanda söhbəti",
          desc: "Daxili Teams mesajlaşma",
          synonyms: "team chat mesaj sohbet" },
        { href: "/audit-log", icon: ClipboardList, title: "Audit log",
          desc: "Dəyişikliklərin tarixçəsi",
          synonyms: "log tarixce history degisiklik" },
        { href: "/ayarlar/hesab", icon: Key, title: "Hesab ayarları",
          desc: "Şifrə, 2FA, dil və görünüş",
          synonyms: "account profile sifre 2fa dil" },
      ],
    },
    {
      key: "maliyye-satis",
      title: "Maliyyə və satış qaydaları",
      subtitle: "Qiymət, POS, komissiya, kanal və hesab planı",
      icon: Workflow,
      tone: "indigo",
      tiles: [
        { href: "/ayarlar/pos", icon: CreditCard, title: "POS ayarları",
          desc: "Vergi kassası, çek, qısayollar",
          synonyms: "pos checkout kassa cek" },
        { href: "/ayarlar/qiymet", icon: Percent, title: "Qiymət siyasəti",
          desc: "Marja, min qiymət, endirim sərhədi",
          synonyms: "price pricing marja qiymet endirim" },
        { href: "/ayarlar/qiymet-tipi", icon: Tags, title: "Qiymət tipləri",
          desc: "Pərakəndə, topdan, VIP, kredit",
          synonyms: "price type perakende topdan vip kredit" },
        { href: "/ayarlar/qiymet-icaze", icon: Eye, title: "Qiymət icazələri",
          desc: "POS-da kim hansı qiyməti görür",
          synonyms: "price permission icaze pos" },
        { href: "/ayarlar/satis-hedef", icon: Target, title: "Satış hədəfi",
          desc: "Aylıq, kvartal, illik hədəflər",
          synonyms: "target hedef kpi satis" },
        { href: "/ayarlar/satis-tesdiq", icon: ShieldCheck, title: "Endirim təsdiqi",
          desc: "Threshold və 4-eyes təsdiq",
          synonyms: "discount approval tesdiq endirim" },
        { href: "/ayarlar/komissiya-qaydalari", icon: Percent, title: "Komissiya",
          desc: "Satıcı mərhələli faiz",
          synonyms: "commission komissiya satici" },
        { href: "/ayarlar/kanallar", icon: Network, title: "Satış kanalları",
          desc: "Wolt, Birmarket, Tap.az qiymət",
          synonyms: "channel kanal wolt birmarket tap marketplace platform" },
        { href: "/ayarlar/anbar-mehsul", icon: Boxes, title: "Anbar / məhsul",
          desc: "Tip, ölçü vahidi, custom field",
          synonyms: "warehouse product anbar mehsul olcu" },
        { href: "/ayarlar/bank", icon: Landmark, title: "Maliyyə hesabları",
          desc: "Kassa, bank, kart hesabları",
          synonyms: "finance bank account hesab kassa" },
        { href: "/ayarlar/xerc-kateqoriya", icon: Receipt, title: "Xərc kateqoriyaları",
          desc: "Xərc maddələri və qruplar",
          synonyms: "expense category xerc" },
        { href: "/ayarlar/maliyye-threshold", icon: AlertTriangle, title: "Maliyyə eşikləri",
          desc: "Borc, mənfəət xəbərdarlığı",
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
      title: "Avtomatlaşdırma və bildiriş",
      subtitle: "AI, qaydalar, müştəri seqmenti və kanallar",
      icon: Sparkles,
      tone: "emerald",
      tiles: [
        { href: "/ayarlar/avtomatlasdirma", icon: Activity, title: "Avtomatlaşdırma",
          desc: "Əgər → onda qaydaları",
          synonyms: "automation rule qayda trigger" },
        { href: "/ayarlar/ai-meslehetci", icon: Sparkles, title: "AI Məsləhətçi",
          desc: "Gündəlik analiz, sual-cavab",
          isAi: true,
          synonyms: "ai assistant meslehetci" },
        { href: "/ayarlar/data-saglamliq", icon: HeartPulse, title: "Data sağlamlığı",
          desc: "Dublikat, natamam datalar",
          synonyms: "data health saglamliq dublikat" },
        { href: "/ayarlar/musteri-segment", icon: UserCheck, title: "Müştəri seqmenti",
          desc: "VIP, topdan, borclu — avto",
          synonyms: "customer segment musteri vip" },
        { href: "/ayarlar/risk-qayda", icon: AlertTriangle, title: "Risk qaydaları",
          desc: "Avtomatik xəbərdarlıq şərtləri",
          synonyms: "risk rule qayda xeberdarliq" },
        { href: "/ayarlar/bildiris", icon: Bell, title: "Bildiriş kanalları",
          desc: "Push, Email, SMS, WhatsApp",
          synonyms: "notification bildiris push email sms" },
        { href: "/ayarlar/telegram", icon: TelegramSend, title: "Telegram",
          desc: "Bot ilə sifariş və stok",
          synonyms: "telegram bot bildiris notification mesaj real-time" },
        { href: "/ayarlar/email", icon: Mail, title: "Email",
          desc: "Resend/SendGrid və günlük xülasə",
          synonyms: "email mail resend sendgrid bildiris notification" },
        { href: "/ayarlar/mesaj-sablon", icon: MessageSquare, title: "Mesaj şablonları",
          desc: "Email, SMS, WhatsApp mətnləri",
          synonyms: "template sablon email sms wa" },
      ],
    },
    {
      key: "inteqrasiya",
      title: "İnteqrasiya və idxal",
      subtitle: "Excel, marketplace, bank API və webhook",
      icon: Webhook,
      tone: "amber",
      tiles: [
        { href: "/ayarlar/inteqrasiya", icon: FileSpreadsheet, title: "Excel idxalı",
          desc: "Məhsul, müştəri, satış import",
          synonyms: "import excel inteqrasiya shablon" },
        { href: "/ayarlar/idxal-tarixce", icon: Upload, title: "İdxal tarixçəsi",
          desc: "Nəticələr və geri qaytarma",
          synonyms: "import history tarixce undo" },
        { href: "/ayarlar/marketplace", icon: ShoppingBag, title: "Marketplace API",
          desc: "Umico, Birmarket, Wolt",
          synonyms: "marketplace api umico wolt" },
        { href: "/ayarlar/mp-komisyon", icon: Percent, title: "MP komissiya",
          desc: "Marketplace komisyon faizləri",
          synonyms: "marketplace commission komisyon" },
        { href: "/ayarlar/bank-inteqrasiya", icon: Landmark, title: "Bank inteqrasiya",
          desc: "Çıxarış import, avto-uyğunlaşma",
          synonyms: "bank integration cixaris auto" },
        { href: "/ayarlar/pos-qiymet", icon: CreditCard, title: "POS qiymət sync",
          desc: "Filial üzrə qiymət göstərişi",
          synonyms: "pos price filial sync" },
        { href: "/ayarlar/webhook-api", icon: Webhook, title: "Webhook və API",
          desc: "API açarı və hadisə abunəliyi",
          synonyms: "webhook api token" },
      ],
    },
    {
      key: "sistem",
      title: "Sistem",
      subtitle: "İlkin setup, abunəlik, backup və admin",
      icon: Settings,
      tone: "rose",
      tiles: [
        { href: "/ayarlar/ilkin-qaliqlar", icon: PlayCircle, title: "İlkin qalıqlar",
          desc: "Yeni sahibkar başlanğıcı",
          synonyms: "initial balance ilkin qaliq onboarding" },
        { href: "/ayarlar/abune", icon: ShieldCheck, title: "Abunəlik və plan",
          desc: "Cari plan və istifadə",
          synonyms: "subscription plan abune" },
        { href: "/ayarlar/backup", icon: Database, title: "Backup və bərpa",
          desc: "Manual + avto backup, JSON eksport",
          synonyms: "backup restore berpa" },
        { href: "/ayarlar/sahibkar", icon: Shield, title: "Sahibkar paneli",
          desc: "PIN ilə qorunan idarəetmə",
          synonyms: "owner sahibkar pin admin" },
      ],
    },
  ];
}

export function SettingsGrid({ stats }: { stats: SettingsGridStats }) {
  const groups = useMemo(() => buildGroups(stats), [stats]);
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string>(groups[0]?.key ?? "");
  const normQuery = normalize(query);

  const filtered = useMemo(() => {
    if (!normQuery) return groups;
    return groups
      .map((g) => ({
        ...g,
        tiles: g.tiles.filter((t) => {
          const haystack = normalize(`${t.title} ${t.desc ?? ""} ${t.synonyms ?? ""}`);
          return haystack.includes(normQuery);
        }),
      }))
      .filter((g) => g.tiles.length > 0);
  }, [groups, normQuery]);

  const totalAll = groups.reduce((s, g) => s + g.tiles.length, 0);
  const totalFound = filtered.reduce((s, g) => s + g.tiles.length, 0);

  // Scroll-spy — yalnız axtarış olmayanda
  useEffect(() => {
    if (query) return;
    const observers: IntersectionObserver[] = [];
    const observed: HTMLElement[] = [];
    groups.forEach((g) => {
      const el = document.getElementById(g.key);
      if (!el) return;
      observed.push(el);
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) setActiveKey(g.key);
          });
        },
        { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
      );
      io.observe(el);
      observers.push(io);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [query, groups]);

  return (
    <div className="space-y-5">
      {/* Big search bar — single focal point */}
      <div className="sticky top-14 z-20 -mx-1 rounded-2xl border border-border/40 bg-card/85 px-2 py-1.5 shadow-sm backdrop-blur-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ayarlar arasında axtar — bank, icazə, marketplace, vəzifə…"
            className="h-11 border-0 bg-transparent pl-11 pr-10 text-[13px] focus-visible:ring-0 placeholder:text-muted-foreground/60"
            aria-label="Ayarlar axtarışı"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Təmizlə"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {query && (
          <div className="mt-1 px-3 pb-1 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{totalFound}</span> nəticə{" "}
            <span className="text-muted-foreground/60">({totalAll} ümumi)</span>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center">
          <Search className="mx-auto mb-3 h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">«{query}» üçün ayar tapılmadı</p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-3 text-xs font-semibold text-primary hover:underline"
          >
            Axtarışı təmizlə
          </button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
          {/* Vertical rail nav — sticky on desktop */}
          {!query && (
            <aside className="hidden lg:block">
              <div className="sticky top-32 space-y-1">
                <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Bölmələr
                </div>
                {groups.map((g) => {
                  const active = activeKey === g.key;
                  return (
                    <a
                      key={g.key}
                      href={`#${g.key}`}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] font-medium transition-all",
                        active
                          ? "bg-secondary/70 text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                      )}
                    >
                      <span className={cn("relative grid h-6 w-6 place-items-center rounded-md", TONE_BG[g.tone])}>
                        <g.icon className={cn("h-3.5 w-3.5", TONE_ICON[g.tone])} />
                        {active && (
                          <span className="absolute -left-3 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                        )}
                      </span>
                      <span className="flex-1 truncate">{g.title}</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground/70">
                        {g.tiles.length}
                      </span>
                    </a>
                  );
                })}
              </div>
            </aside>
          )}

          {/* Horizontal chip nav for mobile */}
          {!query && (
            <nav className="-mx-1 flex gap-1.5 overflow-x-auto scroll-px-1 px-1 pb-1 lg:hidden">
              {groups.map((g) => {
                const active = activeKey === g.key;
                return (
                  <a
                    key={g.key}
                    href={`#${g.key}`}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border/60 bg-card/60 text-muted-foreground",
                    )}
                  >
                    <g.icon className={cn("h-3 w-3", TONE_ICON[g.tone])} />
                    {g.title}
                    <span className="text-muted-foreground/70">{g.tiles.length}</span>
                  </a>
                );
              })}
            </nav>
          )}

          {/* Content */}
          <main className="min-w-0 space-y-8">
            {filtered.map((g) => (
              <section key={g.key} id={g.key} className="scroll-mt-32 space-y-3.5">
                {/* Section header — clean typography, no card */}
                <div className="space-y-0.5 border-b border-border/40 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("grid h-7 w-7 place-items-center rounded-lg", TONE_BG[g.tone])}>
                      <g.icon className={cn("h-3.5 w-3.5", TONE_ICON[g.tone])} />
                    </span>
                    <h2 className="text-[15px] font-bold tracking-tight">{g.title}</h2>
                    <span className="text-[11px] tabular-nums text-muted-foreground/70">
                      {g.tiles.length} ayar
                    </span>
                  </div>
                  <p className="ml-9 text-[11.5px] text-muted-foreground">{g.subtitle}</p>
                </div>

                {/* Tiles — flat list, 2-col on lg, more breathing room */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {g.tiles.map((tile) => (
                    <Tile key={tile.href} tile={tile} tone={g.tone} />
                  ))}
                </div>
              </section>
            ))}
          </main>
        </div>
      )}
    </div>
  );
}

function Tile({ tile, tone }: { tile: SettingTile; tone: GroupTone }) {
  const Icon = tile.icon;
  return (
    <Link
      href={tile.href}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5",
        "transition-all hover:bg-secondary/60",
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-transform group-hover:scale-105",
          TONE_BG[tone],
        )}
      >
        <Icon className={cn("h-4 w-4", TONE_ICON[tone])} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-[13px] font-semibold tracking-tight">{tile.title}</h3>
          {tile.isAi && (
            <span className="inline-flex h-4 items-center gap-0.5 rounded-sm bg-violet-500/15 px-1 text-[9px] font-bold uppercase text-violet-600 dark:text-violet-400">
              <Sparkles className="h-2 w-2" />
              AI
            </span>
          )}
          {tile.isNew && !tile.isAi && (
            <span className="rounded-sm bg-emerald-500/15 px-1 text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
              Yeni
            </span>
          )}
          {tile.badge && (
            <span className="ml-auto inline-flex h-4 items-center rounded-full bg-secondary px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {tile.badge}
            </span>
          )}
        </div>
        {tile.desc && (
          <p className="truncate text-[11px] text-muted-foreground">{tile.desc}</p>
        )}
      </div>
    </Link>
  );
}
