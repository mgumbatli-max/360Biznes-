import Link from "next/link";
import {
  ScanLine,
  PlusCircle,
  Receipt,
  Wrench,
  UserPlus,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

type Action = {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  /** Tailwind class for gradient — should be 'from-X-Y to-Z-W' */
  gradient: string;
  /** Icon container background */
  iconBg: string;
  /** Open in new tab */
  external?: boolean;
  /** Hero card — span 2 columns on lg */
  hero?: boolean;
  /** Bu düymə üçün lazımi icazələrdən ən az biri */
  anyPermission?: string[];
};

const ACTIONS: Action[] = [
  {
    href: "/pos",
    label: "POS aç",
    desc: "Sürətli kassa satışı",
    icon: ScanLine,
    gradient: "from-emerald-500/15 via-emerald-500/8 to-teal-500/5",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
    external: true,
    hero: true,
    anyPermission: ["pos.satis", "pos.istifade", "satis.yarat", "trade.create_sale"],
  },
  {
    href: "/ticaret/satis-yeni",
    label: "Yeni satış",
    desc: "Formal sifariş / qaimə",
    icon: PlusCircle,
    gradient: "from-sky-500/15 via-sky-500/8 to-blue-500/5",
    iconBg: "bg-gradient-to-br from-sky-500 to-blue-600 text-white",
    anyPermission: ["satis.yarat", "trade.create_sale", "satis.formal"],
  },
  {
    href: "/anbar/satinalma",
    label: "Yeni alış qaiməsi",
    desc: "Təchizatçıdan mal qəbulu",
    icon: Receipt,
    gradient: "from-violet-500/15 via-violet-500/8 to-purple-500/5",
    iconBg: "bg-gradient-to-br from-violet-500 to-purple-600 text-white",
    anyPermission: ["alis.yarat", "trade.create_purchase", "satinalma.yarat"],
  },
  {
    // Birbaşa dialog avtomatik açan parametrlə servis siyahısına gedir
    href: "/servis?yeni=1",
    label: "Yeni servis",
    desc: "Təmir qəbulu",
    icon: Wrench,
    gradient: "from-amber-500/15 via-amber-500/8 to-orange-500/5",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
    anyPermission: ["servis.yarat", "servis.idare"],
  },
  {
    // Birbaşa dialog avtomatik açan parametrlə əlaqələrə gedir
    href: "/elaqe?yeni=1",
    label: "Yeni müştəri",
    desc: "Kontragent əlavə et",
    icon: UserPlus,
    gradient: "from-pink-500/15 via-pink-500/8 to-rose-500/5",
    iconBg: "bg-gradient-to-br from-pink-500 to-rose-600 text-white",
    anyPermission: ["musteri.yarat", "musteri.create", "musteri.idare", "elaqe.yarat"],
  },
];

export function DashboardQuickActions({
  icazeler,
  rolAd,
}: {
  icazeler?: string[];
  rolAd?: string;
} = {}) {
  // Sahibkar / admin / owner heç bir icazə yoxlamasına ehtiyac yoxdur
  const r = (rolAd ?? "").toLowerCase();
  const isPrivileged = r.includes("sahibkar") || r.includes("admin") || r.includes("owner");

  const visible = ACTIONS.filter((a) => {
    if (isPrivileged) return true;
    if (!a.anyPermission || a.anyPermission.length === 0) return true;
    if (!icazeler || icazeler.length === 0) return false;
    return a.anyPermission.some((p) => icazeler.includes(p));
  });

  if (visible.length === 0) return null;

  return (
    <section
      aria-label="Sürətli əməliyyatlar"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"
    >
      {visible.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href}
            href={a.href}
            target={a.external ? "_blank" : undefined}
            rel={a.external ? "noopener" : undefined}
            className={`group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br ${a.gradient} px-3.5 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-foreground/5 ${a.hero ? "col-span-2 md:col-span-1 lg:col-span-1" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div
                className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg shadow-sm transition-transform duration-200 group-hover:scale-110 ${a.iconBg}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 -translate-x-1 -translate-y-1 text-muted-foreground/40 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-primary group-hover:opacity-100" />
            </div>
            <div className="mt-3 space-y-0.5">
              <div className="text-sm font-bold tracking-tight">{a.label}</div>
              <div className="text-[11px] leading-tight text-muted-foreground line-clamp-1">
                {a.desc}
              </div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
