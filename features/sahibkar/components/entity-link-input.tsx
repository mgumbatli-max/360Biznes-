"use client";

import { Link2, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Polymorphic entity-link tipi — sahibkar_qeyd, sahibkar_tapshiriq və
 * sahibkar_gizli_elaqe üçün ümumi link sxemi (link_nov + link_id + link_label).
 * Sənədlər (senedler) öz JSON tree-də saxladığı SenedLink ilə eyni növ adlarını
 * paylaşır.
 */
export type EntityLinkNov =
  | "satinalma" | "satis" | "mehsul" | "musteri" | "techizatci"
  | "partiya"   | "tapshiriq" | "qaime" | "qeyd" | "diger";

export const ENTITY_NOV_LABELS: Record<EntityLinkNov, string> = {
  satinalma:  "Alış (satınalma)",
  satis:      "Satış sənədi",
  mehsul:     "Məhsul",
  musteri:    "Müştəri",
  techizatci: "Təchizatçı",
  partiya:    "Partiya (idxal)",
  tapshiriq:  "Tapşırıq",
  qaime:      "Qaimə",
  qeyd:       "Qeyd",
  diger:      "Digər",
};

const NOV_TONE: Record<EntityLinkNov, string> = {
  satinalma:  "bg-amber-500/15 text-amber-600 border-amber-500/40 dark:text-amber-400",
  satis:      "bg-emerald-500/15 text-emerald-600 border-emerald-500/40 dark:text-emerald-400",
  mehsul:     "bg-sky-500/15 text-sky-600 border-sky-500/40 dark:text-sky-400",
  musteri:    "bg-violet-500/15 text-violet-600 border-violet-500/40 dark:text-violet-400",
  techizatci: "bg-orange-500/15 text-orange-600 border-orange-500/40 dark:text-orange-400",
  partiya:    "bg-indigo-500/15 text-indigo-600 border-indigo-500/40 dark:text-indigo-400",
  tapshiriq:  "bg-rose-500/15 text-rose-600 border-rose-500/40 dark:text-rose-400",
  qaime:      "bg-teal-500/15 text-teal-600 border-teal-500/40 dark:text-teal-400",
  qeyd:       "bg-yellow-500/15 text-yellow-600 border-yellow-500/40 dark:text-yellow-400",
  diger:      "bg-slate-500/15 text-slate-600 border-slate-500/40 dark:text-slate-400",
};

/**
 * Bağlantı növü → URL prefix-i.
 * Bağlı element üzərinə klikləyəndə həmin sənədə tez keçid üçün.
 */
const NOV_HREF: Record<EntityLinkNov, (id: string) => string> = {
  satinalma:  (id) => `/satinalma/${id}`,
  satis:      (id) => `/ticaret/satislar/${id}`,
  mehsul:     (id) => `/anbar/mehsullar/${id}`,
  musteri:    (id) => `/elaqe/musteriler/${id}`,
  techizatci: (id) => `/elaqe/techizatcilar/${id}`,
  partiya:    (id) => `/sahibkar/partiya/${id}`,
  tapshiriq:  () => `/sahibkar/tapshiriq`, // focus query yox — list səhifəsinə aparır
  qaime:      (id) => `/ticaret/satislar/${id}`,
  qeyd:       () => `/sahibkar/qeyd`,
  diger:      () => `#`,
};

export function entityLinkHref(nov: EntityLinkNov, id: string): string {
  const fn = NOV_HREF[nov];
  return fn ? fn(id) : "#";
}

/** Validates a string from DB; falls back to "diger" if invalid. */
export function toEntityLinkNov(s: string | null | undefined): EntityLinkNov {
  return s && s in ENTITY_NOV_LABELS ? (s as EntityLinkNov) : "diger";
}

export function EntityLinkBadge({
  nov,
  id,
  label,
  withHref,
  size = "sm",
}: {
  nov: EntityLinkNov;
  id: string;
  label?: string | null;
  withHref?: boolean;
  size?: "xs" | "sm";
}) {
  const tone = NOV_TONE[nov] ?? NOV_TONE.diger;
  const text = label && label.trim() ? label : `${ENTITY_NOV_LABELS[nov]}: ${id}`;
  const content = (
    <Badge variant="outline" className={`${size === "xs" ? "text-[9px]" : "text-[10px]"} ${tone}`}>
      <Link2 className="h-2.5 w-2.5" /> {text}
    </Badge>
  );
  if (withHref) {
    return (
      <a href={entityLinkHref(nov, id)} className="inline-block">
        {content}
      </a>
    );
  }
  return content;
}

/**
 * Forma sahəsi kimi istifadə olunan inline link picker — Dialog deyil, sadəcə
 * 3 input (nov dropdown, id, label) və "Sil" düyməsi. Formanın özünə input-larla
 * birlikdə nov/id/label sahələrini submit edir.
 *
 * Quraşdırılması — controlled component:
 *   <EntityLinkInput
 *     initial={{ nov: "satinalma", id: "1234", label: "Alış #1234" }}
 *     fieldPrefix="link_"   // submit-də link_nov, link_id, link_label adı ilə getsin
 *   />
 */
export function EntityLinkInput({
  initial,
  fieldPrefix = "link_",
}: {
  initial?: { nov?: string | null; id?: string | null; label?: string | null };
  fieldPrefix?: string;
}) {
  const initialNov = (initial?.nov as EntityLinkNov | undefined) ?? null;
  const [active, setActive] = useState<boolean>(!!(initialNov && initial?.id));
  const [nov, setNov] = useState<EntityLinkNov>(initialNov ?? "satinalma");
  const [id, setId] = useState<string>(initial?.id ?? "");
  const [label, setLabel] = useState<string>(initial?.label ?? "");

  if (!active) {
    return (
      <div>
        {/* Boş submit — backend "" gəldikdə null yazır */}
        <input type="hidden" name={`${fieldPrefix}nov`} value="" />
        <input type="hidden" name={`${fieldPrefix}id`} value="" />
        <input type="hidden" name={`${fieldPrefix}label`} value="" />
        <button
          type="button"
          onClick={() => setActive(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-secondary/30 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          <Link2 className="h-3 w-3" /> Başqa bölmə ilə bağla
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-2.5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Link2 className="h-3 w-3" /> Bağlantı
        </span>
        <button
          type="button"
          onClick={() => { setActive(false); setId(""); setLabel(""); }}
          className="inline-flex items-center gap-1 text-[10px] text-rose-500 hover:underline"
          title="Bağlantını sıfırla"
        >
          <X className="h-3 w-3" /> Sil
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <select
          name={`${fieldPrefix}nov`}
          value={nov}
          onChange={(e) => setNov(e.target.value as EntityLinkNov)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {(Object.keys(ENTITY_NOV_LABELS) as EntityLinkNov[]).map((k) => (
            <option key={k} value={k}>{ENTITY_NOV_LABELS[k]}</option>
          ))}
        </select>
        <input
          name={`${fieldPrefix}id`}
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="ID / kod"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          name={`${fieldPrefix}label`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Etiket (məs. Alış #1234)"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Bu element başqa bir bölmənin sənədinə (alış, satış, məhsul, müştəri, partiya və s.) bağlanır. Bağlantı yalnız sahibkar görüşündə göstərilir.
      </p>
    </div>
  );
}
