/**
 * Code128-B SVG barkod renderer — heç bir asılılığı yoxdur, kompdan skan olunur.
 *
 * Code128-B 95+ ASCII simvolu dəstəkləyir (rəqəm, hərf, durğu işarə).
 * Hər kod 11 bit (3 bar + 3 boşluq genişliyi) ilə təmsil olunur.
 *
 * Standart formula:
 *   pattern = START_B + data values + checksum + STOP
 *   checksum = (start + Σ(i × value)) mod 103
 */

import * as React from "react";

const CODE128_PATTERNS: string[] = [
  "11011001100","11001101100","11001100110","10010011000","10010001100","10001001100",
  "10011001000","10011000100","10001100100","11001001000","11001000100","11000100100",
  "10110011100","10011011100","10011001110","10111001100","10011101100","10011100110",
  "11001110010","11001011100","11001001110","11011100100","11001110100","11101101110",
  "11101001100","11100101100","11100100110","11101100100","11100110100","11100110010",
  "11011011000","11011000110","11000110110","10100011000","10001011000","10001000110",
  "10110001000","10001101000","10001100010","11010001000","11000101000","11000100010",
  "10110111000","10110001110","10001101110","10111011000","10111000110","10001110110",
  "11101110110","11010001110","11000101110","11011101000","11011100010","11011101110",
  "11101011000","11101000110","11100010110","11101101000","11101100010","11100011010",
  "11101111010","11001000010","11110001010","10100110000","10100001100","10010110000",
  "10010000110","10000101100","10000100110","10110010000","10110000100","10011010000",
  "10011000010","10000110100","10000110010","11000010010","11001010000","11110111010",
  "11000010100","10001111010","10100111100","10010111100","10010011110","10111100100",
  "10011110100","10011110010","11110100100","11110010100","11110010010","11011011110",
  "11011110110","11110110110","10101111000","10100011110","10001011110","10111101000",
  "10111100010","11110101000","11110100010","10111011110","10111101110","11101011110",
  "11110101110","11010000100","11010010000","11010011100","11000111010",
];

const START_B = 104;
const STOP = 106;

function valueToCode(ch: string): number {
  // Code128-B: ASCII 32–127 → values 0–95
  const code = ch.charCodeAt(0);
  if (code >= 32 && code <= 127) return code - 32;
  return 0; // boşluğa çevir
}

function encode(value: string): number[] {
  const values: number[] = [START_B];
  for (const ch of value) {
    values.push(valueToCode(ch));
  }
  // Checksum
  let sum = START_B;
  for (let i = 0; i < value.length; i++) {
    sum += (i + 1) * valueToCode(value[i]);
  }
  values.push(sum % 103);
  values.push(STOP);
  return values;
}

export type BarcodeProps = {
  value: string;
  /** Bar genişliyi piksel. Default 1.5 = balanslı keyfiyyət/ölçü */
  scale?: number;
  /** Barkod hündürlüyü piksel. Default 40 */
  height?: number;
  /** Mətn göstər (barkodun altında). Default false */
  showText?: boolean;
  /** Bar rəngi (CSS color string). Default "#000" */
  color?: string;
  /** Arxa fon rəngi. Default "#fff" */
  background?: string;
  /** Extra class */
  className?: string;
};

/**
 * Real Code128-B barkod — kompdan skan olunur.
 *
 * Boş və ya etibarsız value üçün heç nə render etmir.
 */
export function Barcode({
  value,
  scale = 1.5,
  height = 40,
  showText = false,
  color = "#000",
  background = "#fff",
  className,
}: BarcodeProps) {
  if (!value || !value.trim()) return null;

  const codes = encode(value);
  const bars: { x: number; w: number }[] = [];
  let x = 10; // sol quiet zone (10 unit)

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    if (!pattern) continue;
    for (let i = 0; i < pattern.length; i++) {
      const w = parseInt(pattern[i], 10);
      if (i % 2 === 0) {
        // Bar (qara)
        bars.push({ x, w });
      }
      x += w;
    }
  }
  x += 10; // sağ quiet zone (10 unit)

  const totalUnits = x;
  const width = totalUnits * scale;
  const totalHeight = showText ? height + 14 : height;

  return (
    <svg
      role="img"
      aria-label={`Barkod: ${value}`}
      className={className}
      width={width}
      height={totalHeight}
      viewBox={`0 0 ${totalUnits} ${totalHeight / scale}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      style={{ background, display: "block" }}
    >
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height / scale} fill={color} />
      ))}
      {showText && (
        <text
          x={totalUnits / 2}
          y={height / scale + 10 / scale}
          textAnchor="middle"
          fontSize={9 / scale}
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          fill={color}
          style={{ letterSpacing: "0.05em" }}
        >
          {value}
        </text>
      )}
    </svg>
  );
}

/**
 * Mini barkod — cədvəl sətrində kompakt göstərmə üçün.
 * Tipik istifadə: barkod sütununda mətnin yanında ölçü 24x16 px.
 */
export function MiniBarcode({ value, className }: { value: string; className?: string }) {
  return <Barcode value={value} scale={0.5} height={16} className={className} />;
}
