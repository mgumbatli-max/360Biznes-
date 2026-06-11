"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ScrollActiveIntoView } from "@/components/scroll-active-into-view";
import { SUBNAV_CONTAINER, subnavTabClass } from "@/features/shared/subnav-styles";
import { useIcmalOn } from "@/features/shared/use-icmal";

const NewOperationButton = dynamic(
  () => import("@/features/ticaret/components/new-operation-dialog").then((m) => m.NewOperationButton),
  { ssr: false },
);
import {
  LayoutDashboard,
  Activity,
  FileText,
  ShoppingCart,
  Truck,
  CreditCard,
  Undo2,
  type LucideIcon,
} from "lucide-react";

/**
 * Ticarət subnav — FLAT: bütün bölmələr bir cərgədə (Maliyyə standartı,
 * "Sənədlər" ara-qrupu LƏĞV edildi — əlavə klik yox idi tələbi).
 * "İcmal" tabı yalnız ayar+icazə açıq olduqda görünür (data-icmal).
 */

type Tab = {
  href: string;
  label: string;
  Icon: LucideIcon;
  alsoActiveFor?: string[];
};

const TABS: Tab[] = [
  { href: "/ticaret/emeliyyat", label: "Əməliyyatlar", Icon: Activity },
  { href: "/ticaret/satislar", label: "Satış", Icon: ShoppingCart, alsoActiveFor: ["/ticaret/pipeline", "/ticaret/satis-yeni", "/ticaret/market-satis"] },
  { href: "/ticaret/teklif", label: "Təkliflər", Icon: FileText, alsoActiveFor: ["/ticaret/teklif-pdf"] },
  { href: "/ticaret/alislar", label: "Alış", Icon: Truck },
  { href: "/ticaret/kredit", label: "Kreditlə", Icon: CreditCard, alsoActiveFor: ["/ticaret/kredit-yeni"] },
  { href: "/ticaret/qaytarma", label: "Qaytarma", Icon: Undo2 },
];

function isTabActive(tab: Tab, active: string): boolean {
  if (tab.href === active || active.startsWith(tab.href + "/")) return true;
  return tab.alsoActiveFor?.some((p) => active === p || active.startsWith(p + "/")) ?? false;
}

export function TicaretSubNav({ active }: { active: string }) {
  const icmalOn = useIcmalOn("ticaret");
  const isIcmal = active === "/ticaret";

  return (
    <div className="space-y-2 mb-4" data-subnav>
      <div className={SUBNAV_CONTAINER}>
        <ScrollActiveIntoView className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto scrollbar-thin">
          {(icmalOn || isIcmal) && (
            <Link
              href="/ticaret"
              data-active={isIcmal ? "true" : undefined}
              className={subnavTabClass(isIcmal)}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>İcmal</span>
            </Link>
          )}
          {TABS.map((t) => {
            const isOn = isTabActive(t, active);
            return (
              <Link
                key={t.href}
                href={t.href}
                data-active={isOn ? "true" : undefined}
                className={subnavTabClass(isOn)}
              >
                <t.Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </Link>
            );
          })}
        </ScrollActiveIntoView>
        <div className="shrink-0 pr-1">
          <NewOperationButton />
        </div>
      </div>
    </div>
  );
}
