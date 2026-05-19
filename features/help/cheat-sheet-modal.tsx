"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Keyboard } from "lucide-react";

type Shortcut = { keys: string[]; desc: string };
type ShortcutGroup = { title: string; items: Shortcut[] };

const COMMON: ShortcutGroup[] = [
  {
    title: "Ümumi",
    items: [
      { keys: ["⌘", "K"], desc: "Qlobal axtarış" },
      { keys: ["⌘", "/"], desc: "Bu cədvəli aç (klaviatura)" },
      { keys: ["?"], desc: "Bu cədvəli aç" },
      { keys: ["⌘", "N"], desc: "Yeni əməliyyat (səhifəyə uyğun)" },
      { keys: ["Esc"], desc: "Modal/dialoqu bağla" },
    ],
  },
  {
    title: "Naviqasiya",
    items: [
      { keys: ["G", "D"], desc: "Dashboard" },
      { keys: ["G", "S"], desc: "Satışlar" },
      { keys: ["G", "M"], desc: "Maliyyə əməliyyatları" },
      { keys: ["G", "A"], desc: "Anbar (məhsullar)" },
      { keys: ["G", "T"], desc: "Tapşırıqlar" },
    ],
  },
];

const TICARET: ShortcutGroup[] = [
  {
    title: "Ticarət — Satış",
    items: [
      { keys: ["⌘", "N"], desc: "Yeni satış (/ticaret altında)" },
      { keys: ["Enter"], desc: "Növbəti sahə / final-da: Submit" },
      { keys: ["↑", "↓"], desc: "Cədvəl sətirləri arası" },
    ],
  },
];

const MALIYYE: ShortcutGroup[] = [
  {
    title: "Maliyyə — Əməliyyat",
    items: [
      { keys: ["⌘", "N"], desc: "Yeni əməliyyat (/maliyye altında)" },
      { keys: ["Enter"], desc: "Növbəti sahə / final-da: Submit" },
    ],
  },
];

const ANBAR: ShortcutGroup[] = [
  {
    title: "Anbar — Məhsul",
    items: [
      { keys: ["⌘", "N"], desc: "Yeni məhsul (/anbar altında)" },
      { keys: ["Enter"], desc: "Növbəti sahə / final-da: Submit" },
    ],
  },
];

const TAPSHIRIQ: ShortcutGroup[] = [
  {
    title: "Tapşırıq",
    items: [
      { keys: ["⌘", "N"], desc: "Yeni tapşırıq (/tapshiriqlar altında)" },
      { keys: ["Enter"], desc: "Növbəti sahə" },
    ],
  },
];

function KbdChip({ k }: { k: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-border/60 bg-card px-1.5 font-mono text-[11px] font-semibold text-foreground shadow-sm">
      {k}
    </kbd>
  );
}

function GroupBlock({ group }: { group: ShortcutGroup }) {
  return (
    <div className="rounded-md border border-border/60 bg-card/50 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {group.title}
      </div>
      <ul className="space-y-1.5">
        {group.items.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-foreground">{s.desc}</span>
            <span className="flex items-center gap-1">
              {s.keys.map((k, ki) => (
                <KbdChip key={ki} k={k} />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function CheatSheetModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-rose-500" />
            Klaviatura qısayolları
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="umumi" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="umumi">Ümumi</TabsTrigger>
            <TabsTrigger value="ticaret">Ticarət</TabsTrigger>
            <TabsTrigger value="maliyye">Maliyyə</TabsTrigger>
            <TabsTrigger value="anbar">Anbar</TabsTrigger>
            <TabsTrigger value="tapshiriq">Tapşırıq</TabsTrigger>
          </TabsList>

          <TabsContent value="umumi" className="space-y-3 pt-3">
            {COMMON.map((g) => <GroupBlock key={g.title} group={g} />)}
          </TabsContent>
          <TabsContent value="ticaret" className="space-y-3 pt-3">
            {TICARET.map((g) => <GroupBlock key={g.title} group={g} />)}
          </TabsContent>
          <TabsContent value="maliyye" className="space-y-3 pt-3">
            {MALIYYE.map((g) => <GroupBlock key={g.title} group={g} />)}
          </TabsContent>
          <TabsContent value="anbar" className="space-y-3 pt-3">
            {ANBAR.map((g) => <GroupBlock key={g.title} group={g} />)}
          </TabsContent>
          <TabsContent value="tapshiriq" className="space-y-3 pt-3">
            {TAPSHIRIQ.map((g) => <GroupBlock key={g.title} group={g} />)}
          </TabsContent>
        </Tabs>

        <div className="pt-2 text-center text-[11px] text-muted-foreground">
          Tip: G + S kimi chord qısayollarda iki düyməni 1 saniyə içində ardıcıl basın.
        </div>
      </DialogContent>
    </Dialog>
  );
}
