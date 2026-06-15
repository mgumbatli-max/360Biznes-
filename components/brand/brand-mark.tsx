import { cn } from "@/lib/utils";

/**
 * 360Biznes loqo nişanı — "360° Orbit" konsepti: açıq halqa (360° hərtərəfli
 * idarəetmə) + içəridə yüksələn ox (böyümə). Emerald-Teal gradient.
 * Server-compatible (hook yoxdur). Bir səhifədə çox dəfə işlənə bilər.
 */
export function BrandMark({
  className,
  size,
  tone = "gradient",
}: {
  className?: string;
  size?: number;
  /** "gradient" — işıqlı fonlar üçün (default); "white" — tünd fonlar üçün ağ. */
  tone?: "gradient" | "white";
}) {
  const stroke = tone === "white" ? "#ffffff" : "url(#bm360)";
  const dot = tone === "white" ? "#ffffff" : "#34d399";
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="360Biznes"
      width={size}
      height={size}
      className={cn("flex-shrink-0", className)}
    >
      {tone === "gradient" && (
        <defs>
          <linearGradient id="bm360" x1="8" y1="8" x2="56" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0d9488" />
            <stop offset="1" stopColor="#34d399" />
          </linearGradient>
        </defs>
      )}
      <path d="M51 17.5 A26 26 0 1 0 56 35" stroke={stroke} strokeWidth="6.5" strokeLinecap="round" />
      <path d="M21 38.5 L29 30.5 L35 36 L45 25.5" stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M38.5 24.5 L46 24.5 L46 32" stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="52.5" cy="15" r="6" fill={dot} />
    </svg>
  );
}
