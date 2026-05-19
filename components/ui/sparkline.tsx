"use client";

type Props = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  filled?: boolean;
  showLast?: boolean;
};

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "hsl(var(--primary))",
  filled = true,
  showLast = false,
}: Props) {
  if (data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = i * stepX;
    const y = height - ((d - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const linePath = points.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(" ");
  const fillPath = `${linePath} L ${points[points.length - 1][0]} ${height} L 0 ${height} Z`;

  const trend = data[data.length - 1] > data[0] ? "up" : "down";
  const trendColor = trend === "up" ? "hsl(160 84% 39%)" : "hsl(0 84% 60%)";

  return (
    <svg width={width} height={height} className="overflow-visible">
      {filled && (
        <path d={fillPath} fill={color} opacity={0.12} />
      )}
      <path d={linePath} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {showLast && data.length > 0 && (
        <circle
          cx={points[points.length - 1][0]}
          cy={points[points.length - 1][1]}
          r={2.5}
          fill={trendColor}
        />
      )}
    </svg>
  );
}
