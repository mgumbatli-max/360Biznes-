import type { LiteDesign } from "@/lib/lite/config";

/**
 * Lite dizayn formasını SSR zamanı `<html>`-ə baked inline script ilə qoyur —
 * ilk paint-dən əvvəl işləyir, ona görə FOUC/flash YOXDUR (əvvəlki client-only
 * useEffect variantı flash verirdi). Dəyərlər registry enum-undan (sanitize
 * olunmuş) gəlir, ona görə inline JSON təhlükəsizdir.
 *
 * `active=false` (Pro) → atributlar silinir. Server Component-dir.
 */
/**
 * Görünən modul-icmalları `<html data-icmal="ticaret,anbar">` kimi yazır —
 * client subnavlar İcmal tabını bu atributdan oxuyur (rejimdən asılı deyil).
 */
export function IcmalAttrScript({ modules }: { modules: string[] }) {
  const js =
    `(function(){try{document.documentElement.dataset.icmal=` +
    `${JSON.stringify(modules.join(","))};}catch(_){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

export function LiteThemeScript({
  design,
  active,
}: {
  design: LiteDesign | null;
  active: boolean;
}) {
  const js =
    active && design
      ? `(function(){try{var e=document.documentElement;e.dataset.lite='1';` +
        `e.dataset.density=${JSON.stringify(design.density)};` +
        `e.dataset.font=${JSON.stringify(design.fontScale)};` +
        `e.dataset.accent=${JSON.stringify(design.accent)};` +
        `e.dataset.mlayout=${JSON.stringify(design.mobileLayout)};}catch(_){}})();`
      : `(function(){try{var e=document.documentElement;delete e.dataset.lite;` +
        `delete e.dataset.density;delete e.dataset.font;delete e.dataset.accent;` +
        `delete e.dataset.mlayout;}catch(_){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
