"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type SparklineProps = {
  data: number[];
  className?: string;
  stroke?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  strokeWidth?: number;
};

/**
 * Hand-rolled SVG sparkline. Recharts is overkill inside a 40-row table and
 * this renders instantly with no layout cost.
 */
export function Sparkline({
  data,
  className,
  stroke,
  fill = true,
  width = 92,
  height = 30,
  strokeWidth = 1.6,
}: SparklineProps) {
  const gradientId = React.useId();

  if (!data || data.length < 2) {
    return <div className={cn("h-[30px] w-[92px] rounded bg-muted/50", className)} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = strokeWidth + 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = pad + (1 - (value - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  const up = data[data.length - 1]! >= data[0]!;
  const color = stroke ?? (up ? "var(--gain)" : "var(--loss)");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
        </>
      )}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
