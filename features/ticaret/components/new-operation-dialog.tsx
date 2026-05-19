"use client";

/**
 * "Yeni əməliyyat" — entry-point dropdown rendered in the Ticarət header.
 *
 * Two-step UX:
 *   1.  User clicks "Yeni əməliyyat" → opens the **picker** dialog with
 *       grouped tiles (Satış / Alış / Qaytarma / Anbar əməliyyatları).
 *   2.  Clicking a tile either:
 *         a) opens a **native compact modal** (Yeni satış, Yeni alış …) —
 *            no iframe, the dashboard underneath stays visible/faded; or
 *         b) navigates to a full standalone page in the same tab
 *            (kredit-yeni, teklif, transfer, inventar, mexaric, qaytarma); or
 *         c) opens a new tab (POS, Marketdən satış — both `external: true`).
 *
 * Previous version embedded the standalone forms via `<PageModal>` iframes;
 * that broke maliyə hooks and was visually wrong (full-screen vs. compact).
 * The iframe approach has been removed entirely here.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  ShoppingCart,
  ScanBarcode,
  Truck,
  CreditCard,
  FileText,
  Undo2,
  ArrowLeftRight,
  ClipboardList,
  PackageMinus,
  Boxes,
  Bike,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { YeniSatisModal } from "./yeni-satis-modal";
import { YeniAlisModal } from "./yeni-alis-modal";
import {
  getSatisOptions,
  getAlisOptions,
  type SatisOptions,
  type AlisOptions,
} from "../operation-options-actions";

type ModalKey = "satis" | "alis";

type Tile = {
  label: string;
  desc: string;
  href: string;
  Icon: LucideIcon;
  tone: "rose" | "emerald" | "violet" | "amber" | "sky" | "slate";
  /** Opens in a new tab (e.g. POS). */
  external?: boolean;
  /** Skip modal — navigate normally (used for list pages, not creation forms). */
  navigate?: boolean;
  /** Open a native compact modal instead of navigating. */
  modal?: ModalKey;
};

const TONE: Record<Tile["tone"], string> = {
  rose:    "bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100",
  violet:  "bg-violet-50 text-violet-700 ring-violet-200 hover:bg-violet-100",
  amber:   "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100",
  sky:     "bg-sky-50 text-sky-700 ring-sky-200 hover:bg-sky-100",
  slate:   "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-slate-100",
};

const GROUPS: { group: string; tiles: Tile[] }[] = [
  {
    group: "Satış",
    tiles: [
      { label: "POS — İsti satış",   desc: "Sürətli kassa satışı (yeni pəncərə)", href: "/pos",                Icon: ScanBarcode,  tone: "rose",    external: true },
      { label: "Yeni satış",         desc: "Müştəri + müqavilə (modal)",          href: "/ticaret/satis-yeni", Icon: ShoppingCart, tone: "emerald", modal: "satis" },
      { label: "Marketdən satış",    desc: "Bolt / Wolt / Tap.az (yeni pəncərə)", href: "/market-pos",         Icon: Bike,         tone: "sky",     external: true },
      { label: "Yeni təklif",        desc: "Müştəriyə təklif (qaralama)",         href: "/ticaret/teklif?new=1", Icon: FileText,   tone: "violet",  navigate: true },
      { label: "Kreditlə satış",     desc: "Bank kreditli satış, faiz hesabı",    href: "/ticaret/kredit-yeni", Icon: CreditCard,  tone: "amber",   navigate: true },
    ],
  },
  {
    group: "Alış",
    tiles: [
      { label: "Yeni alış sifarişi", desc: "Təchizatçıdan mal qəbulu (modal)",    href: "/ticaret/alislar",         Icon: Truck, tone: "sky",   modal: "alis" },
      { label: "Təchizatçılar",      desc: "Yeni təchizatçı əlavə et",            href: "/elaqe?nov=techizatci",    Icon: Truck, tone: "slate", navigate: true },
    ],
  },
  {
    group: "Qaytarma",
    tiles: [
      { label: "Tez qaytarma (skan)", desc: "Barkod / sifariş kodu ilə cəld qaytarma", href: "/ticaret/qaytarma/tez", Icon: ScanBarcode, tone: "rose",  navigate: true },
      { label: "Bütün qaytarmalar",   desc: "Satış/alış qaytarmaları siyahısı",        href: "/ticaret/qaytarma",     Icon: Undo2,       tone: "slate", navigate: true },
    ],
  },
  {
    group: "Anbar əməliyyatları",
    tiles: [
      { label: "Anbarlararası transfer", desc: "Mal bir anbardan digərinə",      href: "/anbar/transfer",                Icon: ArrowLeftRight, tone: "violet", navigate: true },
      { label: "İnventar sayımı",         desc: "Stok sayım və düzəliş",          href: "/anbar/inventar",                Icon: ClipboardList,  tone: "amber",  navigate: true },
      { label: "Mexaric / Zay",           desc: "Korrupsiya, daxili istifadə",    href: "/anbar/hereketler?nov=mexaric",  Icon: PackageMinus,   tone: "rose",   navigate: true },
      { label: "Stok hərəkətləri",        desc: "Bütün anbar əməliyyatları",       href: "/anbar/hereketler",              Icon: Boxes,          tone: "sky",    navigate: true },
    ],
  },
];

export function NewOperationButton() {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Active native modal (only one open at a time).
  const [activeModal, setActiveModal] = useState<ModalKey | null>(null);
  const [satisOpts, setSatisOpts] = useState<SatisOptions | null>(null);
  const [alisOpts, setAlisOpts] = useState<AlisOptions | null>(null);

  async function openTile(t: Tile) {
    setPickerOpen(false);
    if (t.modal === "satis") {
      if (!satisOpts) setSatisOpts(await getSatisOptions());
      setActiveModal("satis");
    } else if (t.modal === "alis") {
      if (!alisOpts) setAlisOpts(await getAlisOptions());
      setActiveModal("alis");
    } else if (t.navigate) {
      router.push(t.href);
    }
    // external tiles use a real <Link target="_blank"> below.
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
        style={{ background: "var(--brand-gradient)" }}
      >
        <Plus className="h-3.5 w-3.5" />
        Yeni əməliyyat
      </button>

      {/* Picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base">Yeni əməliyyat seç</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {GROUPS.map((g) => (
              <div key={g.group}>
                <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.group}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {g.tiles.map((t) => {
                    const tileBody = (
                      <>
                        <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md bg-white/70 ring-1 ring-inset ring-white/40">
                          <t.Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-1.5 text-sm font-semibold">
                            {t.label}
                            {t.external && (
                              <ExternalLink className="h-3 w-3 opacity-60" />
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] opacity-80">{t.desc}</div>
                        </div>
                      </>
                    );
                    const className = `group flex items-start gap-3 rounded-lg p-3 ring-1 ring-inset transition ${TONE[t.tone]}`;

                    if (t.external) {
                      return (
                        <Link
                          key={t.href}
                          href={t.href}
                          target="_blank"
                          rel="noopener"
                          onClick={() => setPickerOpen(false)}
                          className={className}
                        >
                          {tileBody}
                        </Link>
                      );
                    }

                    return (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => openTile(t)}
                        className={className}
                      >
                        {tileBody}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Native modals */}
      {satisOpts && (
        <YeniSatisModal
          open={activeModal === "satis"}
          onOpenChange={(v) => !v && setActiveModal(null)}
          anbarlar={satisOpts.anbarlar}
          saticilar={satisOpts.saticilar}
          defaultSalespersonId={satisOpts.saticilar[0]?.id ?? null}
        />
      )}
      {alisOpts && (
        <YeniAlisModal
          open={activeModal === "alis"}
          onOpenChange={(v) => !v && setActiveModal(null)}
          anbarlar={alisOpts.anbarlar}
          suppliers={alisOpts.suppliers}
          menecerler={alisOpts.menecerler}
          defaultManagerId={alisOpts.menecerler[0]?.id ?? null}
        />
      )}
    </>
  );
}
