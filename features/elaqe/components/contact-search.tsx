"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Manager = { id: string; ad_soyad: string };

type Props = {
  basePath: string;
  showTip?: boolean;
  showSegments?: boolean;
  managers?: Manager[];
  countries?: { olke: string; count: number }[];
  cities?: { sheher: string; count: number }[];
};

const TIP_OPTIONS = [
  { value: "musteri",    label: "Müştəri" },
  { value: "techizatci", label: "Təchizatçı" },
  { value: "her_ikisi",  label: "Hər ikisi" },
];

const SEGMENT_OPTIONS = [
  { value: "adi",      label: "Pərakəndə" },
  { value: "topdan",   label: "Topdan" },
  { value: "partnyor", label: "Diller / Partnyor" },
  { value: "vip",      label: "VIP / Korporativ" },
];

const STATUS_OPTIONS = [
  { value: "aktiv",  label: "Aktiv" },
  { value: "passiv", label: "Passiv" },
];

export function ContactSearch({ basePath, showTip, showSegments, managers = [], countries = [], cities = [] }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const search = sp.get("q") ?? "";
  const borc = sp.get("borc") ?? "";
  const tip = sp.get("tip") ?? "";
  const qiymet = sp.get("qiymet") ?? "";
  const status = sp.get("status") ?? "";
  const menecer = sp.get("menecer") ?? "";
  const olke = sp.get("olke") ?? "";
  const sheher = sp.get("sheher") ?? "";
  const yatmis = sp.get("yatmis") === "1";
  const dogumAy = sp.get("dogum_ay") === "1";
  const vip = sp.get("vip") === "1";
  const qara = sp.get("qara") === "1";
  const yeni = sp.get("yeni") === "1";

  function toggleFlag(key: string, active: boolean) {
    update((p) => (active ? p.delete(key) : p.set(key, "1")));
  }

  const update = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString());
    mutate(p);
    startTransition(() => router.push(`${basePath}?${p.toString()}`));
  };

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    update((p) => {
      if (q) p.set("q", q);
      else p.delete("q");
    });
  }

  const hasFilter = !!(search || borc || tip || qiymet || status || menecer || olke || sheher || yatmis || dogumAy || vip || qara || yeni);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/40 p-3">
      {/* Search + reset */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={onSearch} className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Ad, telefon, email, VÖEN, FİN, IBAN..."
            className="h-9 pl-8"
            disabled={pending}
          />
        </form>

        {hasFilter && (
          <Button size="sm" variant="ghost" onClick={() => router.push(basePath)} disabled={pending} className="ml-auto">
            <X className="h-3.5 w-3.5" /> Sıfırla
          </Button>
        )}
      </div>

      {/* Section: Hadisə */}
      <Section label="Vəziyyət">
        <Pill label="Hamısı" active={!hasFilter} pending={pending} onClick={() => router.push(basePath)} />
        <Pill label="VIP" active={vip} pending={pending} onClick={() => toggleFlag("vip", vip)} tone="warning" />
        <Pill label="Yeni 7 gün" active={yeni} pending={pending} onClick={() => toggleFlag("yeni", yeni)} tone="info" />
        <Pill label="Borclu" active={borc === "var"} pending={pending} onClick={() => update((p) => (borc === "var" ? p.delete("borc") : p.set("borc", "var")))} tone="danger" />
        <Pill label="Borcsuz" active={borc === "yox"} pending={pending} onClick={() => update((p) => (borc === "yox" ? p.delete("borc") : p.set("borc", "yox")))} />
        <Pill label="Yatmış 90+ gün" active={yatmis} pending={pending} onClick={() => toggleFlag("yatmis", yatmis)} tone="warning" />
        <Pill label="Doğum bu ay" active={dogumAy} pending={pending} onClick={() => toggleFlag("dogum_ay", dogumAy)} tone="info" />
        <Pill label="Qara siyahı" active={qara} pending={pending} onClick={() => toggleFlag("qara", qara)} tone="danger" />
      </Section>

      {/* Section: Tip + Segment (when not handled by SegmentTabs above) */}
      {(showTip || showSegments) && (
        <Section label={showTip ? "Növ və segment" : "Segment"}>
          {showTip &&
            TIP_OPTIONS.map((o) => (
              <Pill
                key={o.value}
                label={o.label}
                active={tip === o.value}
                pending={pending}
                onClick={() => update((p) => (tip === o.value ? p.delete("tip") : p.set("tip", o.value)))}
              />
            ))}
          {showTip && showSegments && <Sep />}
          {showSegments &&
            SEGMENT_OPTIONS.map((o) => (
              <Pill
                key={o.value}
                label={o.label}
                active={qiymet === o.value}
                pending={pending}
                onClick={() => update((p) => (qiymet === o.value ? p.delete("qiymet") : p.set("qiymet", o.value)))}
              />
            ))}
        </Section>
      )}

      {/* Section: Status + Məsul + Coğrafi */}
      <Section label="Status / Məsul / Yer">
        {STATUS_OPTIONS.map((o) => (
          <Pill
            key={o.value}
            label={o.label}
            active={status === o.value}
            pending={pending}
            onClick={() => update((p) => (status === o.value ? p.delete("status") : p.set("status", o.value)))}
          />
        ))}

        {managers.length > 0 && (
          <select
            value={menecer}
            disabled={pending}
            onChange={(e) =>
              update((p) => (e.target.value ? p.set("menecer", e.target.value) : p.delete("menecer")))
            }
            className="h-7 rounded-full border border-border bg-card px-2 text-xs text-muted-foreground"
          >
            <option value="">Hamı (məsul)</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.ad_soyad}</option>
            ))}
          </select>
        )}

        {countries.length > 0 && (
          <select
            value={olke}
            disabled={pending}
            onChange={(e) =>
              update((p) => (e.target.value ? p.set("olke", e.target.value) : p.delete("olke")))
            }
            className="h-7 rounded-full border border-border bg-card px-2 text-xs text-muted-foreground"
          >
            <option value="">Bütün ölkələr</option>
            {countries.map((c) => (
              <option key={c.olke} value={c.olke}>
                {c.olke} ({c.count})
              </option>
            ))}
          </select>
        )}

        {cities.length > 0 && (
          <select
            value={sheher}
            disabled={pending}
            onChange={(e) =>
              update((p) => (e.target.value ? p.set("sheher", e.target.value) : p.delete("sheher")))
            }
            className="h-7 inline-flex items-center rounded-full border border-border bg-card px-2 text-xs text-muted-foreground"
          >
            <option value="">Bütün şəhərlər</option>
            {cities.map((c) => (
              <option key={c.sheher} value={c.sheher}>
                {c.sheher} ({c.count})
              </option>
            ))}
          </select>
        )}

        {(olke || sheher) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
            <MapPin className="h-2.5 w-2.5" />
            {[olke, sheher].filter(Boolean).join(" · ")}
          </span>
        )}
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Sep() {
  return <span className="mx-1 h-4 w-px bg-border" />;
}

function Pill({
  label, active, pending, onClick, tone,
}: {
  label: string;
  active: boolean;
  pending: boolean;
  onClick: () => void;
  tone?: "warning" | "danger" | "info";
}) {
  const activeClass = tone === "warning"
    ? "border-warning/40 bg-warning/15 text-warning"
    : tone === "danger"
    ? "border-danger/40 bg-danger/15 text-danger"
    : tone === "info"
    ? "border-info/40 bg-info/15 text-info"
    : "border-primary/40 bg-primary/15 text-primary-light";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition",
        active ? activeClass : "border-border bg-card text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
