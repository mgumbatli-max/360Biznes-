"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Eye, Zap, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LITE_MODULES,
  MODULE_LANDINGS,
  DENSITY_OPTIONS,
  FONT_OPTIONS,
  MOBILE_LAYOUT_OPTIONS,
  ACCENT_OPTIONS,
} from "@/lib/lite/registry";
import { saveLiteConfig } from "@/features/ayar/lite-actions";
import type { LiteConfig } from "@/lib/lite/config";

const FONT_PX: Record<string, number> = { kicik: 13.5, normal: 15, boyuk: 16.5 };
const DENSITY_PAD: Record<string, number> = { kompakt: 8, rahat: 14, genis: 22 };

// Registry-dən client-safe default config (server-only config.ts-i import etmədən).
function buildDefaultConfig(): LiteConfig {
  const modules: LiteConfig["modules"] = {};
  for (const m of LITE_MODULES) {
    const blocks: Record<string, boolean> = {};
    for (const b of m.bloklar) blocks[b.kod] = b.liteDefault;
    modules[m.kod] = { visible: true, enabled: true, blocks };
  }
  return {
    design: { density: "rahat", mobileLayout: "kart", fontScale: "normal", accent: "rose" },
    modules,
  };
}

function Segment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { kod: string; ad: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-secondary/70 p-0.5">
      {options.map((o) => (
        <button
          key={o.kod}
          type="button"
          onClick={() => onChange(o.kod as T)}
          className={cn(
            "h-8 rounded-md px-3 text-xs font-semibold transition",
            value === o.kod
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.ad}
        </button>
      ))}
    </div>
  );
}

export function LiteSettings({ initialConfig }: { initialConfig: LiteConfig }) {
  const [cfg, setCfg] = useState<LiteConfig>(initialConfig);
  const [pending, start] = useTransition();

  const setDesign = <K extends keyof LiteConfig["design"]>(
    k: K,
    v: LiteConfig["design"][K],
  ) => setCfg((c) => ({ ...c, design: { ...c.design, [k]: v } }));

  const toggleModule = (m: string) =>
    setCfg((c) => ({
      ...c,
      modules: { ...c.modules, [m]: { ...c.modules[m], enabled: !c.modules[m].enabled } },
    }));

  const toggleVisible = (m: string) =>
    setCfg((c) => ({
      ...c,
      modules: { ...c.modules, [m]: { ...c.modules[m], visible: !c.modules[m].visible } },
    }));

  const toggleBlock = (m: string, b: string) =>
    setCfg((c) => ({
      ...c,
      modules: {
        ...c.modules,
        [m]: {
          ...c.modules[m],
          blocks: { ...c.modules[m].blocks, [b]: !c.modules[m].blocks[b] },
        },
      },
    }));

  const setLanding = (m: string, href: string) =>
    setCfg((c) => ({
      ...c,
      modules: { ...c.modules, [m]: { ...c.modules[m], landing: href } },
    }));

  function save() {
    start(async () => {
      const res = await saveLiteConfig(cfg);
      if (res.ok) toast.success("Lite ayarları saxlanıldı — dashboard və modul səhifələrinə tətbiq olundu");
      else toast.error(res.error ?? "Xəta baş verdi");
    });
  }

  const accentHex =
    ACCENT_OPTIONS.find((a) => a.kod === cfg.design.accent)?.hex ?? "#e11d48";
  const fontPx = FONT_PX[cfg.design.fontScale] ?? 15;
  const pad = DENSITY_PAD[cfg.design.density] ?? 14;

  return (
    <div className="space-y-6">
      {/* ── Dizayn forması + canlı önizləmə ── */}
      <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold">Dizayn forması</h2>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Sıxlıq</label>
            <div><Segment value={cfg.design.density} options={DENSITY_OPTIONS} onChange={(v) => setDesign("density", v)} /></div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Şrift ölçüsü</label>
            <div><Segment value={cfg.design.fontScale} options={FONT_OPTIONS} onChange={(v) => setDesign("fontScale", v)} /></div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mobil layout</label>
            <div><Segment value={cfg.design.mobileLayout} options={MOBILE_LAYOUT_OPTIONS} onChange={(v) => setDesign("mobileLayout", v)} /></div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Aksent rəng</label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_OPTIONS.map((a) => (
                <button
                  key={a.kod}
                  type="button"
                  onClick={() => setDesign("accent", a.kod)}
                  className={cn(
                    "h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition",
                    cfg.design.accent === a.kod ? "ring-foreground/40" : "ring-transparent",
                  )}
                  style={{ background: a.hex }}
                  title={a.ad}
                  aria-label={a.ad}
                  aria-pressed={cfg.design.accent === a.kod}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Canlı önizləmə */}
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> Önizləmə
          </div>
          <div
            className="rounded-lg border border-border bg-card"
            style={{ padding: pad, fontSize: fontPx }}
          >
            <div className="text-[0.8em] text-muted-foreground">Bu günün satışı</div>
            <div className="font-extrabold" style={{ fontSize: "1.6em", color: accentHex }}>
              1 240 ₼
            </div>
            <div className="mt-1 text-[0.78em] text-muted-foreground">12 əməliyyat · 3 müştəri</div>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[0.8em] font-semibold text-white"
              style={{ background: accentHex }}
            >
              <Zap className="h-3 w-3" /> Düymə
            </button>
          </div>
        </div>
      </section>

      {/* ── Modullar üzrə bloklar ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold">Modullarda Lite görünüşü</h2>
        <p className="text-xs text-muted-foreground">
          Hər modulu Lite-da sadələşdirin və hansı blokların görünəcəyini seçin.
          <span className="font-medium"> Sadələşdirmə söndürülübsə</span>, həmin modul Lite-da
          da tam görünür. <span className="font-medium">"Görünür" keçidini söndürsəniz</span>, modul
          Lite naviqasiyasından tamamilə çıxır. Pro rejimi həmişə tam funksionaldır.
        </p>
        {LITE_MODULES.map((m) => {
          const mc = cfg.modules[m.kod];
          if (!mc) return null;
          return (
            <div key={m.kod} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{m.ad}</span>
                <div className="flex items-center gap-3">
                  {m.kod !== "dashboard" && (
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      {mc.visible ? "Görünür" : "Gizli"}
                      <input
                        type="checkbox"
                        checked={mc.visible}
                        onChange={() => toggleVisible(m.kod)}
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                  )}
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    {mc.enabled ? "Lite-da sadələşdir" : "Tam göstərilir"}
                    <input
                      type="checkbox"
                      checked={mc.enabled}
                      onChange={() => toggleModule(m.kod)}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                </div>
              </div>
              {!mc.visible && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Bu modul Lite rejimində naviqasiyada görünməyəcək (Pro-da görünür).
                </p>
              )}
              {mc.visible && MODULE_LANDINGS[m.kod] && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Giriş səhifəsi (icmal bağlı olanda):</span>
                  <select
                    value={mc.landing ?? MODULE_LANDINGS[m.kod][0].href}
                    onChange={(e) => setLanding(m.kod, e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {MODULE_LANDINGS[m.kod].map((l) => (
                      <option key={l.href} value={l.href}>{l.ad}</option>
                    ))}
                  </select>
                </div>
              )}
              {mc.visible && mc.enabled && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {m.bloklar.map((b) => (
                    <label
                      key={b.kod}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-background px-2.5 py-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={mc.blocks[b.kod] ?? b.liteDefault}
                        onChange={() => toggleBlock(m.kod, b.kod)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span>{b.ad}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Saxla / Defolta qaytar — sticky alt */}
      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-2 border-t border-border bg-background/90 px-1 py-3 backdrop-blur">
        <Button
          variant="outline"
          onClick={() => {
            setCfg(buildDefaultConfig());
            toast.message("Defolt seçimlər bərpa olundu — saxlamağı unutmayın");
          }}
          disabled={pending}
          className="h-10"
        >
          <RotateCcw className="h-4 w-4" />
          Defolta qaytar
        </Button>
        <Button onClick={save} disabled={pending} className="h-10">
          <Save className="h-4 w-4" />
          {pending ? "Saxlanılır…" : "Yadda saxla"}
        </Button>
      </div>
    </div>
  );
}
