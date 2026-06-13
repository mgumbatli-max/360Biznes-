"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hər path segment-i üçün AZ etiketi.
 * Tapılmayan key-lər üçün capitalize + decodeURIComponent fallback.
 */
const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  pos: "POS",
  "market-pos": "Marketdən satış",
  ticaret: "Ticarət",
  satislar: "Satışlar",
  "satis-yeni": "Yeni satış",
  alislar: "Alışlar",
  kredit: "Kreditlə satış",
  "kredit-yeni": "Yeni kredit",
  qaytarma: "Qaytarmalar",
  tez: "Tez qaytarma",
  emeliyyat: "Əməliyyatlar",
  teklif: "Təkliflər",
  "market-satis": "Marketdən satış",
  hesabat: "Hesabat",
  heatmap: "Heatmap",
  print: "Çap",
  anbar: "Anbar",
  mehsullar: "Məhsullar",
  stok: "Stok",
  inventar: "İnventar",
  transfer: "Transfer",
  hereketler: "Hərəkətlər",
  bron: "Bron",
  konsiqnasiya: "Konsiqnasiya",
  qiymet: "Qiymət",
  markalar: "Markalar",
  "mehsul-yukle": "Məhsul yüklə",
  anomali: "Anomali",
  "etiket-cap": "Etiket çapı",
  maliyye: "Maliyyə",
  hesab: "Hesab",
  bank: "Bank",
  debitor: "Debitor",
  kreditor: "Kreditor",
  marketplace: "Marketplace",
  "pul-axini": "Pul axını",
  xercler: "Xərclər",
  kassalar: "Kassalar",
  "gun-sonu": "Gün sonu",
  elaqe: "Əlaqə",
  musteriler: "Müştərilər",
  techizatcilar: "Təçhizatçılar",
  borclar: "Borclar",
  dublikat: "Dublikat",
  followup: "Follow-up",
  crm: "CRM",
  leadler: "Lead-lər",
  inbox: "Inbox",
  broadcast: "Broadcast",
  sablonlar: "Şablonlar",
  funnel: "Funnel",
  segment: "Seqment",
  kpi: "KPI",
  "ai-cavab": "AI cavab",
  iscilier: "İşçilər",
  maas: "Maaş",
  davamiyyet: "Davamiyyət",
  mezuniyyet: "Məzuniyyət",
  servis: "Servis",
  zemanet: "Zəmanət",
  "problemli-mehsullar": "Problemli məhsullar",
  sla: "SLA",
  hesabatlar: "Hesabatlar",
  satis: "Satış",
  mehsul: "Məhsul",
  musteri: "Müştəri",
  pul: "Pul",
  emekdas: "Əməkdaş",
  idxal: "İdxal",
  ai: "AI",
  sahibkar: "Sahibkar",
  audit: "Audit",
  magaza: "Mağaza",
  maya: "Maya",
  not: "Qeyd",
  partiya: "Partiya",
  qeyd: "Qeyd",
  snapshot: "Snapshot",
  tapshiriq: "Tapşırıq",
  setup: "Setup",
  verify: "PIN",
  filiallar: "Filiallar",
  "filial-muqayise": "Filial müqayisəsi",
  "data-saglamligi": "Data sağlamlığı",
  isci: "İşçi",
  mobile: "Mobil",
  webhook: "Webhook",
  "audit-log": "Audit log",
  tapshiriqlar: "Tapşırıqlar",
  avtomatlasdirma: "Avtomatlaşdırma",
  xeberdarliqlar: "Bildirişlər",
  tesdiq: "Təsdiq",
  satinalma: "Satınalma",
  ayarlar: "Ayarlar",
  rollar: "Rollar",
  istifadeci: "İstifadəçilər",
  kompaniya: "Kompaniya",
  abune: "Abunə",
  backup: "Backup",
  bildiris: "Bildiriş",
  "pos-qiymet": "POS qiymət",
  "qiymet-icaze": "Qiymət icazə",
  "qiymet-tipi": "Qiymət tipləri",
  "mp-komisyon": "MP komissiya",
  "sened-sablon": "Sənəd şablon",
  "xerc-kateqoriya": "Xərc kateqoriya",
  "satis-hedef": "Satış hədəfi",
  "platform-admin": "Platform Admin",
  tenantlar: "Tenantlar",
  paketler: "Paketlər",
  "sistem-saglamligi": "Sistem sağlamlığı",
};

/**
 * Səhifəsi olmayan "qruplaşdırıcı" ara-yollar — breadcrumb-da klikləyici link YOX,
 * sadə mətn kimi göstərilir (əks halda 404 link yaranır).
 */
const NON_NAVIGABLE = new Set<string>([
  "/ticaret/hesabat",
  "/kampaniyalar/kart",
]);

function labelFor(seg: string): string {
  if (LABELS[seg]) return LABELS[seg];
  // UUID — "Detal" göstər
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return "Detal";
  if (/^\d+$/.test(seg)) return "#" + seg;
  try {
    const dec = decodeURIComponent(seg);
    return dec.charAt(0).toUpperCase() + dec.slice(1).replace(/-/g, " ");
  } catch {
    return seg;
  }
}

type Props = {
  compact?: boolean;
};

export function Breadcrumb({ compact = false }: Props) {
  const pathname = usePathname() || "/dashboard";
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;
  const first = segments[0];
  if (["login", "qeydiyyat", "onboarding"].includes(first)) return null;
  if (segments.includes("print")) return null;

  const crumbs = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    return { seg, href, label: labelFor(seg) };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center gap-1 text-sm",
        compact ? "max-w-[200px] overflow-hidden" : ""
      )}
    >
      <Link
        href="/dashboard"
        className="inline-flex items-center rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Ana səhifə"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        if (compact && i < crumbs.length - 2) return null;
        const navigable = !isLast && !NON_NAVIGABLE.has(c.href);
        return (
          <span key={c.href} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
            {!navigable ? (
              <span
                className={cn(
                  "truncate",
                  isLast ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
                aria-current={isLast ? "page" : undefined}
              >
                {c.label}
              </span>
            ) : (
              <Link
                href={c.href}
                className="truncate rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
